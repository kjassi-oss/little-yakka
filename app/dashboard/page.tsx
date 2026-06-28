import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PraiseButton from '@/components/PraiseButton'
import ProfileButton from '@/components/ProfileButton'
import TaskLauncher from '@/components/TaskLauncher'
import { occursOn } from '@/lib/recurrence'

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
    supabase.from('tasks').select('id, title, emoji, star_value, time_of_day, frequency, start_date, created_at, days_of_week').eq('family_id', guardian.family_id),
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
      .gte('created_at', weekStart.toISOString()),
    supabase.from('completions').select('child_id').eq('status', 'approved')
      .in('child_id', childIds.length ? childIds : ['none']),
  ])

  // Bonus-wheel availability for the home alert badge
  const [{ data: family }, { data: todaySpins }] = await Promise.all([
    supabase.from('families').select('bonus_cadence, bonus_day, bonus_time').eq('id', guardian.family_id).maybeSingle(),
    supabase.from('spin_results').select('child_id').eq('date', today).in('child_id', childIds.length ? childIds : ['none']),
  ])
  const bonusCadence = family?.bonus_cadence || 'weekly'
  const bonusDay = family?.bonus_day ?? 0
  const bonusTime = family?.bonus_time || '16:00'
  const bonusDueNow = (bonusCadence === 'daily' || now.getDay() === bonusDay) && now.toTimeString().slice(0, 5) >= bonusTime
  const spunSet = new Set((todaySpins || []).map(s => s.child_id))

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

  // Only tasks actually due today (frequency + start date aware)
  const todayTasks = (tasks || []).filter(t => occursOn(t, now))

  // Completions per child per day (for the "all done" streak)
  const doneCount: Record<string, number> = {}
  recentCompletions?.forEach(c => { const k = `${c.child_id}|${c.date}`; doneCount[k] = (doneCount[k] || 0) + 1 })

  // Streak = consecutive days where ALL of that child's due tasks were completed
  function allDoneStreak(childId: string): number {
    const childTasks = (tasks || []).filter(t => (assignmentMap[t.id] || []).includes(childId))
    if (childTasks.length === 0) return 0
    let streak = 0
    for (let i = 0; i < 45; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const due = childTasks.filter(t => occursOn(t, d)).length
      if (due === 0) continue // nothing scheduled — doesn't break or count
      const done = doneCount[`${childId}|${ds}`] || 0
      if (done >= due) streak++
      else if (i === 0) continue // today still in progress — don't break the streak yet
      else break
    }
    return streak
  }

  const childData = (children || []).map(child => {
    const balance = allStarData?.filter(s => s.child_id === child.id).reduce((sum, s) => sum + s.delta, 0) || 0
    const weekStars = weekStarData?.filter(s => s.child_id === child.id).reduce((sum, s) => sum + s.delta, 0) || 0
    const streak = allDoneStreak(child.id)
    const totalCompletions = allCompletions?.filter(c => c.child_id === child.id).length || 0
    const badges = getBadges(balance, streak, totalCompletions)
    const level = getLevel(balance)
    const myTasks = todayTasks.filter(t => (assignmentMap[t.id] || []).includes(child.id))
    const myDone = myTasks.filter(t => completedSet.has(`${t.id}-${child.id}`)).length
    const canSpin = bonusDueNow && !spunSet.has(child.id)
    return { child, balance, weekStars, streak, badges, level, myTasks, myDone, canSpin }
  })

  const leaderboard = [...childData].sort((a, b) => b.weekStars - a.weekStars)
  const tileScroll = childData.length > 3 // ≤3 fill the frame; 4+ scroll horizontally
  const maxWeek = Math.max(...childData.map(c => c.weekStars), 1)
  const rankMap: Record<string, number> = {}
  leaderboard.forEach((cd, i) => { rankMap[cd.child.id] = i })
  const MEDALS = ['🥇', '🥈', '🥉']

  // Upcoming across the next 3 days, grouped by date
  const upcomingDays: { ds: string; label: string; date: string; items: { task: any; pending: any[] }[] }[] = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i)
    const ds = d.toISOString().split('T')[0]
    const items = (tasks || [])
      .filter(t => occursOn(t, d))
      .map(t => {
        const kids = (assignmentMap[t.id] || []).map(id => childMap[id]).filter(Boolean)
        const pending = i === 0 ? kids.filter((k: any) => !completedSet.has(`${t.id}-${k.id}`)) : kids
        return { task: t, pending, kids }
      })
      .filter(u => u.kids.length > 0 && u.pending.length > 0)
      .sort((a, b) => (TIME_ORDER[a.task.time_of_day] ?? 3) - (TIME_ORDER[b.task.time_of_day] ?? 3))
    if (items.length) upcomingDays.push({
      ds,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-AU', { weekday: 'long' }),
      date: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      items,
    })
  }
  const upcomingTotal = upcomingDays.reduce((s, d) => s + d.items.length, 0)

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%)' }}>

      {/* Header — logo left + profile right */}
      <div className="px-4 pt-11 pb-2 bg-white border-b border-gray-100">
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <img src="/logo.png" alt="Little Yakka" className="h-9 w-auto"/>
          <ProfileButton/>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 space-y-4">

        {/* Kids tiles — fill the frame up to 3, scroll for more */}
        {childData.length > 0 ? (
          <div className={tileScroll ? 'flex gap-2.5 overflow-x-auto -mx-4 px-4 pb-1' : 'flex gap-2.5'}>
            {childData.map(({ child, balance, weekStars, streak, myTasks, myDone, canSpin }) => {
              const total = myTasks.length
              const allDone = total > 0 && myDone === total
              const progressPct = total > 0 ? (myDone / total) * 100 : 0
              const firstName = child.name.split(' ')[0]
              const rank = rankMap[child.id]
              const showMedal = childData.length > 1 && rank < 3 && weekStars > 0
              return (
                <div key={child.id}
                  className={`relative bg-white rounded-2xl shadow-sm ${tileScroll ? 'flex-shrink-0 w-[31%] min-w-[108px]' : 'flex-1 min-w-0'}`}>
                  {/* Weekly rank medal, top-left */}
                  {showMedal && (
                    <div className="absolute top-1.5 left-1.5 z-10 text-base drop-shadow-sm">{MEDALS[rank]}</div>
                  )}
                  {/* Praise heart, top-right */}
                  <div className="absolute top-1.5 right-1.5 z-10">
                    <PraiseButton childId={child.id} childName={child.name} childColour={child.colour} variant="icon"/>
                  </div>

                  <Link href={`/dashboard/schedule?child=${child.id}`} className="block p-2.5 text-center active:bg-gray-50 transition rounded-2xl">
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

                    {/* This week's tracking (consolidated leaderboard) */}
                    <div className="mb-1.5">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(8, (weekStars / maxWeek) * 100)}%`, background: 'var(--theme-gradient)' }}/>
                      </div>
                      <p className="text-[9px] font-semibold text-gray-400 mt-0.5">+{weekStars} ⭐ this week</p>
                    </div>

                    {streak > 0 && (
                      <p className="text-[10px] font-bold text-orange-500 mb-1">🔥 {streak}d streak</p>
                    )}

                    {canSpin && (
                      <p className="text-[10px] font-black text-white rounded-full px-2 py-0.5 mb-1 inline-block animate-pulse"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>🎰 Spin ready!</p>
                    )}

                    {total > 0 && (
                      <p className="text-[9px] text-gray-400 mb-1.5">{allDone ? '✅ All tasks done!' : `${myDone}/${total} tasks today`}</p>
                    )}

                    {/* Progress bar */}
                    {total > 0 && (
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: child.colour }}/>
                      </div>
                    )}
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

        {/* Upcoming — next 3 days, by date */}
        {childData.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">📋 Coming up</p>

            {upcomingTotal === 0 ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-1">🎉</div>
                <p className="text-sm font-semibold text-gray-600">All caught up — nothing due!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingDays.map(day => (
                  <div key={day.ds}>
                    <p className="text-[11px] font-black text-gray-700 mb-1.5">{day.label} · {day.date}</p>
                    <div className="space-y-2">
                      {day.items.map(({ task, pending }) => (
                        <TaskLauncher key={task.id} taskId={task.id} kids={pending}>
                          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-2.5 active:scale-[0.98] transition">
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
                        </TaskLauncher>
                      ))}
                    </div>
                  </div>
                ))}
                <Link href="/dashboard/schedule" className="block text-center text-xs font-bold pt-1" style={{ color: 'var(--theme-from)' }}>
                  See more in Calendar →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
