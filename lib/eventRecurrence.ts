// Repeating family-calendar events.
//
// One row stores the series (the first occurrence plus a rule); the repeats are
// expanded at render time rather than written out as rows. That keeps "change
// the swimming lesson to 4pm" a single UPDATE, and means an event repeating
// "forever" costs one row.
//
// Weekdays are 0=Mon … 6=Sun throughout, matching the calendar's Mon-first grid.

export type RepeatFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RepeatSpec {
  repeat_freq?: RepeatFreq | null
  repeat_interval?: number | null   // every N days/weeks/months/years (default 1)
  repeat_days?: number[] | null     // weekly only: which weekdays, e.g. Mon+Wed+Fri
  repeat_until?: string | null      // YYYY-MM-DD, inclusive; null = no end
  excluded_dates?: string[] | null  // occurrences deleted one at a time
}

// Safety rail: a daily event over a 2-year window is ~730, so this only ever
// bites on absurd input.
const MAX_OCCURRENCES = 1200

function ymd(d: Date): string { return new Intl.DateTimeFormat('en-CA').format(d) }
function atNoon(iso: string): Date { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0) }
// 0=Mon … 6=Sun
function mondayIndex(d: Date): number { return (d.getDay() + 6) % 7 }
// Calendar-day arithmetic that DST can't perturb: map YYYY-MM-DD to a day count
// and back through UTC, where every day is exactly 24 hours long.
function dayNumber(ds: string): number {
  const [y, m, d] = ds.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}
function dateFromDayNumber(n: number): string {
  return new Date(n * 86400000).toISOString().slice(0, 10)
}
/** Whole days from `a` to `b` (negative if b is earlier). DST-proof. */
export function daysBetween(a: string, b: string): number { return dayNumber(b) - dayNumber(a) }
/** YYYY-MM-DD, n days later. DST-proof. */
export function shiftDate(ds: string, n: number): string { return dateFromDayNumber(dayNumber(ds) + n) }

export function hasRepeat(spec: RepeatSpec | null | undefined): boolean {
  return !!spec?.repeat_freq
}

/**
 * Every date this series lands on inside [windowStart, windowEnd], inclusive.
 * `startDate` is the first occurrence — the series never runs before it.
 */
export function occurrenceDates(
  startDate: string,
  spec: RepeatSpec | null | undefined,
  windowStart: string,
  windowEnd: string,
): string[] {
  if (!spec?.repeat_freq) {
    return startDate >= windowStart && startDate <= windowEnd ? [startDate] : []
  }

  const excluded = new Set(spec.excluded_dates || [])
  const hardEnd = spec.repeat_until && spec.repeat_until < windowEnd ? spec.repeat_until : windowEnd
  if (hardEnd < startDate) return []

  const interval = Math.max(1, spec.repeat_interval || 1)
  const out: string[] = []
  const push = (ds: string) => {
    if (ds >= startDate && ds >= windowStart && ds <= hardEnd && !excluded.has(ds)) out.push(ds)
  }

  const first = atNoon(startDate)

  if (spec.repeat_freq === 'daily') {
    // Counted in whole calendar days, not milliseconds: a DST change between the
    // series start and the window makes the elapsed time a non-integer number of
    // days, and rounding that up silently skipped the first occurrence.
    const startDay = dayNumber(startDate)
    const fromDay = dayNumber(windowStart > startDate ? windowStart : startDate)
    let n = Math.max(0, Math.ceil((fromDay - startDay) / interval))
    for (let i = 0; i < MAX_OCCURRENCES; i++, n++) {
      const ds = dateFromDayNumber(startDay + n * interval)
      if (ds > hardEnd) break
      push(ds)
    }
    return out
  }

  if (spec.repeat_freq === 'weekly') {
    // Which weekdays: an explicit pick, or just the day the series started on.
    const days = spec.repeat_days?.length
      ? [...new Set(spec.repeat_days)].filter(d => d >= 0 && d <= 6).sort((a, b) => a - b)
      : [mondayIndex(first)]
    if (!days.length) return []

    // Week blocks are counted from the Monday of the first occurrence's week, so
    // "every 2 weeks on Mon+Thu" stays anchored no matter which day you look at.
    const anchor = new Date(first); anchor.setDate(anchor.getDate() - mondayIndex(first))
    const weekMs = 7 * 86400000
    const fromWeek = atNoon(windowStart > startDate ? windowStart : startDate)
    fromWeek.setDate(fromWeek.getDate() - mondayIndex(fromWeek))
    let block = Math.max(0, Math.round((fromWeek.getTime() - anchor.getTime()) / weekMs))
    block -= block % interval   // snap back to a week the series actually falls on

    for (let i = 0; i < MAX_OCCURRENCES; i++, block += interval) {
      const weekStart = new Date(anchor.getTime() + block * weekMs)
      if (ymd(weekStart) > hardEnd) break
      let pushedAny = false
      for (const wd of days) {
        const d = new Date(weekStart); d.setDate(d.getDate() + wd)
        const ds = ymd(d)
        if (ds > hardEnd) continue
        push(ds); pushedAny = true
      }
      // Past the end and nothing left to add — stop rather than spin to the cap.
      if (!pushedAny && ymd(weekStart) > hardEnd) break
      if (out.length > MAX_OCCURRENCES) break
    }
    return out
  }

  if (spec.repeat_freq === 'monthly') {
    const dayOfMonth = first.getDate()
    let n = 0
    // Skip ahead to roughly the window, then walk.
    const fromDate = atNoon(windowStart > startDate ? windowStart : startDate)
    const monthsApart = (fromDate.getFullYear() - first.getFullYear()) * 12 + (fromDate.getMonth() - first.getMonth())
    n = Math.max(0, monthsApart - (monthsApart % interval))
    for (let i = 0; i < MAX_OCCURRENCES; i++, n += interval) {
      const y = first.getFullYear()
      const d = new Date(y, first.getMonth() + n, 1, 12, 0, 0)
      // The 31st doesn't exist every month — skip those, don't slide into the 1st.
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      if (dayOfMonth > daysInMonth) {
        if (ymd(new Date(d.getFullYear(), d.getMonth(), daysInMonth, 12)) > hardEnd) break
        continue
      }
      d.setDate(dayOfMonth)
      const ds = ymd(d)
      if (ds > hardEnd) break
      push(ds)
    }
    return out
  }

  // yearly
  let n = 0
  const fromDate = atNoon(windowStart > startDate ? windowStart : startDate)
  const yearsApart = fromDate.getFullYear() - first.getFullYear()
  n = Math.max(0, yearsApart - (yearsApart % interval))
  for (let i = 0; i < MAX_OCCURRENCES; i++, n += interval) {
    const d = new Date(first.getFullYear() + n, first.getMonth(), first.getDate(), 12, 0, 0)
    const ds = ymd(d)
    if (ds > hardEnd) break
    push(ds)
  }
  return out
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "Every 2 weeks on Mon, Wed" — the summary shown on the form and event rows. */
export function repeatLabel(spec: RepeatSpec | null | undefined): string {
  if (!spec?.repeat_freq) return 'Never'
  const n = Math.max(1, spec.repeat_interval || 1)
  const every = (unit: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`)

  let base: string
  switch (spec.repeat_freq) {
    case 'daily':   base = every('day'); break
    case 'monthly': base = every('month'); break
    case 'yearly':  base = every('year'); break
    default: {
      base = every('week')
      const days = spec.repeat_days?.length ? [...spec.repeat_days].sort((a, b) => a - b) : []
      if (days.length === 7) base += ' on every day'
      else if (days.length) base += ` on ${days.map(d => WEEKDAY_SHORT[d]).join(', ')}`
    }
  }
  if (spec.repeat_until) {
    const [y, m, d] = spec.repeat_until.split('-').map(Number)
    base += ` until ${new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return base
}
