import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
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

const TIME_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 }
const TIME_LABEL: Record<string, string> = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌙 Evening' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardians').select('name, family_id').eq('auth_user_id', user.id).single()
  if (!guardian) redirect('/setup')

  const [{ data: children }, { data: tasks }, { data: assignments }, { data: allStarData }] = await Promise.all([
    supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
    supabase.from('tasks').select('id, title, emoji, star_value, time_of_day').eq('family_id', guardian.family_id),
    supabase.from('task_assignments').select('task_id, child_id'),
    supabase.from('star_ledger').select('child_id, delta'),
  ])

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const childIds = children?.map(c => c.id) || []

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

  const childMap: Record<string, any> = {}
  ;(children || []).forEach(c => { childMap[c.id] = c })

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

  const leaderboard = [...childData].sort((a, b) => b.weekStars - a.weekStars)

  // Upcoming tasks today = any task with at least one assigned kid not yet done
  const upcoming = (tasks || [])
    .map(t => {
      const kids = (assignmentMap[t.id] || []).map(id => childMap[id]).filter(Boolean)
      const pending = kids.filter(k => !completedSet.has(`${t.id}-${k.id}`))
      return { task: t, kids, pending }
    })
    .filter(u => u.kids.length > 0 && u.pending.length > 0)
    .sort((a, b) => (TIME_ORDER[a.task.time_of_day] ?? 3) - (TIME_ORDER[b.task.time_of_day] ?? 3))

  const guardianInitial = (guardian.name || 'P').trim().charAt(0).toUpperCase()

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%)' }}>

      {/* Header — centered wordmark + Kid Mode & profile */}
      <div className="relative px-4 pt-12 pb-3">
        <h1 className="wordmark text-center text-3xl">Little Yakka</h1>
        <div className="absolute top-11 right-4 flex items-center gap-2">
          <Link href="/kid-mode"
            aria-label="Kid Mode"
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-95 transition"
            style={{ background: 'var(--theme-gradient)' }}>
            <span className="text-xl">⭐</span>
          </Link>
          <Link href="/dashboard/settings"
            aria-label="Profile & settings"
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-black shadow-md active:scale-95 transition"
            style={{ color: 'var(--theme-from)' }}>
            {guardianInitial}
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

        {/* Kids tiles — 3 per row, aligned with leaderboard width */}
        {childData.length > 0 ? (
          <div className="grid grid-cols-3 gap-2.5">
            {childData.map(({ child, balance, streak, myTasks, myDone }) => {
              const total = myTasks.length
              const allDone = total > 0 && myDone === total
              const progressPct = total > 0 ? (myDone / total) * 100 : 0
              const firstName = child.name.split(' ')[0]
              return (
                <div key={child.id} className="relative bg-white rounded-2xl shadow-sm">
                  {/* Praise heart, top-right */}
                  <div className="absolute top-1.5 right-1.5 z-10">
                    <PraiseButton childId={child.id} childName={child.name} childColour={child.colour} variant="icon"/>
                  </div>

                  <Link href={`/kid-mode/${child.id}`} className="block p-2.5 text-center active:bg-gray-50 transition rounded-2xl">
                    {/* Avatar */}
                    <div className="relative w-14 h-14 mx-auto mb-1.5">
                      {child.avatar_url
                        ? <img src={child.avatar_url} className="w-14 h-14 rounded-2xl object-cover"
                            style={{ border: `3px solid ${child.colour}` }} alt=""/>
                        : <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                            style={{ backgroundColor: child.colour + '25', border: `3px solid ${child.colour}40` }}>
                            {child.avatar}
                          </div>
                      }
                      {allDone && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow">
                          <span className="text-white text-[10px] font-black">✓</span>
                        </div>
                      )}
                    </div>

                    <p className="font-black text-gray-800 text-sm leading-tight truncate">{firstName}</p>
                    <p className="text-base font-black text-yellow-500 leading-none my-1">⭐ {balance}</p>

                    {streak > 0 && (
                      <p className="text-[10px] font-bold text-orange-500 mb-1">🔥 {streak}d</p>
                    )}

                    {total > 0 && (
                      <div className="mb-1.5">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: allDone ? '#22c55e' : child.colour }}/>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-0.5">{allDone ? 'All done!' : `${myDone}/${total} today`}</p>
                      </div>
                    )}

                    {/* Enter zone star CTA */}
                    <div className="flex items-center justify-center gap-1 text-white text-[11px] font-bold py-1.5 rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${child.colour}, ${child.colour}cc)` }}>
                      <span>⭐</span><span>Enter</span>
                    </div>
                  </Link>
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

        {/* Upcoming tasks today */}
        {childData.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">📋 Upcoming today</p>
              {upcoming.length > 0 && <span className="text-xs font-semibold text-gray-400">{upcoming.length} left</span>}
            </div>

            {upcoming.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-1">🎉</div>
                <p className="text-sm font-semibold text-gray-600">All tasks done for today!</p>
              </div>
            ) : (
              <div className="max-h-[42vh] overflow-y-auto space-y-2 -mr-1 pr-1">
                {upcoming.map(({ task, pending }) => (
                  <div key={task.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 14%, white)' }}>{task.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{task.title}</p>
                      <p className="text-[11px] text-gray-400">
                        {task.time_of_day ? TIME_LABEL[task.time_of_day] : '📋 Anytime'} · ⭐ {task.star_value}
                      </p>
                    </div>
                    <div className="flex -space-x-2 flex-shrink-0">
                      {pending.slice(0, 3).map((k: any) => (
                        k.avatar_url
                          ? <img key={k.id} src={k.avatar_url} className="w-7 h-7 rounded-full object-cover border-2 border-white" alt=""/>
                          : <div key={k.id} className="w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white"
                              style={{ backgroundColor: k.colour + '33' }}>{k.avatar}</div>
                      ))}
                      {pending.length > 3 && <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 border-2 border-white">+{pending.length - 3}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
