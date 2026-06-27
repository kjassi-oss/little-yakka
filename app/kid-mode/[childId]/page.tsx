import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChildTaskView from './ChildTaskView'

// Does a recurring task land on this day? Respects frequency + start date.
function occursOn(task: any, d: Date): boolean {
  const ymd = d.toISOString().split('T')[0]
  const anchorStr = task.start_date || (task.created_at ? String(task.created_at).split('T')[0] : null)
  if (anchorStr && ymd < anchorStr) return false
  const freq = task.frequency || 'daily'
  if (freq === 'daily') return true
  const anchor = anchorStr ? new Date(anchorStr + 'T00:00:00') : d
  if (freq === 'weekly') return d.getDay() === anchor.getDay()
  if (freq === 'monthly') return d.getDate() === anchor.getDate()
  return true
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

  const { data: child } = await supabase
    .from('children').select('*').eq('id', childId).single()
  if (!child) redirect('/kid-mode')

  const { data: guardian } = await supabase
    .from('guardians').select('family_id').eq('auth_user_id', user.id).single()

  const { data: assignments } = await supabase
    .from('task_assignments').select('task_id, tasks(*)').eq('child_id', childId)
  const allTasks = (assignments?.map(a => a.tasks).flat().filter(Boolean) || []) as any[]

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  // Only today's due tasks (frequency + start date aware)
  const tasks = allTasks.filter(t => occursOn(t, now))

  const { data: completions } = await supabase
    .from('completions').select('task_id, status').eq('child_id', childId).eq('date', today)
  const completedTaskIds = completions
    ?.filter(c => c.status === 'approved' || c.status === 'pending')
    .map(c => c.task_id) || []

  const { data: starData } = await supabase
    .from('star_ledger').select('delta').eq('child_id', childId)
  const starBalance = starData?.reduce((sum, r) => sum + r.delta, 0) || 0

  const { data: rewards } = await supabase
    .from('rewards')
    .select('id, title, emoji, star_cost')
    .eq('family_id', guardian?.family_id)
    .or(`scope.eq.family,and(scope.eq.child,child_id.eq.${childId})`)
    .order('star_cost')

  const { data: pendingRedemptions } = await supabase
    .from('redemptions').select('reward_id').eq('child_id', childId).eq('status', 'requested')
  const pendingRewardIds = pendingRedemptions?.map(r => r.reward_id) || []

  // ── Bonus spin: Sundays only, value tiered by the week's performance ──
  const dow = now.getDay() // 0=Sun
  const monday = new Date(now); monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow)); monday.setHours(0, 0, 0, 0)
  const mondayStr = monday.toISOString().split('T')[0]
  const daysSoFar = dow === 0 ? 7 : dow

  let weekExpected = 0
  for (let i = 0; i < daysSoFar; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    allTasks.forEach(t => { if (occursOn(t, d)) weekExpected++ })
  }
  const { count: weekDone } = await supabase
    .from('completions').select('id', { count: 'exact', head: true })
    .eq('child_id', childId).eq('status', 'approved').gte('date', mondayStr)
  const ratio = weekExpected > 0 ? (weekDone || 0) / weekExpected : (weekDone ? 1 : 0)
  const spinTier: 'low' | 'mid' | 'high' = ratio >= 0.85 ? 'high' : ratio >= 0.34 ? 'mid' : 'low'

  const { data: spinToday } = await supabase
    .from('spin_results').select('id').eq('child_id', childId).eq('date', today).maybeSingle()
  const canSpin = dow === 0 && !spinToday // Sundays only

  const { data: unseenPraises } = await supabase
    .from('praises').select('id, message').eq('child_id', childId).eq('seen', false).order('created_at')

  return (
    <ChildTaskView
      child={child}
      tasks={tasks}
      completedTaskIds={completedTaskIds}
      starBalance={starBalance}
      rewards={rewards || []}
      pendingRewardIds={pendingRewardIds}
      canSpin={canSpin}
      spinTier={spinTier}
      unseenPraises={unseenPraises || []}
      highlightTaskId={highlightTaskId || null}
    />
  )
}
