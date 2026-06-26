import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChildTaskView from './ChildTaskView'

export default async function ChildPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: child } = await supabase
    .from('children').select('*').eq('id', childId).single()
  if (!child) redirect('/kid-mode')

  const { data: guardian } = await supabase
    .from('guardians').select('parent_pin, family_id').eq('auth_user_id', user.id).single()

  const { data: assignments } = await supabase
    .from('task_assignments').select('task_id, tasks(*)').eq('child_id', childId)
  const tasks = (assignments?.map(a => a.tasks).flat().filter(Boolean) || []) as any[]

  const today = new Date().toISOString().split('T')[0]
  const { data: completions } = await supabase
    .from('completions').select('task_id, status').eq('child_id', childId).eq('date', today)
  const completedTaskIds = completions
    ?.filter(c => c.status === 'approved' || c.status === 'pending')
    .map(c => c.task_id) || []

  const { data: starData } = await supabase
    .from('star_ledger').select('delta').eq('child_id', childId)
  const starBalance = starData?.reduce((sum, r) => sum + r.delta, 0) || 0

  // Load rewards available to this child
  const { data: rewards } = await supabase
    .from('rewards')
    .select('id, title, emoji, star_cost')
    .eq('family_id', guardian?.family_id)
    .or(`scope.eq.family,and(scope.eq.child,child_id.eq.${childId})`)
    .order('star_cost')

  // Load rewards this child has already requested (pending)
  const { data: pendingRedemptions } = await supabase
    .from('redemptions')
    .select('reward_id')
    .eq('child_id', childId)
    .eq('status', 'requested')
  const pendingRewardIds = pendingRedemptions?.map(r => r.reward_id) || []

  // Has this child already spun today?
  const { data: spinToday } = await supabase
    .from('spin_results').select('id').eq('child_id', childId).eq('date', today).maybeSingle()
  const canSpin = !spinToday

  // Unseen praises
  const { data: unseenPraises } = await supabase
    .from('praises').select('id, message').eq('child_id', childId).eq('seen', false).order('created_at')

  return (
    <ChildTaskView
      child={child}
      tasks={tasks}
      completedTaskIds={completedTaskIds}
      starBalance={starBalance}
      parentPin={guardian?.parent_pin || ''}
      rewards={rewards || []}
      pendingRewardIds={pendingRewardIds}
      canSpin={canSpin}
      unseenPraises={unseenPraises || []}
    />
  )
}
