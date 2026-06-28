import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChildTaskView from './ChildTaskView'
import { occursOn, mondayOf, ymd } from '@/lib/recurrence'

export default async function ChildPage({ params, searchParams }: {
  params: Promise<{ childId: string }>
  searchParams: Promise<{ task?: string }>
}) {
  const { childId } = await params
  const { task: highlightTaskId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: child } = await supabase.from('children').select('*').eq('id', childId).single()
  if (!child) redirect('/kid-mode')

  const { data: guardian } = await supabase
    .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
  const { data: family } = await supabase
    .from('families').select('bonus_cadence, bonus_day, bonus_time').eq('id', guardian?.family_id).maybeSingle()

  const { data: assignments } = await supabase
    .from('task_assignments').select('task_id, tasks(*)').eq('child_id', childId)
  const allTasks = (assignments?.map(a => a.tasks).flat().filter(Boolean) || []) as any[]

  const now = new Date()
  const todayStr = ymd(now)
  const monday = mondayOf(now)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const weekEndStr = ymd(sunday)
  const mondayStr = ymd(monday)
  const horizonEnd = new Date(monday); horizonEnd.setDate(monday.getDate() + 20) // 3 weeks

  // Build occurrences from this Monday through the horizon
  const occurrences: any[] = []
  for (let d = new Date(monday); d <= horizonEnd; d.setDate(d.getDate() + 1)) {
    const ds = ymd(d)
    for (const t of allTasks) {
      if (occursOn(t, d)) {
        occurrences.push({
          id: `${t.id}|${ds}`, taskId: t.id, title: t.title, emoji: t.emoji,
          star_value: t.star_value, time_of_day: t.time_of_day ?? null, date: ds,
        })
      }
    }
  }

  const { data: completions } = await supabase
    .from('completions').select('task_id, date').eq('child_id', childId)
    .gte('date', mondayStr).lte('date', ymd(horizonEnd))
  const completedKeys = (completions || []).map(c => `${c.task_id}|${c.date}`)

  const { data: starData } = await supabase.from('star_ledger').select('delta').eq('child_id', childId)
  const starBalance = starData?.reduce((sum, r) => sum + r.delta, 0) || 0

  const { data: rewards } = await supabase
    .from('rewards').select('id, title, emoji, star_cost').eq('family_id', guardian?.family_id)
    .or(`scope.eq.family,and(scope.eq.child,child_id.eq.${childId})`).order('star_cost')
  const { data: pendingRedemptions } = await supabase
    .from('redemptions').select('reward_id').eq('child_id', childId).eq('status', 'requested')
  const pendingRewardIds = pendingRedemptions?.map(r => r.reward_id) || []

  // ── Streak calculation ──
  let streakDays = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const ds = ymd(d)
    const tasksOnDay = allTasks.filter((t: any) => occursOn(t, d))
    if (tasksOnDay.length === 0) continue
    const doneOnDay = (completions || []).filter(c => c.date === ds).length
    if (doneOnDay >= tasksOnDay.length) streakDays++
    else if (i === 0) continue // today still in progress
    else break
  }

  // ── Wheel prize tier ──
  // weekTotalStars = sum of all star values for tasks occurring this week
  let weekTotalStars = 0
  for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
    for (const t of allTasks) {
      if (occursOn(t, d)) weekTotalStars += t.star_value
    }
  }
  // completionRatio = tasks done so far this week / tasks expected so far this week
  let tierDone = 0, tierExpected = 0
  for (let d = new Date(monday); ymd(d) <= todayStr; d.setDate(d.getDate() + 1)) {
    for (const t of allTasks) {
      if (occursOn(t, d)) tierExpected++
    }
  }
  tierDone = (completions || []).filter(c => c.date >= mondayStr && c.date <= todayStr).length
  const completionRatio = tierExpected > 0 ? tierDone / tierExpected : 0

  // Scale max prize: 0%→1, 1-50%→25% of week total, 51-80%→45%, >80%→100%
  let maxPrize = 1
  if (weekTotalStars === 0) {
    maxPrize = 1
  } else if (completionRatio >= 0.8) {
    maxPrize = weekTotalStars
  } else if (completionRatio >= 0.5) {
    maxPrize = Math.max(3, Math.round(weekTotalStars * 0.45))
  } else if (completionRatio > 0) {
    maxPrize = Math.max(2, Math.round(weekTotalStars * 0.25))
  } else {
    maxPrize = 1
  }

  // ── Bonus wheel availability ──
  const cadence = family?.bonus_cadence || 'weekly'
  const bonusDay = family?.bonus_day ?? 0
  const bonusTime = (family?.bonus_time || '16:00').toString().slice(0, 5)

  // hasSpunToday is passed to client; canSpin is computed client-side using LOCAL time
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
      unseenPraises={unseenPraises || []}
      highlightTaskId={highlightTaskId || null}
    />
  )
}
