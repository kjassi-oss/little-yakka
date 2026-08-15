// Day-grouping for the family calendar's list views.
//
// The Agenda tab and the Week tab render the SAME list — identical day headings
// and EventCard rows. They differ only in the window they cover: Agenda takes
// everything from today onwards, Week takes the Monday–Sunday being viewed. So
// there is one grouping function, and the caller supplies the window.
//
// Input is already-expanded occurrences (see lib/eventRecurrence.ts) — a
// repeating series arrives as one entry per occurrence, so repeats group exactly
// like one-off events do.

import { shiftDate } from './eventRecurrence'

/** The minimum an occurrence needs to be grouped and ordered. */
export interface DayGroupable {
  _startDate: string   // YYYY-MM-DD, this occurrence's first day
  _endDate: string     // YYYY-MM-DD, its last day (same as _startDate unless multi-day)
  _start: Date
  all_day: boolean
}

export interface DayGroup<T> { day: string; events: T[] }

/**
 * Bucket occurrences by calendar day, clipped to [from, to].
 *
 * `to` of null means "no upper bound" (the Agenda case). A multi-day event
 * appears under every day it covers within the window, so a Wed–Fri camp shows
 * on Wed, Thu and Fri — and shows on just Fri if the window starts there.
 * Within a day, all-day events sort first, then by start time.
 */
export function groupByDay<T extends DayGroupable>(
  evs: T[],
  from: string,
  to: string | null,
): DayGroup<T>[] {
  const byDay = new Map<string, T[]>()
  for (const e of evs) {
    if (e._endDate < from) continue
    if (to && e._startDate > to) continue
    const last = to && to < e._endDate ? to : e._endDate
    let d = e._startDate < from ? from : e._startDate
    while (d <= last) {
      if (!byDay.has(d)) byDay.set(d, [])
      byDay.get(d)!.push(e)
      d = shiftDate(d, 1)
    }
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, dayEvents]) => ({
      day,
      events: dayEvents.sort((a, b) =>
        a.all_day === b.all_day ? a._start.getTime() - b._start.getTime() : (a.all_day ? -1 : 1)),
    }))
}
