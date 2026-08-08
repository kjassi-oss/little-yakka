'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'
import LoadingLogo from '@/components/LoadingLogo'
import { getCachedFamily } from '@/lib/familyCache'
import { signAvatarUrls } from '@/lib/avatarUrls'
import ConfirmDialog, { type DialogAsk } from '@/components/ConfirmDialog'

// ── Family Calendar (in-app calendar) ────────────────────────────────────────
// Tabs: Day · Week · Month (default) · Agenda. Events assign to one or more
// children — each child has a UNIQUE, persistent colour (children.colour) that
// drives their avatars + the entry's colour bar (a gradient when several).
// Family-scoped by RLS.
//
// PHASE 2 (NOT built — needs inbound-email infrastructure): emailing an invite
// to participants + syncing their RSVP will hang off the family_events table.

interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string | null }
interface FamilyEvent {
  id: string; title: string; starts_at: string; ends_at: string | null
  all_day: boolean; colour: string | null; notes: string | null
  location: string | null; child_ids: string[] | null; created_by?: string | null
}
type Ev = FamilyEvent & { _start: Date; _startDate: string; _endDate: string }
type ChildMap = Record<string, Child>

// 7 brand colours — one row in the picker, one colour per child.
const BRAND_COLOURS = [
  { name: 'Teal', hex: '#06A8B2' }, { name: 'Purple', hex: '#62449B' },
  { name: 'Raspberry', hex: '#EC4160' }, { name: 'Yellow', hex: '#F8B211' },
  { name: 'Green', hex: '#5FAD43' }, { name: 'Blue', hex: '#0768C3' },
  { name: 'Orange', hex: '#F69112' },
]
const DEFAULT_COLOUR = BRAND_COLOURS[0].hex
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const HEADING = { fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as const

function ymdLocal(d: Date): string { return new Intl.DateTimeFormat('en-CA').format(d) }
function hhmm(d: Date): string { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
function fmtTime(d: Date): string { return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '') }
function fmtTimeShort(d: Date): string {
  const h = d.getHours(), m = d.getMinutes()
  const ampm = h < 12 ? 'AM' : 'PM'; const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}
function fmtHour(h: number): string {
  const hr = ((h % 24) + 24) % 24
  if (hr === 0) return '12 AM'; if (hr === 12) return '12 PM'
  return hr < 12 ? `${hr} AM` : `${hr - 12} PM`
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function dateAtNoon(iso: string): Date { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0) }
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x
}

// Give every child a distinct colour, keeping their existing one where unique.
function initChildColours(kids: Child[]): Record<string, string> {
  const map: Record<string, string> = {}; const used = new Set<string>()
  for (const c of kids) { if (c.colour && !used.has(c.colour)) { map[c.id] = c.colour; used.add(c.colour) } }
  for (const c of kids) {
    if (!map[c.id]) { const free = BRAND_COLOURS.find(b => !used.has(b.hex))?.hex || c.colour || DEFAULT_COLOUR; map[c.id] = free; used.add(free) }
  }
  return map
}

function eventColours(e: FamilyEvent, cm: ChildMap): string[] {
  const kids = (e.child_ids || []).map(id => cm[id]).filter(Boolean) as Child[]
  return kids.length ? kids.map(k => k.colour || 'var(--theme-from)') : [e.colour || 'var(--theme-from)']
}
function eventBar(e: FamilyEvent, cm: ChildMap): string {
  const c = eventColours(e, cm); return c.length === 1 ? c[0] : `linear-gradient(180deg, ${c.join(', ')})`
}

function layoutDay(evs: Ev[]) {
  const allDay = evs.filter(e => e.all_day)
  const raw = evs.filter(e => !e.all_day).map(e => {
    const s = e._start; const startMin = s.getHours() * 60 + s.getMinutes()
    const ed = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 30 * 60000)
    let endMin = ed.getHours() * 60 + ed.getMinutes()
    if (ymdLocal(ed) !== ymdLocal(s)) endMin = 24 * 60
    if (endMin <= startMin) endMin = Math.min(startMin + 30, 24 * 60)
    return { e, startMin, endMin, lane: 0, lanes: 1 }
  }).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const timed: typeof raw = []
  let cluster: typeof raw = []; let clusterEnd = -1
  const flush = () => {
    const laneEnds: number[] = []
    cluster.forEach(item => {
      let placed = false
      for (let i = 0; i < laneEnds.length; i++) { if (item.startMin >= laneEnds[i]) { item.lane = i; laneEnds[i] = item.endMin; placed = true; break } }
      if (!placed) { item.lane = laneEnds.length; laneEnds.push(item.endMin) }
    })
    cluster.forEach(item => timed.push({ ...item, lanes: laneEnds.length })); cluster = []; clusterEnd = -1
  }
  raw.forEach(item => { if (cluster.length && item.startMin >= clusterEnd) flush(); cluster.push(item); clusterEnd = Math.max(clusterEnd, item.endMin) })
  if (cluster.length) flush()
  return { allDay, timed }
}

type View = 'day' | 'week' | 'month' | 'agenda'

export default function CalendarPage() {
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [familyId, setFamilyId] = useState('')
  const [guardianId, setGuardianId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [view, setView] = useState<View>('month')

  const today = new Date()
  const todayStr = ymdLocal(today)
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [focusedDate, setFocusedDate] = useState(todayStr) // Day tab

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [date, setDate] = useState(todayStr)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [colour, setColour] = useState(DEFAULT_COLOUR)
  const [childColours, setChildColours] = useState<Record<string, string>>({})
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [assignedChildren, setAssignedChildren] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmAsk, setConfirmAsk] = useState<DialogAsk | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const fam = await getCachedFamily(supabase)
    if (!fam) return
    setFamilyId(fam.familyId)
    const [{ data: eventsData, error }, { data: childrenData }, { data: guardian }] = await Promise.all([
      supabase.from('family_events').select('*').eq('family_id', fam.familyId).order('starts_at'),
      supabase.from('children').select('id, name, avatar, colour, avatar_url').eq('family_id', fam.familyId).order('name'),
      supabase.from('guardians').select('id').eq('auth_user_id', fam.userId).maybeSingle(),
    ])
    if (error) { setNeedsMigration(true); setEvents([]) }
    else setEvents((eventsData as FamilyEvent[]) || [])
    await signAvatarUrls(supabase, childrenData || [])
    setChildren((childrenData as Child[]) || [])
    setGuardianId(guardian?.id || null)
    setPageLoading(false)
  }

  const childMap: ChildMap = useMemo(() => { const m: ChildMap = {}; children.forEach(c => { m[c.id] = c }); return m }, [children])

  const decorated: Ev[] = useMemo(() => events.map(e => {
    const start = new Date(e.starts_at); const startDate = ymdLocal(start)
    let endDate = e.ends_at ? ymdLocal(new Date(e.ends_at)) : startDate
    if (endDate < startDate) endDate = startDate
    return { ...e, _start: start, _startDate: startDate, _endDate: endDate }
  }), [events])

  function eventsOnDate(dateStr: string): Ev[] {
    return decorated.filter(e => e._startDate <= dateStr && dateStr <= e._endDate)
      .sort((a, b) => a.all_day === b.all_day ? a._start.getTime() - b._start.getTime() : (a.all_day ? -1 : 1))
  }
  function openDay(ds: string) { setFocusedDate(ds); setView('day') }

  const grid = useMemo(() => {
    const { y, m } = cursor
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const weeks = Math.ceil((firstDow + daysInMonth) / 7)
    const start = new Date(y, m, 1 - firstDow)
    const cells = Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
    return { cells, weeks }
  }, [cursor])
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  function shiftMonth(delta: number) { setCursor(c => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } }) }

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6); const mon = (d: Date) => d.toLocaleDateString('en-AU', { month: 'short' })
    return weekStart.getMonth() === end.getMonth()
      ? `${weekStart.getDate()}–${end.getDate()} ${mon(end)}`
      : `${weekStart.getDate()} ${mon(weekStart)} – ${end.getDate()} ${mon(end)}`
  }, [weekStart])

  // Form
  function openNewForm(forDate?: string) {
    setEditingId(null); setTitle(''); setAllDay(false)
    setDate(forDate || todayStr); setStartTime('09:00'); setEndTime(''); setEndDate('')
    setColour(DEFAULT_COLOUR); setChildColours(initChildColours(children)); setLocation(''); setNotes(''); setAssignedChildren([])
    setFormError(''); setShowForm(true)
  }
  function openEditForm(e: FamilyEvent) {
    setEditingId(e.id); setTitle(e.title); setAllDay(e.all_day)
    const s = new Date(e.starts_at); setDate(ymdLocal(s)); setStartTime(e.all_day ? '09:00' : hhmm(s))
    const end = e.ends_at ? new Date(e.ends_at) : null
    setEndTime(e.all_day || !end ? '' : hhmm(end)); setEndDate(e.all_day && end ? ymdLocal(end) : '')
    setColour(e.colour || DEFAULT_COLOUR); setChildColours(initChildColours(children))
    setLocation(e.location || ''); setNotes(e.notes || ''); setAssignedChildren(e.child_ids || [])
    setFormError(''); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditingId(null) }

  async function saveEvent() {
    if (!title.trim()) { setFormError('Please enter a title.'); return }
    if (!date) { setFormError('Please pick a date.'); return }
    // Each assigned child needs a colour, unique across ALL family children.
    for (const id of assignedChildren) {
      const mine = childColours[id]
      if (!mine) { setFormError('Each child needs a colour.'); return }
      if (children.some(o => o.id !== id && childColours[o.id] === mine)) {
        setFormError('Two children have the same colour — give each a different one.'); return
      }
    }
    setSaving(true); setFormError('')
    const [y, mo, dd] = date.split('-').map(Number)
    let starts_at: string; let ends_at: string | null = null
    if (allDay) {
      starts_at = new Date(y, mo - 1, dd, 0, 0, 0).toISOString()
      if (endDate) { const [ey, em, ed] = endDate.split('-').map(Number); const e = new Date(ey, em - 1, ed, 0, 0, 0); if (e.getTime() > new Date(starts_at).getTime()) ends_at = e.toISOString() }
    } else {
      const [sh, sm] = startTime.split(':').map(Number)
      starts_at = new Date(y, mo - 1, dd, sh || 0, sm || 0).toISOString()
      if (endTime) { const [eh, em] = endTime.split(':').map(Number); const e = new Date(y, mo - 1, dd, eh || 0, em || 0); if (e.getTime() > new Date(starts_at).getTime()) ends_at = e.toISOString() }
    }
    const payload = {
      title: title.trim(), starts_at, ends_at, all_day: allDay, colour,
      location: location.trim() || null, notes: notes.trim() || null,
      child_ids: assignedChildren.length ? assignedChildren : null,
    }
    const supabase = createClient()
    for (const id of assignedChildren) {
      if (childColours[id] && childColours[id] !== childMap[id]?.colour) {
        await supabase.from('children').update({ colour: childColours[id] }).eq('id', id)
      }
    }
    const attempt = (p: Record<string, unknown>) => editingId
      ? supabase.from('family_events').update(p).eq('id', editingId)
      : supabase.from('family_events').insert({ ...p, family_id: familyId, created_by: guardianId })
    let { error } = await attempt(payload)
    if (error && /location|child_ids/.test(error.message || '')) {
      const { location: _l, child_ids: _c, ...basePayload } = payload
      ;({ error } = await attempt(basePayload))
    }
    if (error) { setFormError(error.message || 'Failed to save.'); setSaving(false); return }
    setSaving(false); closeForm(); loadData()
  }

  function deleteEvent(e: FamilyEvent) {
    setConfirmAsk({
      emoji: '🗑', title: `Delete "${e.title}"?`, sub: 'This removes it from the family calendar.',
      danger: true, confirmLabel: 'Delete', cancelLabel: 'Keep it',
      onConfirm: async () => { setConfirmAsk(null); await createClient().from('family_events').delete().eq('id', e.id); closeForm(); loadData() },
    })
  }

  const agendaDays = useMemo(() => {
    const upcoming = decorated.filter(e => e._endDate >= todayStr)
    const byDay = new Map<string, Ev[]>()
    for (const e of upcoming) {
      let d = e._startDate < todayStr ? todayStr : e._startDate
      while (d <= e._endDate) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d)!.push(e); d = ymdLocal(addDays(dateAtNoon(d), 1)) }
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, evs]) => ({
      day, events: evs.sort((a, b) => a.all_day === b.all_day ? a._start.getTime() - b._start.getTime() : (a.all_day ? -1 : 1)),
    }))
  }, [decorated, todayStr])

  function dayLabel(iso: string): string {
    const dt = dateAtNoon(iso)
    const short = dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
    const tomorrow = ymdLocal(addDays(today, 1))
    if (iso === todayStr) return `Today · ${short}`
    if (iso === tomorrow) return `Tomorrow · ${short}`
    return dt.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  if (pageLoading) return <LoadingLogo />

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-50">
      <div className="bg-white shadow-sm flex-shrink-0">
        <div className="pt-14 pb-2.5 px-4 border-b border-gray-100">
          <div className="max-w-sm lg:max-w-4xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center">
            <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto justify-self-start" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="text-4xl font-black justify-self-center leading-none" style={HEADING}>Calendar</span>
            <div className="justify-self-end"><ProfileButton /></div>
          </div>
        </div>
        <div className="px-4 pt-2.5 pb-2">
          <div className="max-w-sm lg:max-w-4xl mx-auto flex bg-gray-100 rounded-2xl p-1 gap-1">
            {([['day', '📆 Day'], ['week', '🗓️ Week'], ['month', '📅 Month'], ['agenda', '📋 Agenda']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${view === v ? 'text-white shadow' : 'text-gray-400'}`}
                style={view === v ? { background: 'var(--theme-gradient)' } : {}}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col max-w-sm lg:max-w-4xl mx-auto w-full">
        {needsMigration && (
          <div className="mx-3 mt-2 rounded-2xl p-3 border-2 border-dashed border-amber-300 bg-amber-50 flex-shrink-0">
            <p className="text-sm font-bold text-amber-700">📅 Almost ready</p>
            <p className="text-xs text-amber-600">Run the latest <span className="font-mono">supabase_migration.sql</span> in Supabase to enable the calendar.</p>
          </div>
        )}

        {/* ── DAY ── */}
        {view === 'day' && (
          <DayView dateStr={focusedDate} todayStr={todayStr} events={eventsOnDate(focusedDate)} childMap={childMap}
            onPrev={() => setFocusedDate(ymdLocal(addDays(dateAtNoon(focusedDate), -1)))}
            onNext={() => setFocusedDate(ymdLocal(addDays(dateAtNoon(focusedDate), 1)))}
            onToday={() => setFocusedDate(todayStr)} onOpenEvent={openEditForm} />
        )}

        {/* ── WEEK ── */}
        {view === 'week' && (
          <div className="flex-1 min-h-0 flex flex-col px-3 pt-2">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <button onClick={() => setWeekStart(w => addDays(w, -7))} aria-label="Previous week" className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">‹</button>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black leading-none" style={HEADING}>{weekLabel}</span>
                <button onClick={() => setWeekStart(mondayOf(new Date()))} className="text-[11px] font-black px-3 py-1 rounded-full text-white active:scale-95 transition" style={{ background: 'var(--theme-gradient)' }}>This week</button>
              </div>
              <button onClick={() => setWeekStart(w => addDays(w, 7))} aria-label="Next week" className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">›</button>
            </div>
            <WeekGrid weekDays={weekDays} eventsOnDate={eventsOnDate} childMap={childMap} todayStr={todayStr} onOpenDay={openDay} onOpenEvent={openEditForm} />
          </div>
        )}

        {/* ── MONTH ── */}
        {view === 'month' && (
          <div className="flex-1 min-h-0 flex flex-col px-3 pt-2 pb-24">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">‹</button>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black leading-none" style={HEADING}>{monthLabel}</span>
                <button onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })} className="text-[11px] font-black px-3 py-1 rounded-full text-white active:scale-95 transition" style={{ background: 'var(--theme-gradient)' }}>Today</button>
              </div>
              <button onClick={() => shiftMonth(1)} aria-label="Next month" className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">›</button>
            </div>
            <div className="grid grid-cols-7 flex-shrink-0">
              {WEEKDAY_LETTERS.map((d, i) => <div key={i} className="text-center text-[11px] font-black text-gray-400 pb-1">{d}</div>)}
            </div>
            <div className="flex-1 min-h-0 grid grid-cols-7 bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100" style={{ gridTemplateRows: `repeat(${grid.weeks}, minmax(0, 1fr))` }}>
              {grid.cells.map((d, i) => {
                const ds = ymdLocal(d); const inMonth = d.getMonth() === cursor.m; const isToday = ds === todayStr
                const evs = eventsOnDate(ds)
                return (
                  <button key={i} onClick={() => openDay(ds)} className="border-r border-b border-gray-100 p-0.5 flex flex-col items-stretch overflow-hidden text-left active:bg-gray-50 transition min-h-0">
                    <div className="flex justify-center flex-shrink-0">
                      <span className={`min-w-[24px] h-6 px-1 flex items-center justify-center rounded-full text-xs font-black ${isToday ? 'text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`} style={isToday ? { background: 'var(--theme-gradient)' } : {}}>{d.getDate()}</span>
                    </div>
                    <div className="mt-0.5 space-y-0.5 overflow-hidden">
                      {evs.slice(0, 3).map(e => (
                        <div key={e.id} className="rounded px-1 py-px text-[8px] font-bold text-white leading-tight truncate" style={{ background: eventBar(e, childMap), textShadow: '0 1px 1px rgba(0,0,0,.2)' }}>
                          {e.all_day ? e.title : `${fmtTimeShort(e._start).replace(/ (AM|PM)$/, (_m, p) => p === 'AM' ? 'a' : 'p')} ${e.title}`}
                        </div>
                      ))}
                      {evs.length > 3 && <div className="text-[8px] text-gray-400 font-black px-1 leading-tight">+{evs.length - 3}</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── AGENDA ── */}
        {view === 'agenda' && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-24">
            {agendaDays.length > 0 ? (
              <div className="space-y-4">
                {agendaDays.map(({ day, events: evs }) => (
                  <div key={day}>
                    <button onClick={() => openDay(day)} className="text-lg font-black mb-2 px-1 active:opacity-60 transition" style={HEADING}>{dayLabel(day)} ›</button>
                    <div className="space-y-2">{evs.map(e => <EventCard key={e.id + day} e={e} childMap={childMap} onClick={() => openEditForm(e)} allDay={e.all_day} />)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16"><div className="text-6xl mb-4">📅</div><p className="text-gray-500 font-medium">No upcoming events</p><p className="text-gray-400 text-sm mt-1">Tap the + to add one</p></div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto">
          <div className="max-w-sm lg:max-w-2xl mx-auto px-4 pt-14 pb-28 space-y-4">
            <div className="relative flex items-center justify-center min-h-[44px]">
              <h2 className="text-4xl font-black leading-none text-center" style={HEADING}>{editingId ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={closeForm} aria-label="Close" className="absolute right-0 w-9 h-9 flex items-center justify-center text-3xl leading-none text-gray-400 active:scale-90 transition">×</button>
            </div>

            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="Title" />

            {/* Date + All-day on one row — Date is a fixed, smaller width so the
                toggle always has clear space (native date inputs otherwise grow). */}
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-2">Date</p>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 max-w-full min-w-0 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div className="flex-shrink-0 text-center pb-1">
                <p className="text-xs text-gray-500 mb-2">All day</p>
                <button onClick={() => setAllDay(v => !v)} className={`w-12 h-7 rounded-full transition-colors relative ${allDay ? '' : 'bg-gray-200'}`} style={allDay ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${allDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {allDay ? (
              <div><p className="text-xs text-gray-500 mb-2">End date (optional)</p><input type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0"><p className="text-xs text-gray-500 mb-2">Start time</p><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full min-w-0 border border-gray-200 rounded-2xl px-2 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
                <div className="min-w-0"><p className="text-xs text-gray-500 mb-2">End time</p><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full min-w-0 border border-gray-200 rounded-2xl px-2 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              </div>
            )}

            <div><p className="text-xs text-gray-500 mb-2">📍 Location (optional)</p><input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="e.g. Community Pool, 12 Main St" /></div>

            {children.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Who's it for? <span className="text-gray-300">(optional — leave blank for a family event)</span></p>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(children.length, 1), 4)}, minmax(0, 1fr))` }}>
                  {children.map(child => {
                    const sel = assignedChildren.includes(child.id)
                    const ring = childColours[child.id] || child.colour
                    return (
                      <button key={child.id} onClick={() => setAssignedChildren(prev => prev.includes(child.id) ? prev.filter(id => id !== child.id) : [...prev, child.id])} className="flex flex-col items-center gap-1 active:scale-95 transition">
                        {child.avatar_url
                          ? <img src={child.avatar_url} alt={child.name} className={`w-14 h-14 rounded-full object-cover transition ${sel ? '' : 'opacity-40 grayscale'}`} style={{ boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${ring}` : 'none' }} />
                          : <div className={`w-14 h-14 rounded-full flex items-center justify-center text-[36px] leading-none overflow-hidden bg-white transition ${sel ? '' : 'opacity-40 grayscale'}`} style={{ border: `2px solid ${ring}`, boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${ring}` : 'none' }}>{child.avatar}</div>}
                        <span className="text-[11px] font-bold truncate max-w-[56px]" style={{ color: sel ? ring : '#9ca3af' }}>{child.name.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Colour — per selected child (unique across ALL children), or the event colour when none */}
            {assignedChildren.length > 0 ? (
              <div>
                <p className="text-xs text-gray-500 mb-2">Each child's colour <span className="text-gray-300">(must be different)</span></p>
                <div className="space-y-2.5">
                  {assignedChildren.map(cid => {
                    const child = childMap[cid]; if (!child) return null
                    return (
                      <div key={cid} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 w-16 flex-shrink-0">
                          {child.avatar_url
                            ? <img src={child.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                            : <div className="w-6 h-6 rounded-full flex items-center justify-center text-[15px] leading-none overflow-hidden bg-white" style={{ border: `2px solid ${childColours[cid] || child.colour}` }}>{child.avatar}</div>}
                          <span className="text-xs font-bold text-gray-700 truncate">{child.name.split(' ')[0]}</span>
                        </div>
                        <div className="flex gap-1 flex-1 justify-between">
                          {BRAND_COLOURS.map(c => {
                            const takenByOther = children.some(o => o.id !== cid && childColours[o.id] === c.hex)
                            const selected = childColours[cid] === c.hex
                            return (
                              <button key={c.hex} disabled={takenByOther} aria-label={c.name}
                                onClick={() => setChildColours(m => ({ ...m, [cid]: c.hex }))}
                                className={`w-7 h-7 rounded-full flex-shrink-0 transition ${takenByOther ? 'opacity-20' : 'active:scale-90'}`}
                                style={{ background: c.hex, boxShadow: selected ? `0 0 0 2px white, 0 0 0 4px ${c.hex}` : 'none' }} />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 mb-2">Event colour</p>
                <div className="flex gap-2 justify-between">
                  {BRAND_COLOURS.map(c => (
                    <button key={c.hex} onClick={() => setColour(c.hex)} aria-label={c.name} className="w-9 h-9 rounded-full flex-shrink-0 active:scale-90 transition" style={{ background: c.hex, boxShadow: colour === c.hex ? `0 0 0 3px white, 0 0 0 5px ${c.hex}` : 'none' }} />
                  ))}
                </div>
              </div>
            )}

            <div><p className="text-xs text-gray-500 mb-2">Notes (optional)</p><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" placeholder="Add any details…" /></div>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <button onClick={closeForm} className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold active:scale-95 transition">Cancel</button>
              <button onClick={saveEvent} disabled={saving} className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60" style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>{saving ? 'Saving…' : editingId ? 'Update Event ✓' : 'Save Event ✓'}</button>
            </div>
            {editingId && <button onClick={() => { const e = events.find(x => x.id === editingId); if (e) deleteEvent(e) }} className="w-full text-red-500 font-semibold py-2.5 rounded-2xl bg-red-50 active:scale-95 transition text-sm">🗑 Delete event</button>}
          </div>
        </div>
      )}

      <ConfirmDialog ask={confirmAsk} onClose={() => setConfirmAsk(null)} />

      {!showForm && (
        <button onClick={() => openNewForm(view === 'day' ? focusedDate : todayStr)} aria-label="Add event" className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition z-40" style={{ background: 'var(--theme-gradient)' }}>
          <span className="text-3xl leading-none mb-0.5">+</span>
        </button>
      )}
    </div>
  )
}

// ── Day tab: heading + all-day strip + full 24h scroll (default 7am) ──────────
function DayView({ dateStr, todayStr, events, childMap, onPrev, onNext, onToday, onOpenEvent }: {
  dateStr: string; todayStr: string; events: Ev[]; childMap: ChildMap
  onPrev: () => void; onNext: () => void; onToday: () => void; onOpenEvent: (e: FamilyEvent) => void
}) {
  const { allDay, timed } = layoutDay(events)
  const HOURPX = 52
  const hours = Array.from({ length: 25 }, (_, i) => i)
  const d = dateAtNoon(dateStr)
  const isToday = dateStr === todayStr
  const bigHeading = isToday ? 'Today' : d.toLocaleDateString('en-AU', { weekday: 'long' })
  const subHeading = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOURPX }, [])

  return (
    <div className="flex-1 min-h-0 flex flex-col px-3 pt-2">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <button onClick={onPrev} aria-label="Previous day" className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">‹</button>
        <div className="flex items-center gap-2">
          <div className="text-center">
            <p className="text-2xl font-black leading-none" style={HEADING}>{bigHeading}</p>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">{subHeading}</p>
          </div>
          {!isToday && <button onClick={onToday} className="text-[11px] font-black px-3 py-1 rounded-full text-white active:scale-95 transition" style={{ background: 'var(--theme-gradient)' }}>Today</button>}
        </div>
        <button onClick={onNext} aria-label="Next day" className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">›</button>
      </div>

      {allDay.length > 0 && <div className="space-y-2 mb-2 flex-shrink-0">{allDay.map(e => <EventCard key={e.id} e={e} childMap={childMap} onClick={() => onOpenEvent(e)} allDay />)}</div>}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pb-24 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="relative" style={{ height: 24 * HOURPX }}>
          {hours.map(h => (
            <div key={h}>
              <div className="absolute left-12 right-0 border-t border-gray-100" style={{ top: h * HOURPX }} />
              <span className="absolute left-0 w-12 text-right pr-2 text-[10px] text-gray-400 -mt-1.5" style={{ top: h * HOURPX }}>{fmtHour(h)}</span>
            </div>
          ))}
          <div className="absolute top-0 bottom-0 left-12 right-1">
            {timed.map(({ e, startMin, endMin, lane, lanes }) => {
              const top = startMin / 60 * HOURPX
              const height = Math.max((endMin - startMin) / 60 * HOURPX, 34)
              const w = 100 / lanes
              const kids = (e.child_ids || []).map(id => childMap[id]).filter(Boolean) as Child[]
              return (
                <button key={e.id} onClick={() => onOpenEvent(e)} className="absolute rounded-lg px-2 py-1 text-left overflow-hidden active:scale-[0.98] transition flex items-start gap-1"
                  style={{ top, height, left: `calc(${lane * w}% + 2px)`, width: `calc(${w}% - 4px)`, background: eventBar(e, childMap) }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-white leading-tight break-words" style={{ textShadow: '0 1px 1px rgba(0,0,0,.3)' }}>{e.title}</p>
                    <p className="text-[10px] text-white/90 leading-tight truncate">{fmtTimeShort(e._start)}{e.location ? ` · 📍${e.location}` : ''}</p>
                  </div>
                  {kids.length > 0 && (
                    <div className="flex -space-x-1.5 items-center flex-shrink-0">
                      {kids.slice(0, 4).map(c => (
                        c.avatar_url
                          ? <img key={c.id} src={c.avatar_url} className="w-7 h-7 rounded-full object-cover border-2 border-white" alt={c.name} />
                          : <div key={c.id} className="w-7 h-7 rounded-full flex items-center justify-center text-[17px] leading-none overflow-hidden bg-white border-2 border-white" style={{ borderColor: c.colour }}>{c.avatar}</div>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Week time-grid: full 24h, scrollable (default 7am), 7 day columns ─────────
function WeekGrid({ weekDays, eventsOnDate, childMap, todayStr, onOpenDay, onOpenEvent }: {
  weekDays: Date[]; eventsOnDate: (d: string) => Ev[]; childMap: ChildMap; todayStr: string
  onOpenDay: (d: string) => void; onOpenEvent: (e: FamilyEvent) => void
}) {
  const HOURPX = 44
  const perDay = weekDays.map(d => layoutDay(eventsOnDate(ymdLocal(d))))
  const hours = Array.from({ length: 25 }, (_, i) => i)
  const anyAllDay = perDay.some(p => p.allDay.length > 0)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOURPX }, [])

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pb-24">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex sticky top-0 bg-white z-10 border-b border-gray-100">
          <div className="w-10 flex-shrink-0" />
          {weekDays.map((d, i) => {
            const ds = ymdLocal(d); const isToday = ds === todayStr
            return (
              <button key={ds} onClick={() => onOpenDay(ds)} className="flex-1 min-w-0 flex flex-col items-center py-1.5 active:bg-gray-50 transition">
                <span className="text-[9px] font-bold text-gray-400 leading-none">{WEEKDAYS[i]}</span>
                <span className={`w-6 h-6 mt-0.5 flex items-center justify-center rounded-full text-xs font-black ${isToday ? 'text-white' : 'text-gray-700'}`} style={isToday ? { background: 'var(--theme-gradient)' } : {}}>{d.getDate()}</span>
              </button>
            )
          })}
        </div>

        {anyAllDay && (
          <div className="flex border-b border-gray-100 bg-gray-50/50">
            <div className="w-10 flex-shrink-0 text-[8px] text-gray-400 font-bold flex items-center justify-end pr-1">all-day</div>
            {weekDays.map((d, i) => (
              <div key={i} className="flex-1 min-w-0 border-l border-gray-100 p-0.5 space-y-0.5">
                {perDay[i].allDay.map(e => (
                  <button key={e.id} onClick={() => onOpenEvent(e)} className="w-full rounded px-0.5 text-left overflow-hidden active:scale-95 transition" style={{ background: eventBar(e, childMap) }}>
                    <p className="text-[8px] font-bold text-white leading-[1.1] truncate" style={{ textShadow: '0 1px 1px rgba(0,0,0,.25)' }}>{e.title}</p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="relative" style={{ height: 24 * HOURPX }}>
          {hours.map(h => (
            <div key={h}>
              <div className="absolute left-10 right-0 border-t border-gray-100" style={{ top: h * HOURPX }} />
              <span className="absolute left-0 w-10 text-right pr-1 text-[8px] text-gray-400 -mt-1.5" style={{ top: h * HOURPX }}>{fmtHour(h)}</span>
            </div>
          ))}
          <div className="absolute top-0 bottom-0 left-10 right-0 flex">
            {weekDays.map((d, i) => (
              <div key={i} className="flex-1 min-w-0 relative border-l border-gray-100">
                {perDay[i].timed.map(({ e, startMin, endMin, lane, lanes }) => {
                  const top = startMin / 60 * HOURPX
                  const height = Math.max((endMin - startMin) / 60 * HOURPX, 22)
                  const w = 100 / lanes
                  return (
                    <button key={e.id} onClick={() => onOpenEvent(e)} className="absolute rounded px-0.5 py-px text-left overflow-hidden active:opacity-80 transition"
                      style={{ top, height, left: `calc(${lane * w}% + 1px)`, width: `calc(${w}% - 2px)`, background: eventBar(e, childMap) }}>
                      <p className="text-[8px] font-bold text-white leading-[1.05] break-words" style={{ textShadow: '0 1px 1px rgba(0,0,0,.3)' }}>{fmtTimeShort(e._start)} {e.title}</p>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Rich card for all-day events (Day) and the Agenda list — avatars on the right.
function EventCard({ e, childMap, onClick, allDay }: { e: Ev; childMap: ChildMap; onClick: () => void; allDay?: boolean }) {
  const kids = (e.child_ids || []).map(id => childMap[id]).filter(Boolean) as Child[]
  const sub = [allDay ? 'All day' : fmtTime(e._start), e.location ? `📍 ${e.location}` : ''].filter(Boolean).join('  ·  ')
  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl shadow-sm flex items-stretch gap-3 pr-3 overflow-hidden active:scale-[0.98] transition text-left border border-gray-100">
      <span className="w-1.5 flex-shrink-0" style={{ background: eventBar(e, childMap) }} />
      <div className="flex-1 min-w-0 py-2.5">
        <p className="font-bold text-gray-800 text-sm truncate">{e.title}</p>
        <p className="text-xs text-gray-400 truncate">{sub}</p>
      </div>
      {kids.length > 0 && (
        <div className="flex -space-x-1.5 items-center flex-shrink-0">
          {kids.slice(0, 4).map(c => (
            c.avatar_url
              ? <img key={c.id} src={c.avatar_url} className="w-7 h-7 rounded-full object-cover border-2 border-white" alt={c.name} />
              : <div key={c.id} className="w-7 h-7 rounded-full flex items-center justify-center text-[17px] leading-none overflow-hidden bg-white" style={{ border: `2px solid ${c.colour}` }}>{c.avatar}</div>
          ))}
        </div>
      )}
    </button>
  )
}
