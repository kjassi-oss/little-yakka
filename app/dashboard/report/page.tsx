import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
  if (!guardian) redirect('/setup')

  const { data: children } = await supabase
    .from('children').select('*').eq('family_id', guardian.family_id).order('name')
  const childIds = children?.map(c => c.id) || []

  // This week (Mon–Sun)
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const [{ data: weekCompletions }, { data: weekStarData }, { data: allCompletions }, { data: allStarData }] = await Promise.all([
    supabase.from('completions').select('child_id, date, task_id').eq('status', 'approved')
      .in('child_id', childIds.length ? childIds : ['none']).gte('date', weekStartStr),
    supabase.from('star_ledger').select('child_id, delta, created_at')
      .in('child_id', childIds.length ? childIds : ['none']).gte('created_at', weekStart.toISOString()).gt('delta', 0),
    supabase.from('completions').select('child_id, date').eq('status', 'approved')
      .in('child_id', childIds.length ? childIds : ['none']).gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]),
    supabase.from('star_ledger').select('child_id, delta')
      .in('child_id', childIds.length ? childIds : ['none']),
  ])

  // Per-child stats
  const childStats = (children || []).map(child => {
    const myWeekCompletions = weekCompletions?.filter(c => c.child_id === child.id) || []
    const myWeekStars = weekStarData?.filter(s => s.child_id === child.id).reduce((sum, s) => sum + s.delta, 0) || 0
    const myAllStars = allStarData?.filter(s => s.child_id === child.id).reduce((sum, s) => sum + s.delta, 0) || 0
    const myAllDates = [...new Set(allCompletions?.filter(c => c.child_id === child.id).map(c => c.date) || [])]
    const streak = computeStreak(myAllDates)
    const completionsByDay: Record<string, number> = {}
    myWeekCompletions.forEach(c => { completionsByDay[c.date] = (completionsByDay[c.date] || 0) + 1 })
    return { child, weekCompletions: myWeekCompletions.length, weekStars: myWeekStars, allStars: myAllStars, streak, completionsByDay }
  })

  // Days of the week strip
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  })
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const todayStr = now.toISOString().split('T')[0]

  // Family totals
  const totalWeekStars = childStats.reduce((s, c) => s + c.weekStars, 0)
  const totalWeekTasks = childStats.reduce((s, c) => s + c.weekCompletions, 0)
  const topKid = [...childStats].sort((a, b) => b.weekStars - a.weekStars)[0]

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="pt-10 pb-4 px-4" style={{ background: 'linear-gradient(135deg, var(--theme-from, #7C3AED), var(--theme-to, #EC4899))' }}>
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="text-lg font-bold text-white">Weekly Report</h1>
              <p className="text-white/60 text-xs">Week of {weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</p>
            </div>
          </div>
          <Link href="/dashboard" className="text-white/70 text-sm font-semibold">← Home</Link>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-4">

        {/* Family summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Stars earned', value: `⭐ ${totalWeekStars}`, sub: 'this week' },
            { label: 'Tasks done', value: `✅ ${totalWeekTasks}`, sub: 'this week' },
            { label: 'Top kid', value: topKid ? topKid.child.avatar : '—', sub: topKid?.child.name.split(' ')[0] || 'none' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-2xl p-3 text-center shadow-sm">
              <p className="text-xl font-black text-gray-800">{item.value}</p>
              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Day activity strip */}
        <div className="bg-white rounded-3xl shadow-sm p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Daily activity</p>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day, i) => {
              const ds = day.toISOString().split('T')[0]
              const count = weekCompletions?.filter(c => c.date === ds).length || 0
              const isToday = ds === todayStr
              const isFuture = ds > todayStr
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <p className="text-[9px] font-bold text-gray-400">{DAY_LABELS[i]}</p>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                    isFuture ? 'bg-gray-100 text-gray-300' :
                    count === 0 ? 'bg-red-50 text-red-300' :
                    'text-white'
                  }`}
                    style={!isFuture && count > 0 ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                    {isFuture ? '·' : count > 0 ? count : '✗'}
                  </div>
                  {isToday && <div className="w-1 h-1 rounded-full" style={{ background: 'var(--theme-from)' }}/>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Per-kid breakdown */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Kid breakdown</p>
        {childStats.map(({ child, weekCompletions: wc, weekStars: ws, allStars, streak }) => {
          const maxStars = Math.max(...childStats.map(s => s.weekStars), 1)
          const barPct = Math.round((ws / maxStars) * 100)
          return (
            <div key={child.id} className="bg-white rounded-3xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                {child.avatar_url
                  ? <img src={child.avatar_url} className="w-12 h-12 rounded-2xl object-cover" alt=""/>
                  : <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: child.colour + '25' }}>{child.avatar}</div>
                }
                <div className="flex-1">
                  <p className="font-black text-gray-800">{child.name.split(' ')[0]}</p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs text-yellow-500 font-bold">⭐ {ws} this week</span>
                    <span className="text-xs text-gray-400">✅ {wc} tasks</span>
                    {streak > 0 && <span className="text-xs font-bold" style={{ color: 'var(--theme-from)' }}>🔥 {streak} day streak</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">All time</p>
                  <p className="font-bold text-yellow-500 text-sm">⭐ {allStars}</p>
                </div>
              </div>
              {/* Star bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${barPct}%`, backgroundColor: child.colour }}/>
              </div>
            </div>
          )
        })}

        {childStats.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-500">No kids added yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

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
