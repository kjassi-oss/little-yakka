'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'
import LoadingLogo from '@/components/LoadingLogo'
import { getCachedFamily } from '@/lib/familyCache'
import { signAvatarUrls } from '@/lib/avatarUrls'
import ConfirmDialog, { type DialogAsk } from '@/components/ConfirmDialog'

// ── Family Calendar (in-app calendar) ────────────────────────────────────────
// Week grid (default) + Month grid + Agenda list, and a full Day view opened by
// tapping any date. Events can be assigned to one or more children — their
// avatars show on the entry and their colours make up the entry's colour bar
// (a gradient when several). Family-scoped by RLS.
//
// PHASE 2 (NOT built — needs inbound-email infrastructure): emailing an invite
// to participants + syncing their RSVP will hang off the family_events table
// (e.g. a future family_event_participants child table). Nothing here assumes it.

interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string | null }

interface FamilyEvent {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  all_day: boolean
  colour: string | null
  notes: string | null
  location: string | null
  child_ids: string[] | null
  created_by?: string | null
}

type Ev = FamilyEvent & { _start: Date; _startDate: string; _endDate: string }

// Brand palette (sampled from the logo — the app's THEMES since 2026-07-16).
const BRAND_COLOURS = [
  { name: 'Teal',      hex: '#06A8B2' },
  { name: 'Purple',    hex: '#62449B' },
  { name: 'Raspberry', hex: '#EC4160' },
  { name: 'Yellow',    hex: '#F8B211' },
  { name: 'Green',     hex: '#5FAD43' },
  { name: 'Blue',      hex: '#0768C3' },
  { name: 'Orange',    hex: '#F69112' },
  { name: 'Navy',      hex: '#0E2473' },
]
const DEFAULT_COLOUR = BRAND_COLOURS[0].hex
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Device-local YYYY-MM-DD (matches chores/page.tsx — avoids the UTC off-by-one
// that toISOString() causes in AEST). Date strings compare lexically.
function ymdLocal(d: Date): string { return new Intl.DateTimeFormat('en-CA').format(d) }
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '')
}
function fmtHour(h: number): string {
  const hr = ((h % 24) + 24) % 24
  if (hr === 0) return '12am'; if (hr === 12) return '12pm'
  return hr < 12 ? `${hr}am` : `${hr - 12}pm`
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function dateAtNoon(iso: string): Date { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0) }
// Monday of the week containing d (matches the app's Mon→Sun week convention).
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

// The colours that represent an event: the assigned children's colours, else
// the event's own colour, else the theme.
function eventColours(e: FamilyEvent, childMap: Record<string, Child>): string[] {
  const kids = (e.child_ids || []).map(id => childMap[id]).filter(Boolean) as Child[]
  return kids.length ? kids.map(k => k.colour || 'var(--theme-from)') : [e.colour || 'var(--theme-from)']
}
function eventBar(e: FamilyEvent, childMap: Record<string, Child>): string {
  const c = eventColours(e, childMap)
  return c.length === 1 ? c[0] : `linear-gradient(180deg, ${c.join(', ')})`
}

// Lay a day's events out for a time-grid: all-day list + timed blocks with
// start/end minutes and overlap lanes, plus the hour window to render.
function layoutDay(evs: Ev[]) {
  const allDay = evs.filter(e => e.all_day)
  const raw = evs.filter(e => !e.all_day).map(e => {
    const s = e._start
    const startMin = s.getHours() * 60 + s.getMinutes()
    const ed = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 30 * 60000)
    let endMin = ed.getHours() * 60 + ed.getMinutes()
    if (ymdLocal(ed) !== ymdLocal(s)) endMin = 24 * 60          // spills past midnight
    if (endMin <= startMin) endMin = Math.min(startMin + 30, 24 * 60)
    return { e, startMin, endMin, lane: 0, lanes: 1 }
  }).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  let startH = 7, endH = 19
  raw.forEach(t => { startH = Math.min(startH, Math.floor(t.startMin / 60)); endH = Math.max(endH, Math.ceil(t.endMin / 60)) })
  startH = Math.max(0, Math.min(startH, 23)); endH = Math.min(24, Math.max(endH, startH + 1))

  // Greedy overlap lanes, cluster by cluster.
  const timed: typeof raw = []
  let cluster: typeof raw = []; let clusterEnd = -1
  const flush = () => {
    const laneEnds: number[] = []
    cluster.forEach(item => {
      let placed = false
      for (let i = 0; i < laneEnds.length; i++) { if (item.startMin >= laneEnds[i]) { item.lane = i; laneEnds[i] = item.endMin; placed = true; break } }
      if (!placed) { item.lane = laneEnds.length; laneEnds.push(item.endMin) }
    })
    cluster.forEach(item => timed.push({ ...item, lanes: laneEnds.length }))
    cluster = []; clusterEnd = -1
  }
  raw.forEach(item => {
    if (cluster.length && item.startMin >= clusterEnd) flush()
    cluster.push(item); clusterEnd = Math.max(clusterEnd, item.endMin)
  })
  if (cluster.length) flush()

  return { allDay, timed, startH, endH }
}

type View = 'week' | 'month' | 'agenda'

export default function CalendarPage() {
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [familyId, setFamilyId] = useState('')
  const [guardianId, setGuardianId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [view, setView] = useState<View>('week')

  const today = new Date()
  const todayStr = ymdLocal(today)
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() }) // month view
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))                 // week view
  const [dayViewDate, setDayViewDate] = useState<string | null>(null)                    // full day page

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

  const childMap = useMemo(() => {
    const m: Record<string, Child> = {}
    children.forEach(c => { m[c.id] = c })
    return m
  }, [children])

  const decorated: Ev[] = useMemo(() => events.map(e => {
    const start = new Date(e.starts_at)
    const startDate = ymdLocal(start)
    let endDate = e.ends_at ? ymdLocal(new Date(e.ends_at)) : startDate
    if (endDate < startDate) endDate = startDate
    return { ...e, _start: start, _startDate: startDate, _endDate: endDate }
  }), [events])

  // Events overlapping a given day (all-day spans included), all-day first.
  function eventsOnDate(dateStr: string): Ev[] {
    return decorated
      .filter(e => e._startDate <= dateStr && dateStr <= e._endDate)
      .sort((a, b) => a.all_day === b.all_day ? a._start.getTime() - b._start.getTime() : (a.all_day ? -1 : 1))
  }

  // ── Month grid ──
  const grid = useMemo(() => {
    const { y, m } = cursor
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const weeks = Math.ceil((firstDow + daysInMonth) / 7)
    const start = new Date(y, m, 1 - firstDow)
    return Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [cursor])
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  function shiftMonth(delta: number) {
    setCursor(c => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  }

  // ── Week grid ──
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6)
    const mon = (d: Date) => d.toLocaleDateString('en-AU', { month: 'short' })
    return weekStart.getMonth() === end.getMonth()
      ? `${weekStart.getDate()}–${end.getDate()} ${mon(end)}`
      : `${weekStart.getDate()} ${mon(weekStart)} – ${end.getDate()} ${mon(end)}`
  }, [weekStart])

  // ── Form ──
  function openNewForm(forDate?: string) {
    setEditingId(null)
    setTitle(''); setAllDay(false)
    setDate(forDate || todayStr)
    setStartTime('09:00'); setEndTime(''); setEndDate('')
    setColour(DEFAULT_COLOUR); setLocation(''); setNotes(''); setAssignedChildren([])
    setFormError(''); setShowForm(true)
  }
  function openEditForm(e: FamilyEvent) {
    setEditingId(e.id)
    setTitle(e.title); setAllDay(e.all_day)
    const s = new Date(e.starts_at)
    setDate(ymdLocal(s))
    setStartTime(e.all_day ? '09:00' : hhmm(s))
    const end = e.ends_at ? new Date(e.ends_at) : null
    setEndTime(e.all_day || !end ? '' : hhmm(end))
    setEndDate(e.all_day && end ? ymdLocal(end) : '')
    setColour(e.colour || DEFAULT_COLOUR)
    setLocation(e.location || ''); setNotes(e.notes || '')
    setAssignedChildren(e.child_ids || [])
    setFormError(''); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditingId(null) }

  async function saveEvent() {
    if (!title.trim()) { setFormError('Please enter an event name.'); return }
    if (!date) { setFormError('Please pick a date.'); return }
    setSaving(true); setFormError('')

    const [y, mo, dd] = date.split('-').map(Number)
    let starts_at: string
    let ends_at: string | null = null
    if (allDay) {
      starts_at = new Date(y, mo - 1, dd, 0, 0, 0).toISOString()
      if (endDate) {
        const [ey, em, ed] = endDate.split('-').map(Number)
        const e = new Date(ey, em - 1, ed, 0, 0, 0)
        if (e.getTime() > new Date(starts_at).getTime()) ends_at = e.toISOString()
      }
    } else {
      const [sh, sm] = startTime.split(':').map(Number)
      starts_at = new Date(y, mo - 1, dd, sh || 0, sm || 0).toISOString()
      if (endTime) {
        const [eh, em] = endTime.split(':').map(Number)
        const e = new Date(y, mo - 1, dd, eh || 0, em || 0)
        if (e.getTime() > new Date(starts_at).getTime()) ends_at = e.toISOString()
      }
    }

    const payload = {
      title: title.trim(), starts_at, ends_at, all_day: allDay, colour,
      location: location.trim() || null, notes: notes.trim() || null,
      child_ids: assignedChildren.length ? assignedChildren : null,
    }
    const supabase = createClient()
    const attempt = (p: Record<string, unknown>) => editingId
      ? supabase.from('family_events').update(p).eq('id', editingId)
      : supabase.from('family_events').insert({ ...p, family_id: familyId, created_by: guardianId })

    // Resilient save: if location/child_ids columns aren't present yet, drop
    // them and save the rest (same pattern as the tasks form).
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
      onConfirm: async () => {
        setConfirmAsk(null)
        await createClient().from('family_events').delete().eq('id', e.id)
        closeForm(); loadData()
      },
    })
  }

  // ── Agenda ──
  const agendaDays = useMemo(() => {
    const upcoming = decorated.filter(e => e._endDate >= todayStr)
    const byDay = new Map<string, Ev[]>()
    for (const e of upcoming) {
      let d = e._startDate < todayStr ? todayStr : e._startDate
      while (d <= e._endDate) {
        if (!byDay.has(d)) byDay.set(d, [])
        byDay.get(d)!.push(e)
        d = ymdLocal(addDays(dateAtNoon(d), 1))
      }
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, evs]) => ({
      day, events: evs.sort((a, b) => a.all_day === b.all_day ? a._start.getTime() - b._start.getTime() : (a.all_day ? -1 : 1)),
    }))
  }, [decorated, todayStr])

  function dayLabel(iso: string): string {
    const tomorrow = ymdLocal(addDays(today, 1))
    if (iso === todayStr) return 'Today'
    if (iso === tomorrow) return 'Tomorrow'
    return dateAtNoon(iso).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  if (pageLoading) return <LoadingLogo />

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Frozen header + view toggle */}
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="pt-14 pb-2.5 px-4 bg-white border-b border-gray-100">
          <div className="max-w-sm lg:max-w-3xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center">
            <img src="/logo.png" alt="Little Yakka" className="h-20 w-auto justify-self-start" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="text-5xl font-black justify-self-center leading-none" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Calendar</span>
            <div className="justify-self-end"><ProfileButton /></div>
          </div>
        </div>
        <div className="bg-white px-4 pt-2.5 pb-2">
          <div className="max-w-sm lg:max-w-3xl mx-auto flex bg-gray-100 rounded-2xl p-1 gap-1">
            {([['week', '🗓️ Week'], ['month', '📅 Month'], ['agenda', '📋 Agenda']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex-1 py-1.5 rounded-xl text-sm font-semibold transition ${view === v ? 'text-white shadow' : 'text-gray-400'}`}
                style={view === v ? { background: 'var(--theme-gradient)' } : {}}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-sm lg:max-w-3xl mx-auto px-4 mt-4 space-y-4">
        {needsMigration && (
          <div className="rounded-2xl p-3 border-2 border-dashed border-amber-300 bg-amber-50">
            <p className="text-sm font-bold text-amber-700">📅 Almost ready</p>
            <p className="text-xs text-amber-600">Run the latest <span className="font-mono">supabase_migration.sql</span> in Supabase to enable the calendar.</p>
          </div>
        )}

        {/* ── WEEK GRID ── 7 day columns; tap a day header to open its full page */}
        {view === 'week' && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => setWeekStart(w => addDays(w, -7))} aria-label="Previous week"
                className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">‹</button>
              <div className="flex items-center gap-2">
                <span className="font-black text-gray-800 text-lg">{weekLabel}</span>
                <button onClick={() => setWeekStart(mondayOf(new Date()))}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 active:scale-95 transition">This week</button>
              </div>
              <button onClick={() => setWeekStart(w => addDays(w, 7))} aria-label="Next week"
                className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">›</button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm p-2 flex gap-1">
              {weekDays.map((d, i) => {
                const ds = ymdLocal(d)
                const isToday = ds === todayStr
                const evs = eventsOnDate(ds)
                return (
                  <div key={ds} className="flex-1 min-w-0">
                    <button onClick={() => setDayViewDate(ds)} className="w-full flex flex-col items-center gap-0.5 mb-1.5 active:scale-95 transition">
                      <span className="text-[10px] font-bold text-gray-400">{WEEKDAYS[i]}</span>
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black ${isToday ? 'text-white' : 'text-gray-700'}`}
                        style={isToday ? { background: 'var(--theme-gradient)' } : {}}>{d.getDate()}</span>
                    </button>
                    <div className="space-y-1">
                      {evs.slice(0, 6).map(e => (
                        <button key={e.id} onClick={() => openEditForm(e)}
                          className="w-full rounded-md px-1 py-0.5 text-left overflow-hidden active:scale-95 transition"
                          style={{ background: eventBar(e, childMap) }}>
                          <p className="text-[9px] font-bold text-white leading-tight truncate" style={{ textShadow: '0 1px 1px rgba(0,0,0,.25)' }}>
                            {e.all_day ? e.title : `${fmtTime(e._start)} ${e.title}`}
                          </p>
                        </button>
                      ))}
                      {evs.length > 6 && <p className="text-[8px] text-gray-400 text-center font-bold">+{evs.length - 6}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-gray-400 text-center">Tap a date to open the full day ⭐</p>
          </>
        )}

        {/* ── MONTH GRID ── tap a day to open its full page */}
        {view === 'month' && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => shiftMonth(-1)} aria-label="Previous month"
                className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">‹</button>
              <div className="flex items-center gap-2">
                <span className="font-black text-gray-800 text-lg">{monthLabel}</span>
                <button onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 active:scale-95 transition">Today</button>
              </div>
              <button onClick={() => shiftMonth(1)} aria-label="Next month"
                className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">›</button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm p-2.5">
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(d => <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {grid.map((d, i) => {
                  const ds = ymdLocal(d)
                  const inMonth = d.getMonth() === cursor.m
                  const isToday = ds === todayStr
                  // Show a dot per assigned-kid colour (or event colour), across the day's events.
                  const dots = eventsOnDate(ds).flatMap(e => eventColours(e, childMap))
                  return (
                    <button key={i} onClick={() => setDayViewDate(ds)}
                      className="aspect-square rounded-xl flex flex-col items-center justify-start pt-1 gap-0.5 transition active:scale-95">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${isToday ? 'text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}
                        style={isToday ? { background: 'var(--theme-gradient)' } : {}}>{d.getDate()}</span>
                      <div className="flex flex-wrap gap-0.5 justify-center items-center max-w-full px-0.5" style={{ minHeight: '6px' }}>
                        {dots.slice(0, 4).map((c, j) => (
                          <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                        ))}
                        {dots.length > 4 && <span className="text-[7px] font-black text-gray-400 leading-none">+</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="text-[11px] text-gray-400 text-center">Tap a date to open the full day ⭐</p>
          </>
        )}

        {/* ── AGENDA ── */}
        {view === 'agenda' && (
          agendaDays.length > 0 ? (
            <div className="space-y-4">
              {agendaDays.map(({ day, events: evs }) => (
                <div key={day}>
                  <button onClick={() => setDayViewDate(day)} className="font-black text-gray-700 text-sm mb-2 px-1 active:opacity-60 transition">{dayLabel(day)} ›</button>
                  <div className="space-y-2">
                    {evs.map(e => <EventRow key={e.id + day} e={e} childMap={childMap} onClick={() => openEditForm(e)} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-gray-500 font-medium">No upcoming events</p>
              <p className="text-gray-400 text-sm mt-1">Tap the + to add one</p>
            </div>
          )
        )}
      </div>

      {/* ── DAY VIEW (full page) ── time grid with all-day strip + assigned kids */}
      {dayViewDate && (
        <DayView
          dateStr={dayViewDate} events={eventsOnDate(dayViewDate)} childMap={childMap}
          onClose={() => setDayViewDate(null)}
          onPrev={() => setDayViewDate(ymdLocal(addDays(dateAtNoon(dayViewDate), -1)))}
          onNext={() => setDayViewDate(ymdLocal(addDays(dateAtNoon(dayViewDate), 1)))}
          onAdd={() => openNewForm(dayViewDate)}
          onOpenEvent={openEditForm}
        />
      )}

      {/* ── Add / Edit form (full-screen) ── */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto">
          <div className="max-w-sm lg:max-w-2xl mx-auto px-4 pt-14 pb-28 space-y-4">
            <div className="relative flex items-center justify-center min-h-[44px]">
              <h2 className="text-4xl font-black leading-none text-center" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{editingId ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={closeForm} aria-label="Close" className="absolute right-0 w-9 h-9 flex items-center justify-center text-3xl leading-none text-gray-400 active:scale-90 transition">×</button>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl flex-shrink-0" style={{ background: colour }} />
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="Event name" />
            </div>

            <div className="rounded-2xl p-3 bg-gray-50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">All day 🗓️</p>
                <p className="text-xs text-gray-400">{allDay ? 'No specific time' : 'Set a start and end time'}</p>
              </div>
              <button onClick={() => setAllDay(v => !v)}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${allDay ? '' : 'bg-gray-200'}`}
                style={allDay ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${allDay ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Date / time — stacked rows so the native inputs never overlap */}
            {allDay ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-2 truncate">Start date</p>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full min-w-0 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-2 truncate">End date (optional)</p>
                  <input type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)}
                    className="w-full min-w-0 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Date</p>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-2">Start time</p>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                      className="w-full min-w-0 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-2">End time</p>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                      className="w-full min-w-0 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                </div>
              </>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-2">📍 Location (optional)</p>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="e.g. Community Pool, 12 Main St" />
            </div>

            {children.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Who's it for? <span className="text-gray-300">(optional — leave blank for a family event)</span></p>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(children.length, 1), 4)}, minmax(0, 1fr))` }}>
                  {children.map(child => {
                    const sel = assignedChildren.includes(child.id)
                    return (
                      <button key={child.id}
                        onClick={() => setAssignedChildren(prev => prev.includes(child.id) ? prev.filter(id => id !== child.id) : [...prev, child.id])}
                        className="flex flex-col items-center gap-1 active:scale-95 transition">
                        {child.avatar_url
                          ? <img src={child.avatar_url} alt={child.name} className={`w-14 h-14 rounded-full object-cover transition ${sel ? '' : 'opacity-40 grayscale'}`}
                              style={{ boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }} />
                          : <div className={`w-14 h-14 rounded-full flex items-center justify-center text-[36px] leading-none overflow-hidden bg-white transition ${sel ? '' : 'opacity-40 grayscale'}`}
                              style={{ border: `2px solid ${child.colour}`, boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}>{child.avatar}</div>}
                        <span className="text-[11px] font-bold truncate max-w-[56px]" style={{ color: sel ? child.colour : '#9ca3af' }}>{child.name.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-2">Event colour <span className="text-gray-300">(used when no child is assigned)</span></p>
              <div className="flex gap-2 flex-wrap">
                {BRAND_COLOURS.map(c => (
                  <button key={c.hex} onClick={() => setColour(c.hex)} aria-label={c.name}
                    className="w-9 h-9 rounded-full active:scale-90 transition"
                    style={{ background: c.hex, boxShadow: colour === c.hex ? `0 0 0 3px white, 0 0 0 5px ${c.hex}` : 'none' }} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Notes (optional)</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                placeholder="Add any details…" />
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <button onClick={closeForm} className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold active:scale-95 transition">Cancel</button>
              <button onClick={saveEvent} disabled={saving}
                className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
                {saving ? 'Saving…' : editingId ? 'Update Event ✓' : 'Save Event ✓'}
              </button>
            </div>
            {editingId && (
              <button onClick={() => { const e = events.find(x => x.id === editingId); if (e) deleteEvent(e) }}
                className="w-full text-red-500 font-semibold py-2.5 rounded-2xl bg-red-50 active:scale-95 transition text-sm">🗑 Delete event</button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog ask={confirmAsk} onClose={() => setConfirmAsk(null)} />

      {!showForm && !dayViewDate && (
        <button onClick={() => openNewForm(todayStr)} aria-label="Add event"
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition z-40"
          style={{ background: 'var(--theme-gradient)' }}>
          <span className="text-3xl leading-none mb-0.5">+</span>
        </button>
      )}
    </div>
  )
}

// Full-screen day page: all-day strip + an hour time-grid with events placed by
// time (overlaps sit side by side), each showing its assigned kids' avatars.
function DayView({ dateStr, events, childMap, onClose, onPrev, onNext, onAdd, onOpenEvent }: {
  dateStr: string; events: Ev[]; childMap: Record<string, Child>
  onClose: () => void; onPrev: () => void; onNext: () => void; onAdd: () => void; onOpenEvent: (e: FamilyEvent) => void
}) {
  const { allDay, timed, startH, endH } = layoutDay(events)
  const HOURPX = 54
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i)
  const heading = dateAtNoon(dateStr).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="fixed inset-0 z-[55] bg-white overflow-y-auto">
      <div className="max-w-sm lg:max-w-2xl mx-auto px-4 pt-14 pb-28">
        <div className="relative flex items-center justify-center min-h-[44px] mb-1">
          <button onClick={onClose} aria-label="Back" className="absolute left-0 w-9 h-9 flex items-center justify-center text-2xl leading-none text-gray-400 active:scale-90 transition">‹</button>
          <span className="text-2xl font-black leading-none text-center" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Day</span>
          <button onClick={onClose} aria-label="Close" className="absolute right-0 w-9 h-9 flex items-center justify-center text-3xl leading-none text-gray-400 active:scale-90 transition">×</button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button onClick={onPrev} aria-label="Previous day" className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">‹</button>
          <p className="font-black text-gray-800">{heading}</p>
          <button onClick={onNext} aria-label="Next day" className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">›</button>
        </div>

        {/* All-day events */}
        {allDay.length > 0 && (
          <div className="space-y-2 mb-4">
            {allDay.map(e => <DayEventCard key={e.id} e={e} childMap={childMap} onClick={() => onOpenEvent(e)} allDay />)}
          </div>
        )}

        {/* Hour time-grid */}
        <div className="relative" style={{ height: (endH - startH) * HOURPX }}>
          {hours.map(h => (
            <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: (h - startH) * HOURPX }}>
              <span className="w-12 text-right pr-2 text-[10px] text-gray-400 -mt-1.5">{fmtHour(h)}</span>
              <div className="flex-1 border-t border-gray-100" />
            </div>
          ))}
          <div className="absolute top-0 bottom-0 left-12 right-0">
            {timed.map(({ e, startMin, endMin, lane, lanes }) => {
              const top = (startMin - startH * 60) / 60 * HOURPX
              const height = Math.max((endMin - startMin) / 60 * HOURPX, 30)
              const widthPct = 100 / lanes
              const kids = (e.child_ids || []).map(id => childMap[id]).filter(Boolean) as Child[]
              return (
                <button key={e.id} onClick={() => onOpenEvent(e)}
                  className="absolute rounded-lg px-2 py-1 text-left overflow-hidden active:scale-[0.98] transition flex flex-col"
                  style={{ top, height, left: `calc(${lane * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, background: eventBar(e, childMap) }}>
                  <p className="text-[11px] font-black text-white leading-tight truncate" style={{ textShadow: '0 1px 1px rgba(0,0,0,.3)' }}>{e.title}</p>
                  <p className="text-[9px] text-white/90 leading-tight truncate">{fmtTime(e._start)}{e.location ? ` · 📍${e.location}` : ''}</p>
                  {kids.length > 0 && (
                    <div className="flex -space-x-1 mt-auto">
                      {kids.slice(0, 4).map(c => (
                        c.avatar_url
                          ? <img key={c.id} src={c.avatar_url} className="w-5 h-5 rounded-full object-cover border border-white" alt={c.name} />
                          : <div key={c.id} className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] leading-none overflow-hidden bg-white border border-white" style={{ borderColor: c.colour }}>{c.avatar}</div>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {allDay.length === 0 && timed.length === 0 && (
          <div className="text-center py-10">
            <div className="text-5xl mb-2">📅</div>
            <p className="text-gray-400 text-sm font-medium">Nothing planned</p>
          </div>
        )}
      </div>

      <button onClick={onAdd} aria-label="Add event"
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition z-[56]"
        style={{ background: 'var(--theme-gradient)' }}>
        <span className="text-3xl leading-none mb-0.5">+</span>
      </button>
    </div>
  )
}

// Rich card used for all-day events in the Day view (and shape reused by agenda).
function DayEventCard({ e, childMap, onClick, allDay }: {
  e: Ev; childMap: Record<string, Child>; onClick: () => void; allDay?: boolean
}) {
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

// Compact event row for the Agenda list.
function EventRow({ e, childMap, onClick }: { e: Ev; childMap: Record<string, Child>; onClick: () => void }) {
  return <DayEventCard e={e} childMap={childMap} onClick={onClick} allDay={e.all_day} />
}
