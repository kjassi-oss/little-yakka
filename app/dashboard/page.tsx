import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PraiseButton from '@/components/PraiseButton'
import ProfileButton from '@/components/ProfileButton'
import DecoratedAvatar from '@/components/DecoratedAvatar'
import HomeTaskPreview from '@/components/HomeTaskPreview'
import GetStartedHero from '@/components/GetStartedHero'
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
    supabase.from('completions').select('id, task_id, child_id, date, status').eq('date', today),
    supabase.from('completions').select('child_id, date').eq('status', 'approved')
      .gte('date', localDateStr(thirtyDaysAgo, tz)),
    supabase.from('star_ledger').select('child_id, delta')
      .gte('created_at', weekStart.toISOString()),
    supabase.from('completions').select('child_id, task_id').eq('status', 'approved'),
    supabase.from('families').select('bonus_cadence, bonus_day, bonus_time').eq('id', guardian.family_id).maybeSingle(),
    supabase.from('spin_results').select('child_id, date').gte('date', localDateStr(thirtyDaysAgo, tz)),
  ])
  const bonusCadence = family?.bonus_cadence === 'monthly' ? 'monthly' : 'weekly'
  const bonusDay = family?.bonus_day ?? 0
  const bonusTime = (family?.bonus_time || '16:00').toString().slice(0, 5)
  // Bonus wheel opens on the scheduled day/time and stays available for 3 days.
  // Find the most recent scheduled occurrence (weekly = day-of-week, monthly = date-of-month).
  const bonusStart = new Date(now); bonusStart.setHours(0, 0, 0, 0)
  if (bonusCadence === 'monthly') {
    if (now.getDate() < bonusDay) bonusStart.setMonth(bonusStart.getMonth() - 1)
    bonusStart.setDate(bonusDay)
  } else {
    bonusStart.setDate(bonusStart.getDate() - ((now.getDay() - bonusDay + 7) % 7))
  }
  const bonusStartStr = localDateStr(bonusStart, tz)
  const onStartDay = localDateStr(now, tz) === bonusStartStr
  // Open if within 3 days of the occurrence, and (on the start day) past the start time.
  const bonusDueNow = now.getTime() < bonusStart.getTime() + 3 * 24 * 3600 * 1000
    && (!onStartDay || localTimeHHMM(tz) >= bonusTime)
  // One spin per bonus window: a child who spun any day since the occurrence is done.
  const spunSet = new Set((todaySpins || []).filter(s => (s as any).date >= bonusStartStr).map(s => s.child_id))

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

    // Week progress (Mon–Sun): all due occurrences this week vs completed so far
    const myAllTasks = (tasks || []).filter(t => (assignmentMap[t.id] || []).includes(child.id))
    let weekDue = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(now.getDate() + mondayOffset + i)
      weekDue += myAllTasks.filter(t => occursOn(t, d)).length
    }
    const mondayNoon = new Date(now); mondayNoon.setDate(now.getDate() + mondayOffset)
    const weekStartStr = mondayNoon.toISOString().split('T')[0]
    const weekDone = recentCompletions?.filter(c => c.child_id === child.id && c.date >= weekStartStr).length || 0
    const weekPct = weekDue > 0 ? Math.min(100, Math.round((weekDone / weekDue) * 100)) : 0

    return { child, balance, weekStars, streak, badges, level, myTasks, myDone, canSpin, weekPct }
  })

  const leaderboard = [...childData].sort((a, b) => b.weekStars - a.weekStars)
  const tileScroll = childData.length > 3 // ≤3 fill the frame; 4+ scroll horizontally
  const rankMap: Record<string, number> = {}
  leaderboard.forEach((cd, i) => { rankMap[cd.child.id] = i })
  const MEDALS = ['🥇', '🥈', '🥉']

  // Today's completions (with id + date) so the shared task view can show ✓ ticks.
  const windowComps = (completions || [])
    .filter((c: any) => c.status === 'approved' || c.status === 'pending')
    .map((c: any) => ({ id: c.id, task_id: c.task_id, child_id: c.child_id, date: c.date }))

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%)' }}>

      {/* Frozen header + kids tiles — stay pinned while the task preview scrolls */}
      <div className="sticky top-0 z-30" style={{ background: '#f8fafc' }}>
      {/* Header — logo left, centred title, settings right */}
      <div className="px-4 pt-14 pb-2 bg-white border-b border-gray-100">
        <div className="max-w-sm lg:max-w-3xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center">
          <img src="/logo.png" alt="Little Yakka" className="h-20 w-auto justify-self-start"/>
          <span className="text-5xl font-black justify-self-center leading-none" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Home</span>
          <div className="justify-self-end"><ProfileButton/></div>
        </div>
      </div>

      <div className="max-w-sm lg:max-w-3xl mx-auto px-4 pt-3 pb-2">

        {/* Kids tiles — comfortable centred width for 1-2, fill for 3, scroll for more */}
        {childData.length > 0 ? (
          <div className={tileScroll ? 'flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1' : 'flex gap-2.5 justify-center'}>
            {childData.map(({ child, balance, weekStars, streak, myTasks, myDone, canSpin, weekPct }) => {
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
                    <p className="text-xl font-black text-yellow-500 leading-none my-1">⭐ {balance}</p>

                    {/* Week progress (Mon–Sun task completion) */}
                    <div className="mb-1.5">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${weekPct}%`, background: 'var(--theme-gradient)' }}/>
                      </div>
                    </div>

                    {/* Streak — fixed-height slot so progress bars stay aligned across children */}
                    <div className="h-5 mb-1 flex items-center justify-center">
                      {streak > 0 && (
                        <p className="text-xs font-bold text-orange-500">🔥 {streak}d streak</p>
                      )}
                    </div>

                    {total > 0 && (
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">{allDone ? '✅ All done!' : `${myDone}/${total} tasks today`}</p>
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
          <GetStartedHero/>
        )}
      </div>
      </div>

      <div className="max-w-sm lg:max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* Task view — the SAME shared UpcomingTaskList as the Tasks page, next 2 days */}
        {childData.length > 0 && (
          <HomeTaskPreview tasks={tasks || []} childrenList={children || []} assignments={assignmentMap} windowComps={windowComps} />
        )}
      </div>
    </div>
  )
}
