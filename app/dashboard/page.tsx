import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Logo from '@/components/Logo'

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
    supabase.from('tasks').select('id, star_value').eq('family_id', guardian.family_id),
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

  const dateLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 750, 1000]
  function getLevel(stars: number) {
    let level = 1
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (stars >= LEVEL_THRESHOLDS[i]) level = i + 1
    }
    return Math.min(level, LEVEL_THRESHOLDS.length)
  }
  function getLevelTitle(level: number) {
    return ['⭐ Beginner', '🌟 Rising Star', '💫 Star Player', '🏆 Champion', '🔥 Legend', '👑 Superstar', '🦄 Mythic'][level - 1] || '⭐ Beginner'
  }
  function nextLevelStars(stars: number) {
    const next = LEVEL_THRESHOLDS.find(t => t > stars)
    return next ?? null
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, #f3f0ff 0%, #fdf4ff 50%, #f9fafb 100%)' }}>

      {/* Compact header */}
      <div className="px-4 pt-10 pb-4">
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={36}/>
            <div>
              <p className="text-xs text-gray-400 font-medium">{dateLabel}</p>
              <p className="text-sm font-bold text-gray-700">{family?.name}</p>
            </div>
          </div>
          <Link href="/dashboard/settings" className="w-9 h-9 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-400">
            ⚙️
          </Link>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 space-y-4">

        {/* Kids cards */}
        {children && children.length > 0 ? (
          <div className="space-y-3">
            {children.map(child => {
              const myTaskIds = tasks?.filter(t => (assignmentMap[t.id] || []).includes(child.id)) || []
              const myDone = myTaskIds.filter(t => completedSet.has(`${t.id}-${child.id}`)).length
              const total = myTaskIds.length
              const stars = balances[child.id] || 0
              const level = getLevel(stars)
              const levelTitle = getLevelTitle(level)
              const nextStars = nextLevelStars(stars)
              const progressPct = total > 0 ? (myDone / total) * 100 : 0
              const allDone = total > 0 && myDone === total

              return (
                <Link key={child.id} href={`/kid-mode/${child.id}`}
                  className="block bg-white rounded-3xl shadow-sm overflow-hidden active:scale-98 transition">
                  <div className="flex items-center gap-4 p-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {child.avatar_url ? (
                        <img src={child.avatar_url} alt={child.name}
                          className="w-20 h-20 rounded-2xl object-cover"
                          style={{ border: `3px solid ${child.colour}` }}/>
                      ) : (
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl"
                          style={{ backgroundColor: child.colour + '25', border: `3px solid ${child.colour}40` }}>
                          {child.avatar}
                        </div>
                      )}
                      {allDone && (
                        <div className="absolute -top-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-white text-sm font-black">✓</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h2 className="text-xl font-black text-gray-800">{child.name.split(' ')[0]}</h2>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">{levelTitle}</span>
                      </div>

                      {/* Stars */}
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-3xl font-black text-yellow-500">⭐ {stars}</span>
                        {nextStars && (
                          <span className="text-xs text-gray-400">{nextStars - stars} to next level</span>
                        )}
                      </div>

                      {/* Today's progress */}
                      {total > 0 ? (
                        <>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Today: {myDone}/{total} tasks</span>
                            {allDone ? <span className="text-green-500 font-bold">All done! 🎉</span> : <span>{total - myDone} to go 💪</span>}
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${progressPct}%`, backgroundColor: allDone ? '#22c55e' : child.colour }}/>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">No tasks assigned yet</p>
                      )}
                    </div>
                  </div>

                  {/* Tap to enter kid mode footer */}
                  <div className="px-4 py-2.5 flex items-center justify-between"
                    style={{ background: `linear-gradient(90deg, ${child.colour}15, ${child.colour}30)` }}>
                    <span className="text-xs font-bold" style={{ color: child.colour }}>Tap to enter {child.name.split(' ')[0]}'s zone</span>
                    <span className="text-sm" style={{ color: child.colour }}>→</span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-3">👶</div>
            <p className="font-bold text-gray-700 mb-1">No kids added yet</p>
            <Link href="/dashboard/settings" className="text-sm font-semibold" style={{ color: 'var(--theme-from)' }}>
              Add children in Settings →
            </Link>
          </div>
        )}

        {/* Quick links row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: '/dashboard/chores', emoji: '✅', label: 'Tasks' },
            { href: '/dashboard/rewards', emoji: '🎁', label: 'Rewards' },
            { href: '/dashboard/history', emoji: '📋', label: 'History' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1 shadow-sm active:scale-95 transition">
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-xs font-semibold text-gray-600">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
