// Family-wide notification preferences. These live as columns on `families`
// (see supabase_migration.sql section 9) so they apply to every parent's
// device, not just the phone that set them.
//
// EVERY read and write must degrade gracefully: until the migration has been
// run these columns do not exist, and the app must behave exactly as it did
// before they were added — every notification on, reminder in the morning.
// That's why the defaults below are all "on" and why callers treat a failed
// read as "not switched off" rather than "switched off".

export type NotifyKind = 'task_done' | 'reward_redeemed'

export interface NotifyPrefs {
  notify_task_done: boolean
  notify_reward_redeemed: boolean
  notify_daily_reminder: boolean
  daily_reminder_time: string   // 'HH:MM', 24-hour, in the family's timezone
  timezone: string              // IANA name, e.g. 'Australia/Sydney'
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  notify_task_done: true,
  notify_reward_redeemed: true,
  notify_daily_reminder: true,
  daily_reminder_time: '07:00',
  timezone: 'Australia/Sydney',
}

// Selected as one list so that a single failed select tells us the whole
// migration hasn't run, rather than probing column by column.
export const NOTIFY_PREF_COLUMNS =
  'notify_task_done, notify_reward_redeemed, notify_daily_reminder, daily_reminder_time, timezone, last_reminder_on'

// Which column gates which push. Used by /api/push/notify.
export const PREF_COLUMN_FOR: Record<NotifyKind, keyof NotifyPrefs> = {
  task_done: 'notify_task_done',
  reward_redeemed: 'notify_reward_redeemed',
}

/**
 * Normalise a time-ish value to 'HH:MM'. Accepts what Postgres may hand back
 * for either a `text` or a `time` column ('07:00', '07:00:00'), plus null.
 */
export function hhmm(value: unknown, fallback = DEFAULT_NOTIFY_PREFS.daily_reminder_time): string {
  const s = String(value ?? '').trim()
  if (!/^\d{2}:\d{2}/.test(s)) return fallback
  // Some ICU builds render midnight as "24:00" under hour12:false (h24 rather
  // than h23), which would sort after every real time and fire reminders just
  // after midnight. Fold it back to 00:xx.
  return s.startsWith('24:') ? `00:${s.slice(3, 5)}` : s.slice(0, 5)
}
