import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ChildTaskView from './ChildTaskView'
import { occursOn, mondayOf, ymd } from '@/lib/recurrence'
import { localNow, localDateStr, parseTzCookie } from '@/lib/localDate'

export default async function ChildPage({ params, searchParams }: {
  params: Promise<{ childId: string }>
  searchParams: Promise<{ task?: string; spin?: string }>
}) {
  const { childId } = await params
  const { task: highlightTaskId, spin: autoSpin } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: child } = await supabase.from('children').select('*').eq('id', childId).single()
  if (!child) redirect('/kid-mode')

  const { data: guardian } = await supabase
    .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
  const { data: family } = await supabase
    .from('families').select('*').eq('id', guardian?.family_id).maybeSingle()

  // Timezone-aware dates
  const cookieStore = await cookies()
  const tz = parseTzCookie(cookieStore.get('tz')?.value)
  const now = localNow(tz)
  const todayStr = localDateStr(new Date(), tz)
  const monday = mondayOf(now)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const weekEndStr = ymd(sunday)
  const mondayStr = ymd(monday)
  const horizonEnd = new Date(monday); horizonEnd.setDate(monday.getDate() + 20)

  const { data: assignments } = await supabase
    .from('task_assignments').select('task_id, tasks(*)').eq('child_id', childId)
  const allTasks = (assignments?.map(a => a.tasks).flat().filter(Boolean) || []) as any[]

  // Build occurrences from this Monday through 3-week horizon
  const occurrences: any[] = []
  for (let d = new Date(monday); d <= horizonEnd; d.setDate(d.getDate() + 1)) {
    const ds = ymd(d)
    for (const t of allTasks) {
      if (occursOn(t, d)) {
        occurrences.push({
          id: `${t.id}|${ds}`, taskId: t.id, title: t.title, emoji: t.emoji,
          star_value: t.star_value, time_of_day: t.time_of_day ?? null, date: ds,
          canDoEarly: (t as any).can_do_early ?? true,
        })
      }
    }
  }

  const { data: completions } = await supabase
    .from('completions').select('task_id, date, created_at').eq('child_id', childId)
    .gte('date', mondayStr).lte('date', ymd(horizonEnd))
  const completedKeys = (completions || []).map(c => `${c.task_id}|${c.date}`)

  // Completed history (last 30 days) for the "Done" tab — with timestamps
  const thirtyAgo = new Date(now); thirtyAgo.setDate(now.getDate() - 30)
  const { data: completedHistory } = await supabase
    .from('completions')
    .select('task_id, date, created_at, tasks(title, emoji, star_value)')
    .eq('child_id', childId)
    .eq('status', 'approved')
    .gte('date', ymd(thirtyAgo))
    .order('created_at', { ascending: false })
    .limit(60)
  const doneHistory = (completedHistory || []).map(c => ({
    key: `${c.task_id}|${c.date}`,
    date: c.date as string,
    createdAt: c.created_at as string,
    title: (c.tasks as any)?.title || '',
    emoji: (c.tasks as any)?.emoji || '⭐',
    starValue: (c.tasks as any)?.star_value || 0,
  }))

  const { data: starData } = await supabase.from('star_ledger').select('delta').eq('child_id', childId)
  const starBalance = starData?.reduce((sum, r) => sum + r.delta, 0) || 0

  const { data: rewards } = await supabase
    .from('rewards').select('id, title, emoji, star_cost').eq('family_id', guardian?.family_id)
    .or(`scope.eq.family,and(scope.eq.child,child_id.eq.${childId})`).order('star_cost')
  const { data: pendingRedemptions } = await supabase
    .from('redemptions').select('reward_id').eq('child_id', childId).eq('status', 'requested')
  const pendingRewardIds = pendingRedemptions?.map(r => r.reward_id) || []

  // Streak
  let streakDays = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const ds = localDateStr(d, tz)
    const tasksOnDay = allTasks.filter((t: any) => occursOn(t, d))
    if (tasksOnDay.length === 0) continue
    const doneOnDay = (completions || []).filter(c => c.date === ds).length
    if (doneOnDay >= tasksOnDay.length) streakDays++
    else if (i === 0) continue
    else break
  }

  // Bonus wheel cadence + award value
  const cadence = family?.bonus_cadence || 'weekly'
  const isDaily = cadence === 'daily'
  // Award ceiling = this % of the period's available stars (slider in Settings, default 50%)
  const awardPct = ((family as any)?.bonus_award_pct ?? 50) / 100

  // Prize period: the day (daily cadence) or the Mon–Sun week (weekly cadence)
  const prizeStart = isDaily ? new Date(now) : new Date(monday)
  const prizeEnd = isDaily ? new Date(now) : new Date(sunday)
  const prizeStartStr = ymd(prizeStart)

  let periodTotalStars = 0
  for (let d = new Date(prizeStart); ymd(d) <= ymd(prizeEnd); d.setDate(d.getDate() + 1)) {
    for (const t of allTasks) {
      if (occursOn(t, d)) periodTotalStars += t.star_value
    }
  }
  let tierExpected = 0
  for (let d = new Date(prizeStart); ymd(d) <= todayStr; d.setDate(d.getDate() + 1)) {
    for (const t of allTasks) {
      if (occursOn(t, d)) tierExpected++
    }
  }
  const tierDone = (completions || []).filter(c => c.date >= prizeStartStr && c.date <= todayStr).length
  const completionRatio = tierExpected > 0 ? tierDone / tierExpected : 0

  // Ceiling scales with the award-value slider; performance scales within the ceiling.
  const ceiling = Math.round(periodTotalStars * awardPct)
  let maxPrize = 1
  if (periodTotalStars === 0) {
    maxPrize = 1
  } else if (completionRatio >= 0.8) {
    maxPrize = Math.max(1, ceiling)
  } else if (completionRatio >= 0.5) {
    maxPrize = Math.max(2, Math.round(ceiling * 0.6))
  } else if (completionRatio > 0) {
    maxPrize = Math.max(1, Math.round(ceiling * 0.3))
  } else {
    maxPrize = 1
  }

  // Bonus wheel timing
  const bonusDay = family?.bonus_day ?? 0
  const bonusTime = (family?.bonus_time || '16:00').toString().slice(0, 5)
  const { data: spinToday } = await supabase
    .from('spin_results').select('id').eq('child_id', childId).eq('date', todayStr).maybeSingle()
  const hasSpunToday = !!spinToday

  const { data: unseenPraises } = await supabase
    .from('praises').select('id, message').eq('child_id', childId).eq('seen', false).order('created_at')

  return (
    <ChildTaskView
      child={child}
      occurrences={occurrences}
      completedKeys={completedKeys}
      weekEndStr={weekEndStr}
      mondayStr={mondayStr}
      todayStr={todayStr}
      starBalance={starBalance}
      rewards={rewards || []}
      pendingRewardIds={pendingRewardIds}
      hasSpunToday={hasSpunToday}
      bonusCadence={cadence as 'daily' | 'weekly'}
      bonusDay={bonusDay}
      bonusTime={bonusTime}
      maxPrize={maxPrize}
      streakDays={streakDays}
      doneHistory={doneHistory}
      unseenPraises={unseenPraises || []}
      highlightTaskId={highlightTaskId || null}
      autoSpin={autoSpin === '1'}
    />
  )
}
