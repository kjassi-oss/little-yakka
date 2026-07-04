'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import LoadingLogo from '@/components/LoadingLogo'
import ProfileButton from '@/components/ProfileButton'
import { occursOn, type RecurringTask } from '@/lib/recurrence'
import { localDateStr, parseTzCookie } from '@/lib/localDate'
import { getCachedFamily } from '@/lib/familyCache'

interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string }
interface TaskMeta extends RecurringTask { id: string }
type Period = 'week' | 'month'

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0
  const set = new Set(dates)
  const local = (d: Date) => new Intl.DateTimeFormat('en-CA').format(d) // local YYYY-MM-DD
  const check = new Date()
  // Today may still be in progress — a blank today shouldn't zero the streak
  if (!set.has(local(check))) check.setDate(check.getDate() - 1)
  let streak = 0
  let sinceFreeze = 99 // streak freeze 🧊 — forgive one missed day per rolling week
  for (let i = 0; i < 90; i++) {
    if (set.has(local(check))) { streak++; sinceFreeze++ }
    else if (sinceFreeze > 7) { sinceFreeze = 0 }
    else break
    check.setDate(check.getDate() - 1)
  }
  return streak
}

export default function AnalyticsPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [tasks, setTasks] = useState<TaskMeta[]>([])
  const [assignPairs, setAssignPairs] = useState<{ task_id: string; child_id: string }[]>([])
  const [completions, setCompletions] = useState<{ child_id: string; date: string; task_id: string }[]>([])
  const [stars, setStars] = useState<{ child_id: string; delta: number; created_at: string }[]>([])
  const [recent30, setRecent30] = useState<{ child_id: string; date: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('week')
  const [selectedKid, setSelectedKid] = useState<string | null>(null)
  const [tz] = useState(() => parseTzCookie(typeof document !== 'undefined' ? document.cookie : undefined))

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    // Cached family + one parallel batch (RLS scopes everything to this family)
    const fam = await getCachedFamily(supabase)
    if (!fam) return
    const thirty = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    const [{ data: childrenData }, { data: tasksData }, { data: assignData }, { data: compData }, { data: starData }, { data: recentData }] = await Promise.all([
      supabase.from('children').select('*').eq('family_id', fam.familyId).order('name'),
      supabase.from('tasks').select('id, frequency, start_date, created_at, days_of_week').eq('family_id', fam.familyId),
      supabase.from('task_assignments').select('task_id, child_id'),
      supabase.from('completions').select('child_id, date, task_id').eq('status', 'approved').gte('date', thirty),
      supabase.from('star_ledger').select('child_id, delta, created_at').gte('created_at', thirty + 'T00:00:00'),
      supabase.from('completions').select('child_id, date').eq('status', 'approved').gte('date', thirty),
    ])

    setChildren(childrenData || [])
    setTasks(tasksData || [])
    setAssignPairs(assignData || [])
    setCompletions(compData || [])
    setStars(starData || [])
    setRecent30(recentData || [])
    setLoading(false)
  }

  // Period boundaries (Mon–Sun week / calendar month) computed in the user's timezone.
  const { startStr, todayStr, label } = useMemo(() => {
    const todayS = localDateStr(new Date(), tz)
    const [ty, tm, td] = todayS.split('-').map(Number)
    if (period === 'week') {
      const ref = new Date(ty, tm - 1, td, 12, 0, 0)
      const dow = ref.getDay()
      const offset = dow === 0 ? -6 : 1 - dow
      const start = new Date(ref); start.setDate(ref.getDate() + offset)
      const y = start.getFullYear(), m = String(start.getMonth() + 1).padStart(2, '0'), d = String(start.getDate()).padStart(2, '0')
      return { startStr: `${y}-${m}-${d}`, todayStr: todayS, label: 'this week' }
    }
    return { startStr: `${ty}-${String(tm).padStart(2, '0')}-01`, todayStr: todayS, label: 'this month' }
  }, [period, tz])

  // Days from period start through today (inclusive), as noon-local Dates for occursOn.
  const periodDays = useMemo(() => {
    const out: Date[] = []
    const [sy, sm, sd] = startStr.split('-').map(Number)
    const d = new Date(sy, sm - 1, sd, 12, 0, 0)
    const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    while (fmt(d) <= todayStr) { out.push(new Date(d)); d.setDate(d.getDate() + 1) }
    return out
  }, [startStr, todayStr])

  const stats = useMemo(() => {
    const kids = selectedKid ? children.filter(c => c.id === selectedKid) : children
    const kidIds = new Set(kids.map(c => c.id))
    const taskById: Record<string, TaskMeta> = {}
    tasks.forEach(t => { taskById[t.id] = t })

    // Tasks actually due so far this period, per child, via occursOn (frequency aware).
    function expectedFor(ids: Set<string>): number {
      let total = 0
      for (const day of periodDays) {
        for (const a of assignPairs) {
          if (!ids.has(a.child_id)) continue
          const t = taskById[a.task_id]
          if (t && occursOn(t, day)) total++
        }
      }
      return total
    }

    const expected = expectedFor(kidIds)
    const periodComps = completions.filter(c => kidIds.has(c.child_id) && c.date >= startStr && c.date <= todayStr)
    const done = periodComps.length
    const pct = expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : 0

    const periodStars = stars
      .filter(s => kidIds.has(s.child_id) && s.created_at.split('T')[0] >= startStr)
      .reduce((sum, s) => sum + s.delta, 0)

    const byDay: Record<string, number> = {}
    periodComps.forEach(c => { byDay[c.date] = (byDay[c.date] || 0) + 1 })
    const bestDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]

    const perKid = children.map(child => {
      const ids = new Set([child.id])
      const myExpected = expectedFor(ids)
      const myDone = completions.filter(c => c.child_id === child.id && c.date >= startStr && c.date <= todayStr).length
      const myPct = myExpected > 0 ? Math.min(100, Math.round((myDone / myExpected) * 100)) : 0
      const myStars = stars.filter(s => s.child_id === child.id && s.created_at.split('T')[0] >= startStr).reduce((sum, s) => sum + s.delta, 0)
      const myStreak = computeStreak([...new Set(recent30.filter(c => c.child_id === child.id).map(c => c.date))])
      return { child, done: myDone, pct: myPct, stars: myStars, streak: myStreak }
    })

    const topStreak = Math.max(0, ...perKid.filter(k => kidIds.has(k.child.id)).map(k => k.streak))

    return { done, expected, pct, periodStars, bestDay, perKid, topStreak }
  }, [selectedKid, children, tasks, assignPairs, completions, stars, recent30, startStr, todayStr, periodDays])

  if (loading) return (
    <LoadingLogo />
  )

  const ringR = 52
  const ringC = 2 * Math.PI * ringR
  const completionLeaders = [...stats.perKid].sort((a, b) => b.pct - a.pct)
  const starLeaders = [...stats.perKid].sort((a, b) => b.stars - a.stars)
  const maxStars = Math.max(...stats.perKid.map(k => k.stars), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header — logo left, centred title, settings right */}
      <div className="pt-11 pb-2.5 px-4 bg-white border-b border-gray-100">
        <div className="max-w-sm lg:max-w-3xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center">
          <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto justify-self-start" onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
          <span className="text-4xl font-black leading-none justify-self-center" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Summary</span>
          <div className="justify-self-end"><ProfileButton/></div>
        </div>
      </div>

      {/* Week / Month tabs */}
      <div className="bg-white px-4 pt-2.5 pb-1">
        <div className="max-w-sm lg:max-w-3xl mx-auto flex bg-gray-100 rounded-2xl p-1 gap-1">
          {(['week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`flex-1 py-1.5 rounded-xl text-sm font-semibold transition ${period === p ? 'text-white shadow' : 'text-gray-400'}`}
              style={period === p ? { background: 'var(--theme-gradient)' } : {}}>
              {p === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Kid filter thumbnails */}
      {children.length > 0 && (() => {
        const scroll = children.length + 1 > 4 // ≤4 (incl. All) fill the width; more → scroll
        const item = scroll ? 'flex-shrink-0 w-16' : 'flex-1 min-w-0'
        return (
          <div className="bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
            <div className={`max-w-sm lg:max-w-3xl mx-auto flex gap-2 ${scroll ? 'overflow-x-auto' : ''}`}>
              <button onClick={() => setSelectedKid(null)} className={`flex flex-col items-center gap-1 active:scale-95 transition ${item}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black ${!selectedKid ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                  style={!selectedKid ? { background: 'var(--theme-gradient)', boxShadow: '0 0 0 3px white, 0 0 0 5px var(--theme-from)' } : {}}>All</div>
                <span className="text-[10px] font-bold" style={{ color: !selectedKid ? 'var(--theme-from)' : '#9ca3af' }}>Everyone</span>
              </button>
              {children.map(child => {
                const sel = selectedKid === child.id
                return (
                  <button key={child.id} onClick={() => setSelectedKid(sel ? null : child.id)}
                    className={`flex flex-col items-center gap-1 active:scale-95 transition ${item}`}>
                    {child.avatar_url
                      ? <img src={child.avatar_url} className="w-12 h-12 rounded-full object-cover" alt=""
                          style={{ boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}/>
                      : <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                          style={{ backgroundColor: child.colour + '25', boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}>{child.avatar}</div>}
                    <span className="text-[10px] font-bold truncate max-w-[60px]" style={{ color: sel ? child.colour : '#9ca3af' }}>{child.name.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      <div className="max-w-sm lg:max-w-3xl mx-auto px-4 mt-4 space-y-4">
        {/* Completion ring hero */}
        <div className="bg-white rounded-3xl shadow-sm p-5 flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r={ringR} fill="none" stroke="#f1f5f9" strokeWidth="12"/>
              <circle cx="65" cy="65" r={ringR} fill="none" stroke="var(--theme-from)" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={ringC} strokeDashoffset={ringC - (ringC * stats.pct) / 100}
                transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
              <text x="65" y="60" textAnchor="middle" fontSize="28" fontWeight="900" fill="#1f2937">{stats.pct}%</text>
              <text x="65" y="80" textAnchor="middle" fontSize="11" fill="#9ca3af" fontWeight="600">done</text>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Task completion {label}</p>
            <p className="text-3xl font-black text-gray-800 mt-1">{stats.done}<span className="text-lg text-gray-300"> / {stats.expected}</span></p>
            <p className="text-xs text-gray-400 mt-0.5">tasks completed</p>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: `⭐ ${stats.periodStars}`, l: 'stars earned' },
            { v: `✅ ${stats.done}`, l: 'tasks done' },
            { v: `🔥 ${stats.topStreak}`, l: 'best streak' },
          ].map(s => (
            <div key={s.l} className="bg-white rounded-2xl p-3 text-center shadow-sm">
              <p className="text-lg font-black text-gray-800">{s.v}</p>
              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Completion champions */}
        {!selectedKid && children.length > 1 && (
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🏆 Completion champions</p>
            <div className="space-y-3">
              {completionLeaders.map((k, i) => (
                <div key={k.child.id} className="flex items-center gap-3">
                  <span className="text-sm w-5 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '·'}</span>
                  {k.child.avatar_url
                    ? <img src={k.child.avatar_url} className="w-7 h-7 rounded-full object-cover" alt=""/>
                    : <div className="w-7 h-7 rounded-full flex items-center justify-center text-base" style={{ backgroundColor: k.child.colour + '33' }}>{k.child.avatar}</div>}
                  <span className="text-sm font-bold text-gray-700 w-14 truncate">{k.child.name.split(' ')[0]}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${k.pct}%`, backgroundColor: k.child.colour }}/>
                  </div>
                  <span className="text-xs font-black text-gray-600 w-9 text-right">{k.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stars earned chart */}
        {!selectedKid && children.length > 1 && (
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">⭐ Stars earned {label}</p>
            <div className="space-y-3">
              {starLeaders.map(k => (
                <div key={k.child.id} className="flex items-center gap-3">
                  {k.child.avatar_url
                    ? <img src={k.child.avatar_url} className="w-7 h-7 rounded-full object-cover" alt=""/>
                    : <div className="w-7 h-7 rounded-full flex items-center justify-center text-base" style={{ backgroundColor: k.child.colour + '33' }}>{k.child.avatar}</div>}
                  <span className="text-sm font-bold text-gray-700 w-14 truncate">{k.child.name.split(' ')[0]}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(6, (k.stars / maxStars) * 100)}%`, backgroundColor: k.child.colour }}/>
                  </div>
                  <span className="text-xs font-black text-yellow-500 w-10 text-right">{k.stars}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {children.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-500">No kids added yet</p>
            <Link href="/dashboard/settings" className="text-sm font-semibold" style={{ color: 'var(--theme-from)' }}>Add children in Settings →</Link>
          </div>
        )}

        <p className="text-[10px] text-center text-gray-300 px-6">Completion % is estimated from each child's assigned tasks across the days so far {label}.</p>
      </div>
    </div>
  )
}
