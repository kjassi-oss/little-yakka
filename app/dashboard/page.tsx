import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Logo from '@/components/Logo'
import PraiseButton from '@/components/PraiseButton'

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0
  const dateSet = new Set(dates)
  const check = new Date()
  let streak = 0
  while (true) {
    const ds = check.toISOString().split('T')[0]
    if (dateSet.has(ds)) { streak++; check.setDate(check.getDate() - 1) }
    else break
  }
  return streak
}

function getBadges(stars: number, streak: number, completions: number): string[] {
  const b: string[] = []
  if (stars >= 1)         b.push('🌟')
  if (completions >= 10)  b.push('🎯')
  if (completions >= 50)  b.push('💯')
  if (stars >= 100)       b.push('💫')
  if (stars >= 500)       b.push('🏆')
  if (streak >= 3)        b.push('🔥')
  if (streak >= 7)        b.push('⚡')
  if (streak >= 14)       b.push('👑')
  return b
}

const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 750, 1000]
const LEVEL_TITLES = ['⭐ Beginner', '🌟 Rising Star', '💫 Star Player', '🏆 Champion', '🔥 Legend', '👑 Superstar', '🦄 Mythic']

function getLevel(stars: number) {
  let lvl = 0
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) { if (stars >= LEVEL_THRESHOLDS[i]) lvl = i }
  return lvl
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardians').select('name, family_id').eq('auth_user_id', user.id).single()
  if (!guardian) redirect('/setup')

  const [{ data: family }, { data: children }, { data: tasks }, { data: assignments }, { data: allStarData }] = await Promise.all([
    supabase.from('families').select('name').eq('id', guardian.family_id).single(),
    supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
    supabase.from('tasks').select('id, star_value').eq('family_id', guardian.family_id),
    supabase.from('task_assignments').select('task_id, child_id'),
    supabase.from('star_ledger').select('child_id, delta'),
  ])

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const childIds = children?.map(c => c.id) || []

  // This week's stars (for leaderboard)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now); weekStart.setDate(now.getDate() + mondayOffset); weekStart.setHours(0, 0, 0, 0)

  const [{ data: completions }, { data: recentCompletions }, { data: weekStarData }, { data: allCompletions }] = await Promise.all([
    supabase.from('completions').select('task_id, child_id, status').eq('date', today)
      .in('child_id', childIds.length ? childIds : ['none']),
    supabase.from('completions').select('child_id, date').eq('status', 'approved')
      .in('child_id', childIds.length ? childIds : ['none'])
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0]),
    supabase.from('star_ledger').select('child_id, delta')
      .in('child_id', childIds.length ? childIds : ['none'])
      .gte('created_at', weekStart.toISOString()).gt('delta', 0),
    supabase.from('completions').select('child_id').eq('status', 'approved')
      .in('child_id', childIds.length ? childIds : ['none']),
  ])

  const completedSet = new Set(
    completions?.filter(c => c.status === 'approved' || c.status === 'pending')
      .map(c => `${c.task_id}-${c.child_id}`) || []
  )

  const assignmentMap: Record<string, string[]> = {}
  assignments?.forEach(a => {
    if (!assignmentMap[a.task_id]) assignmentMap[a.task_id] = []
    assignmentMap[a.task_id].push(a.child_id)
  })

  // Per-child computed data
  const childData = (children || []).map(child => {
    const balance = allStarData?.filter(s => s.child_id === child.id).reduce((sum, s) => sum + s.delta, 0) || 0
    const weekStars = weekStarData?.filter(s => s.child_id === child.id).reduce((sum, s) => sum + s.delta, 0) || 0
    const myDates = [...new Set(recentCompletions?.filter(c => c.child_id === child.id).map(c => c.date) || [])]
    const streak = computeStreak(myDates)
    const totalCompletions = allCompletions?.filter(c => c.child_id === child.id).length || 0
    const badges = getBadges(balance, streak, totalCompletions)
    const level = getLevel(balance)
    const myTasks = tasks?.filter(t => (assignmentMap[t.id] || []).includes(child.id)) || []
    const myDone = myTasks.filter(t => completedSet.has(`${t.id}-${child.id}`)).length
    return { child, balance, weekStars, streak, badges, level, myTasks, myDone }
  })

  // Leaderboard: sort by this week's stars
  const leaderboard = [...childData].sort((a, b) => b.weekStars - a.weekStars)

  const dateLabel = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

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
          <Link href="/dashboard/report"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-white rounded-full shadow-sm"
            style={{ color: 'var(--theme-from)' }}>
            📊 Report
          </Link>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 space-y-4">

        {/* This week leaderboard — only if multiple kids */}
        {childData.length > 1 && (
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🏆 This week's leaderboard</p>
            <div className="space-y-2">
              {leaderboard.map((cd, i) => (
                <div key={cd.child.id} className="flex items-center gap-3">
                  <span className="text-lg w-6 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  {cd.child.avatar_url
                    ? <img src={cd.child.avatar_url} className="w-8 h-8 rounded-full object-cover" alt=""/>
                    : <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                        style={{ backgroundColor: cd.child.colour + '33' }}>{cd.child.avatar}</div>
                  }
                  <p className="font-bold text-gray-700 flex-1 text-sm">{cd.child.name.split(' ')[0]}</p>
                  <div className="flex items-center gap-1">
                    <div className="h-2 rounded-full" style={{
                      width: `${Math.max(20, (cd.weekStars / Math.max(...leaderboard.map(l => l.weekStars), 1)) * 80)}px`,
                      backgroundColor: cd.child.colour
                    }}/>
                    <span className="text-xs font-bold text-yellow-500 w-12 text-right">⭐ {cd.weekStars}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kids cards */}
        {childData.length > 0 ? (
          <div className="space-y-3">
            {childData.map(({ child, balance, weekStars, streak, badges, level, myTasks, myDone }) => {
              const total = myTasks.length
              const allDone = total > 0 && myDone === total
              const progressPct = total > 0 ? (myDone / total) * 100 : 0
              const nextThreshold = LEVEL_THRESHOLDS[level + 1]

              return (
                <div key={child.id} className="bg-white rounded-3xl shadow-sm overflow-hidden">
                  {/* Main content — tappable to enter kid mode */}
                  <Link href={`/kid-mode/${child.id}`} className="block p-4 active:bg-gray-50 transition">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {child.avatar_url
                          ? <img src={child.avatar_url} className="w-20 h-20 rounded-2xl object-cover"
                              style={{ border: `3px solid ${child.colour}` }} alt=""/>
                          : <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl"
                              style={{ backgroundColor: child.colour + '25', border: `3px solid ${child.colour}40` }}>
                              {child.avatar}
                            </div>
                        }
                        {allDone && (
                          <div className="absolute -top-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                            <span className="text-white text-sm font-black">✓</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h2 className="text-xl font-black text-gray-800">{child.name.split(' ')[0]}</h2>
                          {streak > 0 && (
                            <span className="text-xs font-bold bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full">🔥 {streak} day streak</span>
                          )}
                        </div>

                        {/* Level */}
                        <p className="text-xs font-semibold mb-1" style={{ color: child.colour }}>{LEVEL_TITLES[level]}</p>

                        {/* Stars */}
                        <div className="flex items-baseline gap-1.5 mb-1">
                          <span className="text-3xl font-black text-yellow-500">⭐ {balance}</span>
                          {childData.length === 1 && weekStars > 0 && (
                            <span className="text-xs text-gray-400">+{weekStars} this week</span>
                          )}
                        </div>

                        {/* Level progress */}
                        {nextThreshold && (
                          <div className="mb-2">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                              <span>{balance} / {nextThreshold} to next level</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{ width: `${Math.min(100, (balance / nextThreshold) * 100)}%`, backgroundColor: child.colour }}/>
                            </div>
                          </div>
                        )}

                        {/* Today's tasks */}
                        {total > 0 && (
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                              <span>Today: {myDone}/{total} tasks</span>
                              {allDone ? <span className="text-green-500 font-bold">All done! 🎉</span> : <span>{total - myDone} to go 💪</span>}
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${progressPct}%`, backgroundColor: allDone ? '#22c55e' : child.colour }}/>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Badges row */}
                    {badges.length > 0 && (
                      <div className="flex gap-1 mt-3 flex-wrap">
                        {badges.map((b, i) => (
                          <span key={i} className="text-xl" title="Badge">{b}</span>
                        ))}
                      </div>
                    )}

                    {/* Enter tap hint */}
                    <div className="mt-3 flex items-center justify-between px-1">
                      <span className="text-xs font-bold" style={{ color: child.colour }}>
                        Tap to enter {child.name.split(' ')[0]}'s zone →
                      </span>
                    </div>
                  </Link>

                  {/* Praise button row */}
                  <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between"
                    style={{ background: `${child.colour}08` }}>
                    <PraiseButton childId={child.id} childName={child.name} childColour={child.colour}/>
                    {weekStars > 0 && childData.length > 1 && (
                      <span className="text-xs text-gray-400">+{weekStars} ⭐ this week</span>
                    )}
                  </div>
                </div>
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

        {/* Quick links */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: '/dashboard/chores',  emoji: '✅', label: 'Tasks' },
            { href: '/dashboard/rewards', emoji: '🎁', label: 'Rewards' },
            { href: '/dashboard/history', emoji: '📋', label: 'History' },
            { href: '/dashboard/report',  emoji: '📊', label: 'Report' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1 shadow-sm active:scale-95 transition">
              <span className="text-xl">{item.emoji}</span>
              <span className="text-[10px] font-semibold text-gray-600">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
