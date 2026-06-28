import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChildTaskView from './ChildTaskView'
import { occursOn, mondayOf, ymd } from '@/lib/recurrence'

function ratioToTier(done: number, expected: number): 'low' | 'mid' | 'high' {
  const r = expected > 0 ? done / expected : (done ? 1 : 0)
  return r >= 0.85 ? 'high' : r >= 0.34 ? 'mid' : 'low'
}

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
  const horizonEnd = new Date(monday); horizonEnd.setDate(monday.getDate() + 20) // 3 weeks
  const horizonEndStr = ymd(horizonEnd)

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
    .gte('date', ymd(monday)).lte('date', horizonEndStr)
  const completedKeys = (completions || []).map(c => `${c.task_id}|${c.date}`)

  const { data: starData } = await supabase.from('star_ledger').select('delta').eq('child_id', childId)
  const starBalance = starData?.reduce((sum, r) => sum + r.delta, 0) || 0

  const { data: rewards } = await supabase
    .from('rewards').select('id, title, emoji, star_cost').eq('family_id', guardian?.family_id)
    .or(`scope.eq.family,and(scope.eq.child,child_id.eq.${childId})`).order('star_cost')
  const { data: pendingRedemptions } = await supabase
    .from('redemptions').select('reward_id').eq('child_id', childId).eq('status', 'requested')
  const pendingRewardIds = pendingRedemptions?.map(r => r.reward_id) || []

  // ── Bonus wheel availability (family-configured) ──
  const cadence = family?.bonus_cadence || 'weekly'
  const bonusDay = family?.bonus_day ?? 0 // 0 = Sunday
  const bonusTime = family?.bonus_time || '16:00'
  const nowHHMM = now.toTimeString().slice(0, 5)
  const dueToday = cadence === 'daily' || now.getDay() === bonusDay
  const timeOk = nowHHMM >= bonusTime
  const { data: spinToday } = await supabase
    .from('spin_results').select('id').eq('child_id', childId).eq('date', todayStr).maybeSingle()
  const canSpin = dueToday && timeOk && !spinToday

  // Tier from progress up to now (weekly cadence → this week; daily → today)
  let tierDone = 0, tierExpected = 0
  if (cadence === 'daily') {
    tierExpected = allTasks.filter(t => occursOn(t, now)).length
    tierDone = (completions || []).filter(c => c.date === todayStr).length
  } else {
    for (let d = new Date(monday); d <= now; d.setDate(d.getDate() + 1)) {
      tierExpected += allTasks.filter(t => occursOn(t, d)).length
    }
    tierDone = (completions || []).filter(c => c.date >= ymd(monday) && c.date <= todayStr).length
  }
  const spinTier = ratioToTier(tierDone, tierExpected)
  const bonusLabel = cadence === 'daily' ? `daily from ${bonusTime}` : `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][bonusDay]} from ${bonusTime}`

  const { data: unseenPraises } = await supabase
    .from('praises').select('id, message').eq('child_id', childId).eq('seen', false).order('created_at')

  return (
    <ChildTaskView
      child={child}
      occurrences={occurrences}
      completedKeys={completedKeys}
      weekEndStr={weekEndStr}
      todayStr={todayStr}
      starBalance={starBalance}
      rewards={rewards || []}
      pendingRewardIds={pendingRewardIds}
      canSpin={canSpin}
      spinTier={spinTier}
      bonusLabel={bonusLabel}
      unseenPraises={unseenPraises || []}
      highlightTaskId={highlightTaskId || null}
    />
  )
}
