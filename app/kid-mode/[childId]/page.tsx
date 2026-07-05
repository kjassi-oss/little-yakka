import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ChildTaskView from './ChildTaskView'
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
    { data: redeemedRows },
  ] = await Promise.all([
    supabase.from('families').select('*').eq('id', guardian?.family_id).maybeSingle(),
    supabase.from('task_assignments').select('task_id, tasks(*)').eq('child_id', childId),
    supabase.from('completions').select('task_id, date, created_at').eq('child_id', childId)
      .gte('date', mondayStr).lte('date', ymd(horizonEnd)),
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
    supabase.from('spin_results').select('id').eq('child_id', childId).eq('date', todayStr).maybeSingle(),
    supabase.from('praises').select('id, message').eq('child_id', childId).eq('seen', false).order('created_at'),
    supabase.from('redemptions').select('id, created_at, rewards(title, emoji, star_cost)')
      .eq('child_id', childId).eq('status', 'approved')
      .order('created_at', { ascending: false }).limit(50),
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
  // Shown on today until claimed/expired; hidden here once a sibling claims it.
  const ufgTasks = (ufgData || []).filter((t: any) => !t.expires_on || t.expires_on >= todayStr)
  if (ufgTasks.length) {
    const { data: ufgComps } = await supabase
      .from('completions').select('task_id, child_id, date').in('task_id', ufgTasks.map((t: any) => t.id))
    const claimedBy: Record<string, string> = {}
    ;(ufgComps || []).forEach((c: any) => { claimedBy[c.task_id] = c.child_id })
    for (const t of ufgTasks) {
      const claimer = claimedBy[t.id]
      if (claimer && claimer !== childId) continue // a sibling got there first
      occurrences.push({
        id: `${t.id}|${todayStr}`, taskId: t.id, title: t.title, emoji: t.emoji,
        star_value: t.star_value, time_of_day: t.time_of_day ?? null, date: todayStr,
        canDoEarly: true, carryOver: true, upForGrabs: true,
      })
      // claimed by THIS child (possibly on an earlier day) — show as done
      if (claimer && !completedKeys.includes(`${t.id}|${todayStr}`)) completedKeys.push(`${t.id}|${todayStr}`)
    }
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

  // Bonus wheel cadence + award value (weekly = Mon–Sun; monthly = calendar month)
  const cadence = family?.bonus_cadence === 'monthly' ? 'monthly' : 'weekly'
  const isMonthly = cadence === 'monthly'
  // Award ceiling = this % of the period's available stars (slider in Settings, default 50%)
  const awardPct = ((family as any)?.bonus_award_pct ?? 50) / 100

  const prizeStart = isMonthly ? new Date(now.getFullYear(), now.getMonth(), 1, 12) : new Date(monday)
  const prizeEnd = isMonthly ? new Date(now.getFullYear(), now.getMonth() + 1, 0, 12) : new Date(sunday)
  const prizeStartStr = ymd(prizeStart)

  let periodTotalStars = 0
  for (let d = new Date(prizeStart); ymd(d) <= ymd(prizeEnd); d.setDate(d.getDate() + 1)) {
    for (const t of allTasks) {
      if (occursOn(t, d)) periodTotalStars += t.star_value
    }
  }
  let tierExpected = 0
  for (let d = new Date(prizeStart); ymd(d) <= todayStr; d.setDate(d.getDate() + 1)) {
    for (const t of allTasks) {
      if (occursOn(t, d)) tierExpected++
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
  const hasSpunToday = !!spinToday

  return (
    <ChildTaskView
      child={child}
      occurrences={occurrences}
      completedKeys={completedKeys}
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
  )
}
