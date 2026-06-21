import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardians').select('name, family_id').eq('auth_user_id', user.id).single()
  if (!guardian) redirect('/setup')

  const [{ data: family }, { data: children }, { data: tasks }, { data: assignments }, { data: starData }] = await Promise.all([
    supabase.from('families').select('name').eq('id', guardian.family_id).single(),
    supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
    supabase.from('tasks').select('*').eq('family_id', guardian.family_id).order('type').order('time_of_day', { nullsFirst: false }),
    supabase.from('task_assignments').select('task_id, child_id'),
    supabase.from('star_ledger').select('child_id, delta'),
  ])

  const today = new Date().toISOString().split('T')[0]
  const childIds = children?.map(c => c.id) || []

  const { data: completions } = await supabase
    .from('completions').select('task_id, child_id, status')
    .eq('date', today)
    .in('child_id', childIds.length ? childIds : ['none'])

  const balances: Record<string, number> = {}
  starData?.forEach(r => { balances[r.child_id] = (balances[r.child_id] || 0) + r.delta })

  const completedSet = new Set(
    completions?.filter(c => c.status === 'approved' || c.status === 'pending')
      .map(c => `${c.task_id}-${c.child_id}`) || []
  )

  const assignmentMap: Record<string, string[]> = {}
  assignments?.forEach(a => {
    if (!assignmentMap[a.task_id]) assignmentMap[a.task_id] = []
    assignmentMap[a.task_id].push(a.child_id)
  })

  const childMap: Record<string, any> = {}
  children?.forEach(c => { childMap[c.id] = c })

  const todayLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500 to-pink-500 pt-12 pb-16 px-4">
        <div className="max-w-sm mx-auto">
          <p className="text-purple-200 text-sm">Welcome back</p>
          <h1 className="text-2xl font-bold text-white">{guardian.name} 👋</h1>
          <p className="text-purple-200 text-sm">{family?.name}</p>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 -mt-10 space-y-4">

        {/* Kids row */}
        <div className="bg-white rounded-3xl shadow-sm p-4">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {children?.map(child => {
              const myTasks = tasks?.filter(t => (assignmentMap[t.id] || []).includes(child.id)) || []
              const myDone = myTasks.filter(t => completedSet.has(`${t.id}-${child.id}`)).length
              return (
                <div key={child.id} className="flex flex-col items-center gap-1.5 min-w-[72px]">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                      style={{ backgroundColor: child.colour + '33' }}>
                      {child.avatar}
                    </div>
                    {myTasks.length > 0 && (
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${myDone === myTasks.length ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-600'}`}>
                        {myDone === myTasks.length ? '✓' : `${myDone}/${myTasks.length}`}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-700 truncate w-full text-center">{child.name.split(' ')[0]}</p>
                  <p className="text-xs text-yellow-500 font-bold">⭐ {balances[child.id] || 0}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Kid Mode button */}
        <Link href="/kid-mode"
          className="flex items-center gap-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl p-4 shadow-lg active:scale-98 transition">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">⭐</div>
          <div className="flex-1">
            <p className="text-white font-bold text-lg">Enter Kid Mode</p>
            <p className="text-purple-200 text-sm">Let the kids check off tasks</p>
          </div>
          <span className="text-white/50 text-xl">›</span>
        </Link>

        {/* Today's tasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Today's Tasks</h2>
              <p className="text-xs text-gray-400">{todayLabel}</p>
            </div>
            <Link href="/dashboard/schedule" className="text-xs text-purple-500 font-semibold">Full schedule →</Link>
          </div>

          {tasks && tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map(task => {
                const assignedChildIds = assignmentMap[task.id] || []
                const assignedKids = assignedChildIds.map(id => childMap[id]).filter(Boolean)
                const allDone = assignedKids.length > 0 && assignedKids.every(c => completedSet.has(`${task.id}-${c.id}`))

                return (
                  <div key={task.id} className={`bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3 transition ${allDone ? 'opacity-55' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl flex-shrink-0">
                      {task.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${allDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-gray-400">⭐ {task.star_value}{task.time_of_day ? ` · ${task.time_of_day}` : ''}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {assignedKids.map(child => {
                        const done = completedSet.has(`${task.id}-${child.id}`)
                        return (
                          <div key={child.id} className="relative">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                              style={{ backgroundColor: child.colour + '33' }}>
                              {child.avatar}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${done ? 'bg-green-500' : 'bg-gray-200'}`}>
                              {done && <span className="text-white text-[8px] font-bold">✓</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <p className="text-gray-400 text-sm mb-2">No tasks set up yet.</p>
              <Link href="/dashboard/chores" className="text-purple-500 text-sm font-semibold">Add tasks →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
