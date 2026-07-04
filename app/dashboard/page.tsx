import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PraiseButton from '@/components/PraiseButton'
import ProfileButton from '@/components/ProfileButton'
import TaskLauncher from '@/components/TaskLauncher'
import DecoratedAvatar from '@/components/DecoratedAvatar'
import { occursOn } from '@/lib/recurrence'
import { localNow, localDateStr, localTimeHHMM, parseTzCookie } from '@/lib/localDate'

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

  // Timezone-aware "today" — read from cookie set by client on first load
  const cookieStore = await cookies()
  const tz = parseTzCookie(cookieStore.get('tz')?.value)
  const now = localNow(tz)                          // Date with correct local y/m/d
  const today = localDateStr(new Date(), tz)        // YYYY-MM-DD in user's timezone

  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30)
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now); weekStart.setDate(now.getDate() + mondayOffset); weekStart.setHours(0, 0, 0, 0)

  // ONE parallel batch — RLS scopes completions/stars/spins to this family,
  // so no child-id pre-fetch (and no extra round-trip stages) are needed.
  const [
    { data: children }, { data: tasks }, { data: assignments }, { data: allStarData },
    { data: completions }, { data: recentCompletions }, { data: weekStarData }, { data: allCompletions },
    { data: family }, { data: todaySpins },
  ] = await Promise.all([
    supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
    supabase.from('tasks').select('*').eq('family_id', guardian.family_id),
    supabase.from('task_assignments').select('task_id, child_id'),
    supabase.from('star_ledger').select('child_id, delta'),
    supabase.from('completions').select('task_id, child_id, status').eq('date', today),
    supabase.from('completions').select('child_id, date').eq('status', 'approved')
      .gte('date', localDateStr(thirtyDaysAgo, tz)),
    supabase.from('star_ledger').select('child_id, delta')
      .gte('created_at', weekStart.toISOString()),
    supabase.from('completions').select('child_id, task_id').eq('status', 'approved'),
    supabase.from('families').select('bonus_cadence, bonus_day, bonus_time').eq('id', guardian.family_id).maybeSingle(),
    supabase.from('spin_results').select('child_id').eq('date', today),
  ])
  const bonusCadence = family?.bonus_cadence || 'weekly'
  const bonusDay = family?.bonus_day ?? 0
  const bonusTime = (family?.bonus_time || '16:00').toString().slice(0, 5)
  // Use real wall-clock time in the user's tz — localNow() is pinned to noon.
  const bonusDueNow = (bonusCadence === 'daily' || now.getDay() === bonusDay) && localTimeHHMM(tz) >= bonusTime
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
    let lastFreeze = -99
    for (let i = 0; i < 45; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i)
      const ds = localDateStr(d, tz)
      const due = childTasks.filter(t => occursOn(t, d)).length
      if (due === 0) continue // nothing scheduled — doesn't break or count
      const done = doneCount[`${childId}|${ds}`] || 0
      if (done >= due) streak++
      else if (i === 0) continue // today still in progress — don't break the streak yet
      else if (i - lastFreeze > 7) { lastFreeze = i; continue } // streak freeze 🧊 — one slip per week forgiven
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

  // Up-for-grabs tasks — unassigned bounties any child can claim (first done wins)
  const ufgClaimed: Record<string, string> = {}
  ;(allCompletions || []).forEach((c: any) => { if (c.task_id) ufgClaimed[c.task_id] = c.child_id })
  const ufgTasks = (tasks || []).filter((t: any) => t.up_for_grabs && (!t.expires_on || t.expires_on >= today))

  // Today's tasks — all of them (completed shown with a strikethrough, not hidden)
  const todayItems = (todayTasks || [])
    .map(t => {
      const kids = (assignmentMap[t.id] || []).map(id => childMap[id]).filter(Boolean)
      const pending = kids.filter((k: any) => !completedSet.has(`${t.id}-${k.id}`))
      const allDone = kids.length > 0 && pending.length === 0
      return { task: t, kids, pending, allDone }
    })
    .filter(u => u.kids.length > 0)
    .sort((a, b) => (TIME_ORDER[a.task.time_of_day] ?? 3) - (TIME_ORDER[b.task.time_of_day] ?? 3))

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%)' }}>

      {/* Header — logo left, centred title, settings right */}
      <div className="px-4 pt-11 pb-2 bg-white border-b border-gray-100">
        <div className="max-w-sm lg:max-w-3xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center">
          <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto justify-self-start"/>
          <span className="text-4xl font-black justify-self-center leading-none" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Home</span>
          <div className="justify-self-end"><ProfileButton/></div>
        </div>
      </div>

      <div className="max-w-sm lg:max-w-3xl mx-auto px-4 space-y-4">

        {/* Kids tiles — comfortable centred width for 1-2, fill for 3, scroll for more */}
        {childData.length > 0 ? (
          <div className={tileScroll ? 'flex gap-2.5 overflow-x-auto -mx-4 px-4 pb-1' : 'flex gap-2.5 justify-center'}>
            {childData.map(({ child, balance, weekStars, streak, myTasks, myDone, canSpin }) => {
              const total = myTasks.length
              const allDone = total > 0 && myDone === total
              const progressPct = total > 0 ? (myDone / total) * 100 : 0
              const firstName = child.name.split(' ')[0]
              const rank = rankMap[child.id]
              const showMedal = childData.length > 1 && rank < 3 && weekStars > 0
              return (
                <div key={child.id}
                  className={`relative bg-white rounded-2xl shadow-sm ${tileScroll ? 'flex-shrink-0 w-[31%] min-w-[108px] lg:w-[200px]' : 'flex-1 min-w-0 max-w-[150px] lg:max-w-[220px]'}`}>
                  {/* Weekly rank medal, top-left */}
                  {showMedal && (
                    <div className="absolute top-1.5 left-1.5 z-10 text-base drop-shadow-sm">{MEDALS[rank]}</div>
                  )}
                  {/* Praise heart, top-right */}
                  <div className="absolute top-1.5 right-1.5 z-10">
                    <PraiseButton childId={child.id} childName={child.name} childColour={child.colour} variant="icon"/>
                  </div>

                  <Link href={`/kid-mode/${child.id}`} className="block p-2.5 text-center active:bg-gray-50 transition rounded-2xl">
                    {/* Avatar (with any equipped style-shop hat/frame) */}
                    <div className="relative w-14 h-14 mx-auto mb-1.5 mt-2">
                      <DecoratedAvatar child={child} size={56}/>
                      {allDone && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow z-10">
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

                    {/* Streak — fixed-height slot so progress bars stay aligned across children */}
                    <div className="h-4 mb-1 flex items-center justify-center">
                      {streak > 0 && (
                        <p className="text-[10px] font-bold text-orange-500">🔥 {streak}d streak</p>
                      )}
                    </div>

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

                  {/* Bonus spin — taps straight into the wheel */}
                  {canSpin && (
                    <Link href={`/kid-mode/${child.id}?spin=1`}
                      className="block mx-2.5 mb-2.5 text-center text-[10px] font-black text-white rounded-full px-2 py-1 animate-pulse active:scale-95 transition"
                      style={{ background: 'var(--theme-gradient)' }}>
                      🎰 SPIN READY!
                    </Link>
                  )}
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

        {/* Today's Tasks — completed shown struck-through */}
        {childData.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <p className="text-base font-black text-gray-700 uppercase tracking-wide mb-3">📋 Today's Tasks</p>

            {todayItems.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-1">🎉</div>
                <p className="text-sm font-semibold text-gray-600">Nothing due today!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayItems.map(({ task, kids, pending, allDone }) => (
                  <TaskLauncher key={task.id} taskId={task.id} kids={pending.length ? pending : kids}>
                    <div className={`flex items-center gap-3 rounded-2xl p-2.5 active:scale-[0.98] transition ${allDone ? 'bg-gray-50 opacity-70' : 'bg-gray-50'}`}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-white" style={{ border: '1.5px solid var(--theme-from)' }}>{task.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${allDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                        <p className="text-[11px] text-gray-400">
                          {task.time_of_day ? TIME_LABEL[task.time_of_day] : '📋 Anytime'} · ⭐ {task.star_value}
                        </p>
                      </div>
                      <div className="flex -space-x-2 flex-shrink-0">
                        {kids.slice(0, 3).map((k: any) => {
                          const done = completedSet.has(`${task.id}-${k.id}`)
                          return k.avatar_url
                            ? <img key={k.id} src={k.avatar_url} className={`w-7 h-7 rounded-full object-cover border-2 border-white ${done ? 'opacity-50' : ''}`} alt=""/>
                            : <div key={k.id} className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white ${done ? 'opacity-50' : ''}`}
                                style={{ backgroundColor: k.colour + '33' }}>{k.avatar}</div>
                        })}
                        {kids.length > 3 && <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 border-2 border-white">+{kids.length - 3}</div>}
                      </div>
                    </div>
                  </TaskLauncher>
                ))}
              </div>
            )}

            {/* Up for grabs — visually distinct amber bounties */}
            {ufgTasks.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-black text-amber-500 uppercase tracking-wide">🙌 Up for grabs</p>
                {ufgTasks.map((task: any) => {
                  const claimerId = ufgClaimed[task.id]
                  const claimer = claimerId ? childMap[claimerId] : null
                  return (
                    <TaskLauncher key={task.id} taskId={task.id} kids={claimer ? [claimer] : (children || [])}>
                      <div className={`flex items-center gap-3 rounded-2xl p-2.5 border-2 border-dashed border-amber-300 bg-amber-50 active:scale-[0.98] transition ${claimer ? 'opacity-75' : ''}`}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-white" style={{ border: '1.5px solid #F59E0B' }}>{task.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm truncate ${claimer ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                          <p className="text-[11px] font-semibold text-amber-600">
                            {claimer
                              ? `Claimed by ${claimer.name.split(' ')[0]} 🎉`
                              : `Anyone can claim · ⭐ ${task.star_value}${task.expires_on ? ` · ends ${new Date(task.expires_on + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}`}
                          </p>
                        </div>
                        {claimer && (
                          claimer.avatar_url
                            ? <img src={claimer.avatar_url} className="w-7 h-7 rounded-full object-cover border-2 border-white flex-shrink-0" alt=""/>
                            : <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white flex-shrink-0"
                                style={{ backgroundColor: claimer.colour + '33' }}>{claimer.avatar}</div>
                        )}
                      </div>
                    </TaskLauncher>
                  )
                })}
              </div>
            )}

            <Link href="/dashboard/chores" className="block text-center text-xs font-black pt-3 mt-1" style={{ color: 'var(--theme-from)' }}>
              SHOW ALL TASKS →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
