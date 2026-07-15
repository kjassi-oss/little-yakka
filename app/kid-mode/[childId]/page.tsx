import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ChildTaskView from './ChildTaskView'
import RealtimeRefresh from '@/components/RealtimeRefresh'
import { occursOn, mondayOf, ymd } from '@/lib/recurrence'
import { localNow, localDateStr, parseTzCookie } from '@/lib/localDate'

export default async function ChildPage({ params, searchParams }: {
  params: Promise<{ childId: string }>
  searchParams: Promise<{ task?: string; spin?: string }>
}) {
  const { childId } = await params
  const { task: highlightTaskId, spin: autoSpin } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Stage 1 (parallel): the child + the caller's family id
  const [{ data: child }, { data: guardian }] = await Promise.all([
    supabase.from('children').select('*').eq('id', childId).single(),
    supabase.from('guardians').select('family_id').eq('auth_user_id', user.id).single(),
  ])
  if (!child) redirect('/kid-mode')

  // Timezone-aware dates
  const cookieStore = await cookies()
  const tz = parseTzCookie(cookieStore.get('tz')?.value)
  const now = localNow(tz)
  const todayStr = localDateStr(new Date(), tz)
  const monday = mondayOf(now)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const weekEndStr = ymd(sunday)
  const mondayStr = ymd(monday)
  const horizonEnd = new Date(monday); horizonEnd.setDate(monday.getDate() + 20)
  const thirtyAgo = new Date(now); thirtyAgo.setDate(now.getDate() - 30)

  // Stage 2: everything else in ONE parallel batch (was ~12 sequential trips)
  const [
    { data: family }, { data: assignments }, { data: completions }, { data: completedHistory },
    { data: starData }, { data: rewards }, { data: pendingRedemptions }, { data: ufgData },
    { count: totalCompletions }, { data: unlockRows }, { data: spinToday }, { data: unseenPraises },
    { data: redeemedRows }, { data: siblings },
  ] = await Promise.all([
    supabase.from('families').select('*').eq('id', guardian?.family_id).maybeSingle(),
    supabase.from('task_assignments').select('task_id, tasks(*)').eq('child_id', childId),
    supabase.from('completions').select('id, task_id, child_id, date, created_at').eq('child_id', childId)
      .gte('date', ymd(thirtyAgo)).lte('date', ymd(horizonEnd)),
    supabase.from('completions')
      .select('task_id, date, created_at, tasks(title, emoji, star_value)')
      .eq('child_id', childId).eq('status', 'approved')
      .gte('date', ymd(thirtyAgo))
      .order('created_at', { ascending: false }).limit(60),
    supabase.from('star_ledger').select('delta, created_at, source_type, source_id').eq('child_id', childId),
    supabase.from('rewards').select('id, title, emoji, star_cost').eq('family_id', guardian?.family_id)
      .or(`scope.eq.family,and(scope.eq.child,child_id.eq.${childId})`).order('star_cost'),
    supabase.from('redemptions').select('reward_id').eq('child_id', childId).eq('status', 'requested'),
    supabase.from('tasks').select('*').eq('family_id', guardian?.family_id).eq('up_for_grabs', true),
    supabase.from('completions').select('id', { count: 'exact', head: true })
      .eq('child_id', childId).eq('status', 'approved'),
    supabase.from('child_unlocks').select('item_id').eq('child_id', childId),
    supabase.from('spin_results').select('date').eq('child_id', childId).gte('date', localDateStr(new Date(Date.now() - 30 * 86400000), tz)),
    supabase.from('praises').select('id, message').eq('child_id', childId).eq('seen', false).order('created_at'),
    supabase.from('redemptions').select('id, created_at, rewards(title, emoji, star_cost)')
      .eq('child_id', childId).eq('status', 'approved')
      .order('created_at', { ascending: false }).limit(50),
    // Realtime watches every child in the family, not just this one: a sibling
    // claiming an up-for-grabs task has to refresh this page too.
    supabase.from('children').select('id').eq('family_id', guardian?.family_id),
  ])
  const allTasks = (assignments?.map(a => a.tasks).flat().filter(Boolean) || []) as any[]

  // Build occurrences from this Monday through 3-week horizon
  const occurrences: any[] = []
  for (let d = new Date(monday); d <= horizonEnd; d.setDate(d.getDate() + 1)) {
    const ds = ymd(d)
    for (const t of allTasks) {
      if (occursOn(t, d)) {
        occurrences.push({
          id: `${t.id}|${ds}`, taskId: t.id, title: t.title, emoji: t.emoji,
          star_value: t.star_value, time_of_day: t.time_of_day ?? null, date: ds,
          canDoEarly: (t as any).can_do_early ?? true,
          carryOver: (t as any).carry_over ?? true,
        })
      }
    }
  }

  const completedKeys = (completions || []).map(c => `${c.task_id}|${c.date}`)

  // Up-for-grabs bounties — one-offs any child can claim (first done wins).
  // Hidden once a sibling claims it; shown as claimed (with undo) if THIS child got it.
  const ufgAvailable = (ufgData || []).filter((t: any) => !t.expires_on || t.expires_on >= todayStr)
  const ufgTasksForList: any[] = []
  let ufgClaims: { id: string; task_id: string; child_id: string; date: string }[] = []
  if (ufgAvailable.length) {
    const { data: ufgComps } = await supabase
      .from('completions').select('id, task_id, child_id, date').in('task_id', ufgAvailable.map((t: any) => t.id))
    const claimedBy: Record<string, string> = {}
    ;(ufgComps || []).forEach((c: any) => { claimedBy[c.task_id] = c.child_id })
    for (const t of ufgAvailable) {
      const claimer = claimedBy[t.id]
      if (claimer && claimer !== childId) continue // a sibling got there first
      ufgTasksForList.push(t)
    }
    ufgClaims = (ufgComps || [])
      .filter((c: any) => c.child_id === childId)
      .map((c: any) => ({ id: c.id as string, task_id: c.task_id as string, child_id: c.child_id as string, date: c.date as string }))
  }

  // Completed history (last 30 days) for the "Done" tab — with timestamps
  const doneHistory = (completedHistory || []).map(c => ({
    key: `${c.task_id}|${c.date}`,
    date: c.date as string,
    createdAt: c.created_at as string,
    title: (c.tasks as any)?.title || '',
    emoji: (c.tasks as any)?.emoji || '⭐',
    starValue: (c.tasks as any)?.star_value || 0,
  }))

  const starBalance = starData?.reduce((sum, r) => sum + r.delta, 0) || 0
  const pendingRewardIds = pendingRedemptions?.map(r => r.reward_id) || []
  const unlockedIds = (unlockRows || []).map(r => r.item_id as string)

  // My Rewards — redeemed history with before/after balances from the ledger
  const ledger = [...(starData || [])].sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1))
  let running = 0
  const balBySource: Record<string, { before: number; after: number }> = {}
  for (const row of ledger as any[]) {
    const before = running
    running += row.delta
    if (row.source_type === 'redemption' && row.source_id) balBySource[row.source_id] = { before, after: running }
  }
  const myRewards = (redeemedRows || []).map((r: any) => ({
    id: r.id as string,
    title: r.rewards?.title || 'Reward',
    emoji: r.rewards?.emoji || '🎁',
    cost: r.rewards?.star_cost || 0,
    date: r.created_at as string,
    before: balBySource[r.id]?.before ?? null,
    after: balBySource[r.id]?.after ?? null,
  }))

  // Streak — uses the 30-day history, with a 🧊 freeze: one missed day per
  // rolling 7 days is forgiven so a single slip doesn't wipe a long streak.
  let streakDays = 0
  let lastFreeze = -99
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const ds = localDateStr(d, tz)
    const tasksOnDay = allTasks.filter((t: any) => occursOn(t, d))
    if (tasksOnDay.length === 0) continue
    const doneOnDay = (completedHistory || []).filter(c => c.date === ds).length
    if (doneOnDay >= tasksOnDay.length) streakDays++
    else if (i === 0) continue // today still in progress
    else if (i - lastFreeze > 7) { lastFreeze = i; continue } // streak freeze 🧊
    else break
  }

  // Bonus wheel cadence + award value. The prize is based on performance over a
  // ROLLING window ending today: the previous 7 days (weekly) or 28 days (monthly).
  const cadence = family?.bonus_cadence === 'monthly' ? 'monthly' : 'weekly'
  const isMonthly = cadence === 'monthly'
  // Award ceiling = this % of the window's available stars (slider in Settings, default 50%)
  const awardPct = ((family as any)?.bonus_award_pct ?? 50) / 100

  const windowDays = isMonthly ? 28 : 7
  const prizeStart = new Date(now); prizeStart.setDate(now.getDate() - (windowDays - 1)) // inclusive of today
  const prizeStartStr = ymd(prizeStart)

  // Total stars available + tasks expected across the rolling window (through today)
  let periodTotalStars = 0
  let tierExpected = 0
  for (let d = new Date(prizeStart); ymd(d) <= todayStr; d.setDate(d.getDate() + 1)) {
    for (const t of allTasks) {
      if (occursOn(t, d)) { periodTotalStars += t.star_value; tierExpected++ }
    }
  }
  const tierDone = (completions || []).filter(c => c.date >= prizeStartStr && c.date <= todayStr).length
  const completionRatio = tierExpected > 0 ? tierDone / tierExpected : 0

  // Ceiling scales with the award-value slider; performance scales within the ceiling.
  const ceiling = Math.round(periodTotalStars * awardPct)
  let maxPrize = 1
  if (periodTotalStars === 0) {
    maxPrize = 1
  } else if (completionRatio >= 0.8) {
    maxPrize = Math.max(1, ceiling)
  } else if (completionRatio >= 0.5) {
    maxPrize = Math.max(2, Math.round(ceiling * 0.6))
  } else if (completionRatio > 0) {
    maxPrize = Math.max(1, Math.round(ceiling * 0.3))
  } else {
    maxPrize = 1
  }

  // Bonus wheel timing
  const bonusDay = family?.bonus_day ?? 0
  const bonusTime = (family?.bonus_time || '16:00').toString().slice(0, 5)
  // Bonus wheel opens on the scheduled occurrence and stays open for 3 days (one spin per window).
  const _bn = localNow(tz)
  if (isMonthly) { if (_bn.getDate() < bonusDay) _bn.setMonth(_bn.getMonth() - 1); _bn.setDate(bonusDay) }
  else { _bn.setDate(_bn.getDate() - ((_bn.getDay() - bonusDay + 7) % 7)) }
  const bonusStartStr = localDateStr(_bn, tz)
  const hasSpunToday = ((spinToday as any[]) || []).some(s => s.date >= bonusStartStr)

  // ── Raw data for the shared UpcomingTaskList (Kids Zone renders through it) ──
  const assignmentsMap: Record<string, string[]> = {}
  for (const t of allTasks) assignmentsMap[t.id] = [childId]
  const taskById = new Map<string, any>(allTasks.map((t: any) => [t.id, t]))
  for (const t of ufgTasksForList) if (!taskById.has(t.id)) taskById.set(t.id, t)
  const tasksForList = [...taskById.values()]
  const windowComps = (completions || []).map((c: any) => ({ id: c.id as string, task_id: c.task_id as string, child_id: childId, date: c.date as string }))
  // This week's claimable occurrences (excludes ufg bounties) for header + celebration
  const claimableOccs = occurrences.filter((o: any) => !o.upForGrabs && o.date >= mondayStr && o.date <= weekEndStr)
  const claimableTotal = claimableOccs.length
  const claimableDoneInit = claimableOccs.filter((o: any) => completedKeys.includes(o.id)).length

  return (<>
    {/* Live sync: refresh this page when completions/stars change elsewhere */}
    <RealtimeRefresh familyId={guardian?.family_id} childIds={(siblings || []).map(s => s.id)} />
    <ChildTaskView
      child={child}
      tasks={tasksForList}
      assignments={assignmentsMap}
      windowComps={windowComps}
      ufgClaims={ufgClaims}
      claimableTotal={claimableTotal}
      claimableDoneInit={claimableDoneInit}
      weekEndStr={weekEndStr}
      mondayStr={mondayStr}
      todayStr={todayStr}
      starBalance={starBalance}
      rewards={rewards || []}
      pendingRewardIds={pendingRewardIds}
      hasSpunToday={hasSpunToday}
      bonusCadence={cadence as 'weekly' | 'monthly'}
      bonusDay={bonusDay}
      bonusTime={bonusTime}
      maxPrize={maxPrize}
      streakDays={streakDays}
      doneHistory={doneHistory}
      unseenPraises={unseenPraises || []}
      highlightTaskId={highlightTaskId || null}
      autoSpin={autoSpin === '1'}
      totalCompletions={totalCompletions ?? 0}
      unlockedIds={unlockedIds}
      myRewards={myRewards}
    />
  </>)
}
