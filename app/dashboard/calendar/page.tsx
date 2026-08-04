'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'
import LoadingLogo from '@/components/LoadingLogo'
import { getCachedFamily } from '@/lib/familyCache'
import ConfirmDialog, { type DialogAsk } from '@/components/ConfirmDialog'

// ── Family Calendar (Phase 1: in-app calendar) ───────────────────────────────
// A shared per-family calendar of events. Month view (default) + Agenda list,
// add/edit/delete via the themed full-screen form. Family-scoped by RLS.
//
// PHASE 2 (NOT built — needs inbound-email infrastructure): emailing an invite
// to participants + syncing their RSVP will hang off the family_events table
// (e.g. a future family_event_participants child table). Nothing here assumes it.

interface FamilyEvent {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  all_day: boolean
  colour: string | null
  notes: string | null
  created_by?: string | null
}

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

type View = 'month' | 'agenda'

export default function CalendarPage() {
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const [familyId, setFamilyId] = useState('')
  const [guardianId, setGuardianId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [view, setView] = useState<View>('month')

  const today = new Date()
  const todayStr = ymdLocal(today)
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() }) // m: 0-indexed
  const [selectedDate, setSelectedDate] = useState(todayStr)

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
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [confirmAsk, setConfirmAsk] = useState<DialogAsk | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const fam = await getCachedFamily(supabase)
    if (!fam) return
    setFamilyId(fam.familyId)

    const [{ data: eventsData, error }, { data: guardian }] = await Promise.all([
      supabase.from('family_events').select('*').eq('family_id', fam.familyId).order('starts_at'),
      supabase.from('guardians').select('id').eq('auth_user_id', fam.userId).maybeSingle(),
    ])
    // Table won't exist until the migration is run in Supabase — degrade to an
    // empty calendar with a gentle hint rather than crashing.
    if (error) { setNeedsMigration(true); setEvents([]) }
    else setEvents((eventsData as FamilyEvent[]) || [])
    setGuardianId(guardian?.id || null)
    setPageLoading(false)
  }

  // Decorate each event with its local start/end date + parsed start Date, so
  // month dots and day lists can be computed with cheap string comparisons.
  const decorated = useMemo(() => events.map(e => {
    const start = new Date(e.starts_at)
    const startDate = ymdLocal(start)
    let endDate = e.ends_at ? ymdLocal(new Date(e.ends_at)) : startDate
    if (endDate < startDate) endDate = startDate
    return { ...e, _start: start, _startDate: startDate, _endDate: endDate }
  }), [events])

  type DecoratedEvent = typeof decorated[number]

  // Events overlapping a given day (all-day spans included), all-day first.
  function eventsOnDate(dateStr: string): DecoratedEvent[] {
    return decorated
      .filter(e => e._startDate <= dateStr && dateStr <= e._endDate)
      .sort((a, b) =>
        a.all_day === b.all_day ? a._start.getTime() - b._start.getTime() : (a.all_day ? -1 : 1))
  }

  // Month grid: Mon→Sun weeks (matches the app's week convention).
  const grid = useMemo(() => {
    const { y, m } = cursor
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7 // Mon = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const weeks = Math.ceil((firstDow + daysInMonth) / 7)
    const start = new Date(y, m, 1 - firstDow)
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d
    })
  }, [cursor])

  const monthLabel = new Date(cursor.y, cursor.m, 1)
    .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  function shiftMonth(delta: number) {
    setCursor(c => {
      const d = new Date(c.y, c.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }
  function goToday() {
    setCursor({ y: today.getFullYear(), m: today.getMonth() })
    setSelectedDate(todayStr)
  }

  // ── Form ──
  function openNewForm(forDate?: string) {
    setEditingId(null)
    setTitle(''); setAllDay(false)
    setDate(forDate || selectedDate || todayStr)
    setStartTime('09:00'); setEndTime(''); setEndDate('')
    setColour(DEFAULT_COLOUR); setNotes('')
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
    setNotes(e.notes || '')
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

    const payload = { title: title.trim(), starts_at, ends_at, all_day: allDay, colour, notes: notes.trim() || null }
    const supabase = createClient()
    const { error } = editingId
      ? await supabase.from('family_events').update(payload).eq('id', editingId)
      : await supabase.from('family_events').insert({ ...payload, family_id: familyId, created_by: guardianId })

    if (error) { setFormError(error.message || 'Failed to save.'); setSaving(false); return }
    setSaving(false)
    setSelectedDate(date)
    closeForm(); loadData()
  }

  function deleteEvent(e: FamilyEvent) {
    setConfirmAsk({
      emoji: '🗑',
      title: `Delete "${e.title}"?`,
      sub: 'This removes it from the family calendar.',
      danger: true, confirmLabel: 'Delete', cancelLabel: 'Keep it',
      onConfirm: async () => {
        setConfirmAsk(null)
        await createClient().from('family_events').delete().eq('id', e.id)
        closeForm(); loadData()
      },
    })
  }

  // ── Agenda: upcoming + ongoing events, grouped by day ──
  const agendaDays = useMemo(() => {
    const upcoming = decorated.filter(e => e._endDate >= todayStr)
    const byDay = new Map<string, DecoratedEvent[]>()
    for (const e of upcoming) {
      // A multi-day event appears on each of its days from today onward.
      let d = e._startDate < todayStr ? todayStr : e._startDate
      while (d <= e._endDate) {
        if (!byDay.has(d)) byDay.set(d, [])
        byDay.get(d)!.push(e)
        const nx = new Date(d + 'T00:00:00'); nx.setDate(nx.getDate() + 1); d = ymdLocal(nx)
      }
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, evs]) => ({
      day,
      events: evs.sort((a, b) => a.all_day === b.all_day ? a._start.getTime() - b._start.getTime() : (a.all_day ? -1 : 1)),
    }))
  }, [decorated, todayStr])

  function dayLabel(iso: string): string {
    const tomorrow = ymdLocal(new Date(Date.now() + 86400000))
    if (iso === todayStr) return 'Today'
    if (iso === tomorrow) return 'Tomorrow'
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  const selectedEvents = eventsOnDate(selectedDate)

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
            {([['month', '📅 Month'], ['agenda', '📋 Agenda']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex-1 py-1.5 rounded-xl text-sm font-semibold transition ${view === v ? 'text-white shadow' : 'text-gray-400'}`}
                style={view === v ? { background: 'var(--theme-gradient)' } : {}}>
                {label}
              </button>
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

        {/* ── MONTH VIEW ── */}
        {view === 'month' && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => shiftMonth(-1)} aria-label="Previous month"
                className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">‹</button>
              <div className="flex items-center gap-2">
                <span className="font-black text-gray-800 text-lg">{monthLabel}</span>
                <button onClick={goToday}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 active:scale-95 transition">Today</button>
              </div>
              <button onClick={() => shiftMonth(1)} aria-label="Next month"
                className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xl active:scale-90 transition">›</button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm p-2.5">
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {grid.map((d, i) => {
                  const ds = ymdLocal(d)
                  const inMonth = d.getMonth() === cursor.m
                  const isToday = ds === todayStr
                  const isSelected = ds === selectedDate
                  const dots = eventsOnDate(ds)
                  return (
                    <button key={i} onClick={() => setSelectedDate(ds)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-start pt-1 gap-0.5 transition active:scale-95 ${isSelected ? 'bg-gray-100' : ''}`}>
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${isToday ? 'text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}
                        style={isToday ? { background: 'var(--theme-gradient)' } : {}}>
                        {d.getDate()}
                      </span>
                      <div className="flex gap-0.5 h-1.5 items-center">
                        {dots.slice(0, 3).map(e => (
                          <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: e.colour || 'var(--theme-from)' }} />
                        ))}
                        {dots.length > 3 && <span className="text-[7px] font-black text-gray-400 leading-none">+</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected day's events */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="font-bold text-gray-700">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <button onClick={() => openNewForm(selectedDate)}
                  className="text-xs font-bold px-3 py-1.5 rounded-full text-white active:scale-95 transition"
                  style={{ background: 'var(--theme-gradient)' }}>+ Add</button>
              </div>
              {selectedEvents.length > 0 ? (
                <div className="space-y-2">
                  {selectedEvents.map(e => <EventRow key={e.id} e={e} onClick={() => openEditForm(e)} />)}
                </div>
              ) : (
                <div className="text-center py-8 bg-white rounded-3xl shadow-sm">
                  <div className="text-4xl mb-2">📅</div>
                  <p className="text-gray-400 text-sm font-medium">Nothing planned</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── AGENDA VIEW ── */}
        {view === 'agenda' && (
          agendaDays.length > 0 ? (
            <div className="space-y-4">
              {agendaDays.map(({ day, events: evs }) => (
                <div key={day}>
                  <p className="font-black text-gray-700 text-sm mb-2 px-1">{dayLabel(day)}</p>
                  <div className="space-y-2">
                    {evs.map(e => <EventRow key={e.id + day} e={e} onClick={() => openEditForm(e)} />)}
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

      {/* ── Add / Edit form (full-screen) ── */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto">
          <div className="max-w-sm lg:max-w-2xl mx-auto px-4 pt-14 pb-28 space-y-4">
            <div className="relative flex items-center justify-center min-h-[44px]">
              <h2 className="text-4xl font-black leading-none text-center" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{editingId ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={closeForm} aria-label="Close" className="absolute right-0 w-9 h-9 flex items-center justify-center text-3xl leading-none text-gray-400 active:scale-90 transition">×</button>
            </div>

            {/* Title with a colour chip beside it */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl flex-shrink-0" style={{ background: colour }} />
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="Event name" />
            </div>

            {/* All day toggle */}
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

            {/* Date + time */}
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-2 text-center truncate">{allDay ? 'Start date' : 'Date'}</p>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full min-w-0 border border-gray-200 rounded-2xl px-2 py-2.5 text-sm text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              {allDay ? (
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-2 text-center truncate">End date (optional)</p>
                  <input type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)}
                    className="w-full min-w-0 border border-gray-200 rounded-2xl px-2 py-2.5 text-sm text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              ) : (
                <div className="min-w-0 grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-2 text-center truncate">Start</p>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                      className="w-full min-w-0 border border-gray-200 rounded-2xl px-1 py-2.5 text-sm text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-2 text-center truncate">End</p>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                      className="w-full min-w-0 border border-gray-200 rounded-2xl px-1 py-2.5 text-sm text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Colour picker */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Colour</p>
              <div className="flex gap-2 flex-wrap">
                {BRAND_COLOURS.map(c => (
                  <button key={c.hex} onClick={() => setColour(c.hex)} aria-label={c.name}
                    className="w-9 h-9 rounded-full active:scale-90 transition"
                    style={{ background: c.hex, boxShadow: colour === c.hex ? `0 0 0 3px white, 0 0 0 5px ${c.hex}` : 'none' }} />
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Notes (optional)</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                placeholder="Add any details…" />
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <button onClick={closeForm}
                className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold active:scale-95 transition">Cancel</button>
              <button onClick={saveEvent} disabled={saving}
                className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
                {saving ? 'Saving…' : editingId ? 'Update Event ✓' : 'Save Event ✓'}
              </button>
            </div>
            {editingId && (
              <button onClick={() => { const e = events.find(x => x.id === editingId); if (e) deleteEvent(e) }}
                className="w-full text-red-500 font-semibold py-2.5 rounded-2xl bg-red-50 active:scale-95 transition text-sm">
                🗑 Delete event
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog ask={confirmAsk} onClose={() => setConfirmAsk(null)} />

      {/* Add FAB */}
      {!showForm && (
        <button onClick={() => openNewForm()} aria-label="Add event"
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition z-40"
          style={{ background: 'var(--theme-gradient)' }}>
          <span className="text-3xl leading-none mb-0.5">+</span>
        </button>
      )}
    </div>
  )
}

// A single event row — colour bar + time + title, tap to edit.
function EventRow({ e, onClick }: { e: FamilyEvent & { _start: Date }; onClick: () => void }) {
  const time = e.all_day ? 'All day' : fmtTime(e._start)
  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-2xl shadow-sm flex items-stretch gap-3 pr-3 overflow-hidden active:scale-[0.98] transition text-left">
      <span className="w-1.5 flex-shrink-0" style={{ background: e.colour || 'var(--theme-from)' }} />
      <div className="flex-1 min-w-0 py-2.5">
        <p className="font-bold text-gray-800 text-sm truncate">{e.title}</p>
        <p className="text-xs text-gray-400">{time}{e.notes ? ` · ${e.notes}` : ''}</p>
      </div>
      <span className="self-center text-gray-300 text-lg">›</span>
    </button>
  )
}
