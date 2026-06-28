// Timezone-aware date utilities for server components.
// Vercel runs in UTC; users may be in any timezone (default: Sydney AEST).

const DEFAULT_TZ = 'Australia/Sydney'

/**
 * Returns "YYYY-MM-DD" in the given timezone (not UTC).
 */
export function localDateStr(d: Date, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)
}

/**
 * Returns a Date whose getFullYear/getMonth/getDate/getDay values all
 * correspond to "right now" in the given timezone, even though the JS
 * Date is technically midnight UTC on that calendar date.
 *
 * Safe to pass to occursOn() and mondayOf() because those functions only
 * use getDay(), getDate(), toISOString().split('T')[0], all of which
 * return the expected local values when the Date is constructed this way.
 */
export function localNow(tz: string = DEFAULT_TZ): Date {
  const ds = localDateStr(new Date(), tz)
  const [y, m, day] = ds.split('-').map(Number)
  return new Date(y, m - 1, day, 12, 0, 0)  // noon — avoids DST edge cases
}

/**
 * Accepts either:
 *   - the raw cookie value string (from next/headers cookies().get('tz')?.value)
 *   - a full document.cookie string (from client-side document.cookie, used for debugging)
 * Returns DEFAULT_TZ if nothing is set.
 */
export function parseTzCookie(raw: string | undefined): string {
  if (!raw) return DEFAULT_TZ
  // If it contains 'tz=' it's a full cookie string; parse it
  if (raw.includes('tz=')) {
    const match = raw.split(';').find(s => s.trim().startsWith('tz='))
    return match ? decodeURIComponent(match.trim().slice(3)) : DEFAULT_TZ
  }
  // Otherwise it's already just the value
  return decodeURIComponent(raw)
}
