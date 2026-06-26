'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string }
type Period = 'week' | 'month'

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0
  const set = new Set(dates)
  const check = new Date()
  let streak = 0
  while (true) {
    const ds = check.toISOString().split('T')[0]
    if (set.has(ds)) { streak++; check.setDate(check.getDate() - 1) }
    else break
  }
  return streak
}

export default function AnalyticsPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [assignPairs, setAssignPairs] = useState<{ task_id: string; child_id: string }[]>([])
  const [completions, setCompletions] = useState<{ child_id: string; date: string; task_id: string }[]>([])
  const [stars, setStars] = useState<{ child_id: string; delta: number; created_at: string }[]>([])
  const [recent30, setRecent30] = useState<{ child_id: string; date: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('week')
  const [selectedKid, setSelectedKid] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: guardian } = await supabase.from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return

    const { data: childrenData } = await supabase
      .from('children').select('*').eq('family_id', guardian.family_id).order('name')
    const childIds = childrenData?.map(c => c.id) || []
    const thirty = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    const [{ data: assignData }, { data: compData }, { data: starData }, { data: recentData }] = await Promise.all([
      supabase.from('task_assignments').select('task_id, child_id').in('child_id', childIds.length ? childIds : ['none']),
      supabase.from('completions').select('child_id, date, task_id').eq('status', 'approved')
        .in('child_id', childIds.length ? childIds : ['none']).gte('date', thirty),
      supabase.from('star_ledger').select('child_id, delta, created_at')
        .in('child_id', childIds.length ? childIds : ['none']).gt('delta', 0).gte('created_at', thirty + 'T00:00:00'),
      supabase.from('completions').select('child_id, date').eq('status', 'approved')
        .in('child_id', childIds.length ? childIds : ['none']).gte('date', thirty),
    ])

    setChildren(childrenData || [])
    setAssignPairs(assignData || [])
    setCompletions(compData || [])
    setStars(starData || [])
    setRecent30(recentData || [])
    setLoading(false)
  }

  // Period boundaries
  const { startStr, daysElapsed, label } = useMemo(() => {
    const now = new Date()
    if (period === 'week') {
      const dow = now.getDay()
      const offset = dow === 0 ? -6 : 1 - dow
      const start = new Date(now); start.setDate(now.getDate() + offset); start.setHours(0, 0, 0, 0)
      const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
      const days = Math.round((todayMid.getTime() - start.getTime()) / 86400000) + 1
      return { startStr: start.toISOString().split('T')[0], daysElapsed: days, label: 'this week' }
    } else {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startStr: start.toISOString().split('T')[0], daysElapsed: now.getDate(), label: 'this month' }
    }
  }, [period])

  const stats = useMemo(() => {
    const kids = selectedKid ? children.filter(c => c.id === selectedKid) : children
    const kidIds = new Set(kids.map(c => c.id))

    const assignedPerDay = assignPairs.filter(a => kidIds.has(a.child_id)).length
    const expected = Math.max(assignedPerDay * daysElapsed, 0)

    const periodComps = completions.filter(c => kidIds.has(c.child_id) && c.date >= startStr)
    const done = periodComps.length
    const pct = expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : 0

    const periodStars = stars
      .filter(s => kidIds.has(s.child_id) && s.created_at.split('T')[0] >= startStr)
      .reduce((sum, s) => sum + s.delta, 0)

    const byDay: Record<string, number> = {}
    periodComps.forEach(c => { byDay[c.date] = (byDay[c.date] || 0) + 1 })
    const bestDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]

    const perKid = children.map(child => {
      const myAssigned = assignPairs.filter(a => a.child_id === child.id).length
      const myExpected = Math.max(myAssigned * daysElapsed, 0)
      const myDone = completions.filter(c => c.child_id === child.id && c.date >= startStr).length
      const myPct = myExpected > 0 ? Math.min(100, Math.round((myDone / myExpected) * 100)) : 0
      const myStars = stars.filter(s => s.child_id === child.id && s.created_at.split('T')[0] >= startStr).reduce((sum, s) => sum + s.delta, 0)
      const myStreak = computeStreak([...new Set(recent30.filter(c => c.child_id === child.id).map(c => c.date))])
      return { child, done: myDone, pct: myPct, stars: myStars, streak: myStreak }
    })

    const topStreak = Math.max(0, ...perKid.filter(k => kidIds.has(k.child.id)).map(k => k.streak))

    return { done, expected, pct, periodStars, bestDay, perKid, topStreak }
  }, [selectedKid, children, assignPairs, completions, stars, recent30, startStr, daysElapsed])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="text-5xl animate-spin">📊</div></div>
  )

  const ringR = 52
  const ringC = 2 * Math.PI * ringR
  const completionLeaders = [...stats.perKid].sort((a, b) => b.pct - a.pct)
  const starLeaders = [...stats.perKid].sort((a, b) => b.stars - a.stars)
  const maxStars = Math.max(...stats.perKid.map(k => k.stars), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="pt-12 pb-4 px-4" style={{ background: 'var(--theme-gradient)' }}>
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <h1 className="text-lg font-bold text-white">Analytics</h1>
          </div>
          <div className="flex bg-white/20 rounded-2xl p-1">
            {(['week', 'month'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition ${period === p ? 'bg-white' : 'text-white'}`}
                style={period === p ? { color: 'var(--theme-from)' } : {}}>
                {p === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kid filter thumbnails */}
      {children.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
          <div className="max-w-sm mx-auto flex gap-3 overflow-x-auto">
            <button onClick={() => setSelectedKid(null)} className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-95 transition">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black ${!selectedKid ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                style={!selectedKid ? { background: 'var(--theme-gradient)', boxShadow: '0 0 0 3px white, 0 0 0 5px var(--theme-from)' } : {}}>All</div>
              <span className="text-[10px] font-bold" style={{ color: !selectedKid ? 'var(--theme-from)' : '#9ca3af' }}>Everyone</span>
            </button>
            {children.map(child => {
              const sel = selectedKid === child.id
              return (
                <button key={child.id} onClick={() => setSelectedKid(sel ? null : child.id)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-95 transition">
                  {child.avatar_url
                    ? <img src={child.avatar_url} className="w-12 h-12 rounded-full object-cover" alt=""
                        style={{ boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}/>
                    : <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                        style={{ backgroundColor: child.colour + '25', boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}>{child.avatar}</div>}
                  <span className="text-[10px] font-bold truncate max-w-[48px]" style={{ color: sel ? child.colour : '#9ca3af' }}>{child.name.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-4">
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

        {/* Best day insight */}
        {stats.bestDay && (
          <div className="rounded-3xl p-4 text-white shadow-sm" style={{ background: 'var(--theme-gradient)' }}>
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">🏅 Most productive day</p>
            <p className="text-lg font-black mt-0.5">
              {new Date(stats.bestDay[0] + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            <p className="text-sm opacity-90">{stats.bestDay[1]} task{stats.bestDay[1] === 1 ? '' : 's'} smashed 💪</p>
          </div>
        )}

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
