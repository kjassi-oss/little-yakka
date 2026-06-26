'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'
import TaskLauncher from '@/components/TaskLauncher'

interface Task { id: string; title: string; emoji: string; type: string; time_of_day: string | null; star_value: number }
interface Child { id: string; name: string; avatar: string; avatar_url?: string; colour: string }

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const TIME_GROUPS = [
  { key: 'morning',   label: '🌅 Morning' },
  { key: 'afternoon', label: '☀️ Afternoon' },
  { key: 'evening',   label: '🌙 Evening' },
  { key: null,        label: '📋 Anytime' },
]
type View = 'roll' | 'week' | 'month'
const VIEW_LABELS: Record<View, string> = { roll: 'Agenda', week: 'Week', month: 'Month' }

export default function SchedulePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [completedSet, setCompletedSet] = useState(new Set<string>())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView] = useState<View>('roll')
  const [calMonth, setCalMonth] = useState(new Date())
  const [monthCompletions, setMonthCompletions] = useState<Record<string, number>>({}) // date -> completed count
  const [monthTaskCount, setMonthTaskCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const todayStr = new Date().toISOString().split('T')[0]
  const selectedStr = selectedDate.toISOString().split('T')[0]
  const isToday = selectedStr === todayStr

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d
  })

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (isToday) loadCompletions(todayStr)
    else setCompletedSet(new Set())
  }, [selectedStr]) // eslint-disable-line

  useEffect(() => {
    if (view === 'month') loadMonthCompletions()
  }, [view, calMonth]) // eslint-disable-line

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: guardian } = await supabase.from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return

    const [{ data: childrenData }, { data: tasksData }, { data: assignData }] = await Promise.all([
      supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
      supabase.from('tasks').select('*').eq('family_id', guardian.family_id),
      supabase.from('task_assignments').select('task_id, child_id'),
    ])
    const map: Record<string, string[]> = {}
    assignData?.forEach(a => { if (!map[a.task_id]) map[a.task_id] = []; map[a.task_id].push(a.child_id) })
    setChildren(childrenData || [])
    setTasks(tasksData || [])
    setAssignments(map)
    setMonthTaskCount(tasksData?.length || 0)
    setLoading(false)
    await loadCompletions(todayStr)
  }

  async function loadCompletions(dateStr: string) {
    const supabase = createClient()
    const { data } = await supabase.from('completions').select('task_id, child_id, status').eq('date', dateStr)
    setCompletedSet(new Set(
      data?.filter(c => c.status === 'approved' || c.status === 'pending').map(c => `${c.task_id}-${c.child_id}`) || []
    ))
  }

  async function loadMonthCompletions() {
    const supabase = createClient()
    const year = calMonth.getFullYear()
    const month = calMonth.getMonth()
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
    const { data } = await supabase.from('completions').select('date, status')
      .gte('date', start).lte('date', end).eq('status', 'approved')
    const counts: Record<string, number> = {}
    data?.forEach(c => { counts[c.date] = (counts[c.date] || 0) + 1 })
    setMonthCompletions(counts)
  }

  const childMap: Record<string, Child> = {}
  children.forEach(c => { childMap[c.id] = c })

  // Month calendar helpers
  const calYear = calMonth.getFullYear()
  const calMonthIdx = calMonth.getMonth()
  const firstDayOfMonth = new Date(calYear, calMonthIdx, 1).getDay()
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate()
  const calCells = Array.from({ length: firstDayOfMonth + daysInMonth }, (_, i) =>
    i < firstDayOfMonth ? null : i - firstDayOfMonth + 1
  )
  // Pad to full weeks
  while (calCells.length % 7 !== 0) calCells.push(null)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="text-5xl animate-spin">📅</div></div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="pt-11 pb-2.5 px-4" style={{ background: 'var(--theme-gradient)' }}>
        <div className="max-w-sm mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📅</span>
            <h1 className="text-lg font-bold text-white">Calendar</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-white/20 rounded-2xl p-1 gap-0.5">
              {(['roll', 'week', 'month'] as View[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${view === v ? 'bg-white' : 'text-white'}`}
                  style={view === v ? { color: 'var(--theme-from)' } : {}}>
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
            <ProfileButton/>
          </div>
        </div>
      </div>

      {/* ──── ROLL / AGENDA VIEW ──── */}
      {view === 'roll' && (
        <div className="max-w-sm mx-auto px-4 mt-4 space-y-3">
          {tasks.length === 0 && (
            <div className="text-center py-16"><div className="text-6xl mb-4">📅</div><p className="text-gray-500">No tasks yet</p></div>
          )}
          {tasks.length > 0 && Array.from({ length: 14 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() + i)
            const ds = d.toISOString().split('T')[0]
            const isToday = i === 0
            const ordered = [...tasks].sort((a, b) => {
              const order: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 }
              return (order[a.time_of_day ?? ''] ?? 3) - (order[b.time_of_day ?? ''] ?? 3)
            })
            return (
              <div key={ds} className="bg-white rounded-3xl p-4 shadow-sm"
                style={isToday ? { boxShadow: '0 0 0 2px var(--theme-from)' } : {}}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-black text-gray-800">
                    {isToday ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-AU', { weekday: 'long' })}
                  </p>
                  <p className="text-xs font-semibold text-gray-400">{d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="space-y-2">
                  {ordered.map(task => {
                    const assignedKids = (assignments[task.id] || []).map(id => childMap[id]).filter(Boolean)
                    const allDone = isToday && assignedKids.length > 0 && assignedKids.every(k => completedSet.has(`${task.id}-${k.id}`))
                    const upcoming = isToday && !allDone
                    return (
                      <TaskLauncher key={task.id} taskId={task.id} kids={assignedKids as any}>
                        <div className="flex items-center gap-3 rounded-2xl p-2 active:scale-[0.98] transition"
                          style={upcoming ? { backgroundColor: 'color-mix(in srgb, var(--theme-from) 10%, white)' } : {}}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-gray-50">{task.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm truncate ${allDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.title}</p>
                            <p className="text-[11px] text-gray-400">{task.time_of_day ? task.time_of_day : 'anytime'} · ⭐ {task.star_value}</p>
                          </div>
                          <div className="flex -space-x-1.5 flex-shrink-0">
                            {assignedKids.map(child => {
                              const done = isToday && completedSet.has(`${task.id}-${child.id}`)
                              return child.avatar_url
                                ? <img key={child.id} src={child.avatar_url} className={`w-7 h-7 rounded-full object-cover border-2 border-white ${done ? 'opacity-50' : ''}`} alt=""/>
                                : <div key={child.id} className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white ${done ? 'opacity-50' : ''}`}
                                    style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>
                            })}
                          </div>
                        </div>
                      </TaskLauncher>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ──── WEEK VIEW ──── */}
      {view === 'week' && (
        <>
          <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10 shadow-sm">
            <div className="max-w-sm mx-auto flex gap-2 overflow-x-auto pb-1">
              {week.map((date, i) => {
                const ds = date.toISOString().split('T')[0]
                const sel = ds === selectedStr
                const tod = ds === todayStr
                return (
                  <button key={i} onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center min-w-[44px] py-2 px-1 rounded-2xl transition ${sel ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    style={sel ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                    <span className="text-xs font-semibold">{DAYS_SHORT[date.getDay()]}</span>
                    <span className={`text-lg font-bold ${!sel && tod ? '' : ''}`}
                      style={!sel && tod ? { color: 'var(--theme-from)' } : {}}>{date.getDate()}</span>
                    {tod && !sel && <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: 'var(--theme-from)' }}/>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="max-w-sm mx-auto px-4 mt-4 space-y-5">
            {isToday && <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--theme-from)' }}>Today — live completion status</p>}
            {TIME_GROUPS.map(group => {
              const groupTasks = tasks.filter(t =>
                group.key === null ? !t.time_of_day : t.time_of_day === group.key
              )
              if (!groupTasks.length) return null
              return (
                <div key={group.key ?? 'anytime'}>
                  <p className="text-sm font-bold text-gray-600 mb-2">{group.label}</p>
                  <div className="space-y-2">
                    {groupTasks.map(task => {
                      const assignedKids = (assignments[task.id] || []).map(id => childMap[id]).filter(Boolean)
                      return (
                        <div key={task.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl flex-shrink-0">{task.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm">{task.title}</p>
                            <p className="text-xs text-gray-400">⭐ {task.star_value}</p>
                          </div>
                          <div className="flex gap-1 flex-wrap justify-end max-w-[100px]">
                            {assignedKids.map(child => {
                              const done = isToday && completedSet.has(`${task.id}-${child.id}`)
                              return (
                                <div key={child.id} className="relative flex-shrink-0">
                                  {child.avatar_url ? (
                                    <img src={child.avatar_url} className={`w-8 h-8 rounded-full object-cover ${done ? 'opacity-50' : ''}`} alt=""/>
                                  ) : (
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${done ? 'opacity-50' : ''}`}
                                      style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>
                                  )}
                                  {isToday && (
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${done ? 'bg-green-500' : 'bg-gray-200'}`}>
                                      {done && <span className="text-white text-[8px] font-bold">✓</span>}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {tasks.length === 0 && <div className="text-center py-16"><div className="text-6xl mb-4">📅</div><p className="text-gray-500">No tasks yet</p></div>}
          </div>
        </>
      )}

      {/* ──── MONTH VIEW ──── */}
      {view === 'month' && (
        <div className="max-w-sm mx-auto px-4 mt-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))}
              className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-500 active:scale-90 transition">‹</button>
            <h2 className="font-bold text-gray-800">{MONTHS[calMonthIdx]} {calYear}</h2>
            <button onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))}
              className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-500 active:scale-90 transition">›</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1">
            {calCells.map((day, i) => {
              if (!day) return <div key={i}/>
              const ds = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isThisToday = ds === todayStr
              const isSelected = ds === selectedStr
              const completedCount = monthCompletions[ds] || 0
              const isPast = ds < todayStr
              return (
                <button key={i} onClick={() => { setSelectedDate(new Date(ds + 'T12:00:00')); setView('week') }}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-semibold transition active:scale-90 ${isSelected ? 'text-white' : isThisToday ? 'bg-white shadow-md' : 'bg-white/60'}`}
                  style={isSelected ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                  <span style={isThisToday && !isSelected ? { color: 'var(--theme-from)' } : { color: isSelected ? 'white' : '#374151' }}>{day}</span>
                  {monthTaskCount > 0 && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      isSelected ? 'bg-white/70' :
                      completedCount >= monthTaskCount ? 'bg-green-400' :
                      completedCount > 0 ? 'bg-yellow-400' :
                      isPast ? 'bg-red-300' : 'bg-gray-200'
                    }`}/>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 justify-center">
            {[['bg-green-400','All done'],['bg-yellow-400','Partial'],['bg-red-300','Missed'],['bg-gray-200','Upcoming']].map(([cls, label]) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-full ${cls}`}/>
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-center text-gray-400 mt-3">Tap a day to see tasks in week view</p>
        </div>
      )}
    </div>
  )
}
