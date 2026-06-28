// Shared task-recurrence logic used by home, kid zone and calendar.
// Respects frequency, start date, and (for daily) selected days of week.

export interface RecurringTask {
  frequency?: 'daily' | 'weekly' | 'monthly' | null
  start_date?: string | null
  created_at?: string | null
  days_of_week?: number[] | null // 0=Sun … 6=Sat; null/empty = every day
}

export function occursOn(task: RecurringTask, d: Date): boolean {
  const ymd = d.toISOString().split('T')[0]
  const anchorStr = task.start_date || (task.created_at ? String(task.created_at).split('T')[0] : null)
  if (anchorStr && ymd < anchorStr) return false

  const freq = task.frequency || 'daily'
  if (freq === 'daily') {
    const dows = task.days_of_week
    if (dows && dows.length > 0) return dows.includes(d.getDay())
    return true
  }
  const anchor = anchorStr ? new Date(anchorStr + 'T00:00:00') : d
  if (freq === 'weekly') return d.getDay() === anchor.getDay()
  if (freq === 'monthly') return d.getDate() === anchor.getDate()
  return true
}

// Monday (00:00) of the week containing d
export function mondayOf(d: Date): Date {
  const m = new Date(d)
  const dow = m.getDay()
  m.setDate(m.getDate() + (dow === 0 ? -6 : 1 - dow))
  m.setHours(0, 0, 0, 0)
  return m
}

export function ymd(d: Date): string {
  return d.toISOString().split('T')[0]
}
