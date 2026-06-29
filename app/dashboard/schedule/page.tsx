'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'
import TaskLauncher from '@/components/TaskLauncher'
import { occursOn } from '@/lib/recurrence'
import LoadingLogo from '@/components/LoadingLogo'

interface Task {
  id: string; title: string; emoji: string; time_of_day: string | null; star_value: number
  frequency?: 'daily' | 'weekly' | 'monthly'; start_date?: string | null; days_of_week?: number[] | null
}
interface Child { id: string; name: string; avatar: string; avatar_url?: string; colour: string }

type View = 'upcoming' | 'week' | 'month'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const TIME_ORDER: Record<string, number> = { morning: 1, afternoon: 2, evening: 3 }
const RAINBOW = 'linear-gradient(135deg, #16BDCA, #F59E0B, #7C3AED, #22B14C)'

// Distinct palette — 8 visually different colours, assigned by child index
const CHILD_COLORS = ['#16BDCA','#F59E0B','#7C3AED','#22B14C','#EF4444','#3B82F6','#EC4899','#F97316']

function getMondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  return m
}

function ymd(d: Date): string {
  // Use local timezone — toISOString() gives UTC which breaks date labels in AEST before 10am
  return new Intl.DateTimeFormat('en-CA').format(d)
}

function dateLabel(ds: string, todayStr: string): string {
  if (ds === todayStr) return 'Today'
  const tom = new Date(todayStr + 'T00:00:00'); tom.setDate(tom.getDate() + 1)
  if (ds === ymd(tom)) return 'Tomorrow'
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function SchedulePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('upcoming')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [filterChildId, setFilterChildId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const today = new Date()
  const todayStr = ymd(today)

  // Assign each child a guaranteed-distinct colour by index
  const childColorMap: Record<string, string> = {}
  children.forEach((c, i) => { childColorMap[c.id] = CHILD_COLORS[i % CHILD_COLORS.length] })

  // Week days
  const weekStart = (() => {
    const m = getMondayOf(today); m.setDate(m.getDate() + weekOffset * 7); return m
  })()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  })

  // Month calendar
  const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const calYear = monthDate.getFullYear()
  const calMonthIdx = monthDate.getMonth()
  const firstDow = new Date(calYear, calMonthIdx, 1).getDay()
  const firstDowMon = firstDow === 0 ? 6 : firstDow - 1
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate()
  const calCells: (number | null)[] = Array.from({ length: firstDowMon + daysInMonth }, (_, i) =>
    i < firstDowMon ? null : i - firstDowMon + 1
  )
  while (calCells.length % 7 !== 0) calCells.push(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const childParam = params.get('child')
    if (childParam) setFilterChildId(childParam)
    loadData()
  }, [])

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
    setLoading(false)
  }

  const childMap: Record<string, Child> = {}
  children.forEach(c => { childMap[c.id] = c })

  function getTasksForDay(day: Date): { task: Task; kids: Child[] }[] {
    return tasks
      .filter(t => occursOn(t, day))
      .map(t => {
        let kids = (assignments[t.id] || []).map(id => childMap[id]).filter(Boolean)
        if (filterChildId) kids = kids.filter(k => k.id === filterChildId)
        return { task: t, kids }
      })
      .filter(({ kids }) => kids.length > 0)
      .sort((a, b) => (TIME_ORDER[a.task.time_of_day ?? ''] ?? 0) - (TIME_ORDER[b.task.time_of_day ?? ''] ?? 0))
  }

  // Colored task bar — uses guaranteed-distinct palette colour per child
  function TaskBar({ task, kids }: { task: Task; kids: Child[] }) {
    return (
      <div className="flex h-2 rounded-full overflow-hidden w-full" title={`${task.emoji} ${task.title}`}>
        {kids.map(k => (
          <div key={k.id} className="flex-1 h-full" style={{ backgroundColor: childColorMap[k.id] || k.colour }}/>
        ))}
      </div>
    )
  }

  // Upcoming 2 weeks from today
  function getUpcomingDays() {
    const result: { day: Date; ds: string; items: { task: Task; kids: Child[] }[] }[] = []
    const end = new Date(today); end.setDate(today.getDate() + 13)
    for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
      const items = getTasksForDay(new Date(d))
      if (items.length > 0) result.push({ day: new Date(d), ds: ymd(d), items })
    }
    return result
  }

  const filterChild = filterChildId ? childMap[filterChildId] : null

  if (loading) return <LoadingLogo />

  const upcomingDays = getUpcomingDays()

  return (
    <div className="min-h-screen bg-white pb-28">

      {/* Header */}
      <div className="pt-11 pb-2.5 px-4 bg-white border-b border-gray-100">
        <div className="max-w-sm mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}/>
            <span className="text-2xl font-black" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Calendar
            </span>
          </div>
          <ProfileButton/>
        </div>

        {/* View toggle + child filter thumbnails */}
        <div className="max-w-sm mx-auto flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            {(['upcoming', 'week', 'month'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap ${view === v ? 'text-white shadow' : 'text-gray-400'}`}
                style={view === v ? { background: 'var(--theme-gradient)' } : {}}>
                {v === 'upcoming' ? '2 Weeks' : v === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
          {/* Child thumbnails — up to 3, act as filter toggles */}
          <div className="flex items-center gap-1.5 ml-1">
            {children.slice(0, 3).map((child, i) => {
              const sel = filterChildId === child.id
              const color = CHILD_COLORS[i % CHILD_COLORS.length]
              return (
                <button key={child.id} onClick={() => setFilterChildId(sel ? null : child.id)}
                  className="relative active:scale-90 transition"
                  title={child.name.split(' ')[0]}>
                  {child.avatar_url
                    ? <img src={child.avatar_url} className="w-9 h-9 rounded-full object-cover"
                        style={{ border: sel ? `2.5px solid ${color}` : '2.5px solid #e5e7eb' }} alt=""/>
                    : <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                        style={{ backgroundColor: color + '25', border: sel ? `2.5px solid ${color}` : '2.5px solid #e5e7eb' }}>
                        {child.avatar}
                      </div>}
                  {sel && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center"
                      style={{ backgroundColor: color }}>✓</div>
                  )}
                </button>
              )
            })}
            {children.length > 3 && (
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">
                +{children.length - 3}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── UPCOMING VIEW (default) ── */}
      {view === 'upcoming' && (
        <div className="max-w-sm mx-auto px-4 pt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Next 2 weeks</p>
          {upcomingDays.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-gray-400 text-sm">No tasks coming up{filterChildId ? ' for this child' : ''}!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingDays.map(({ day, ds, items }) => {
                const isToday = ds === todayStr
                return (
                  <div key={ds}>
                    <p className={`text-xs font-black mb-2 ${isToday ? '' : 'text-gray-600'}`}
                      style={isToday ? { color: 'var(--theme-from)' } : {}}>
                      {dateLabel(ds, todayStr)} · {day.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </p>
                    <div className="space-y-2">
                      {items.map(({ task, kids }) => (
                        <TaskLauncher key={task.id} taskId={task.id} kids={kids}>
                          <div className="bg-white border border-gray-100 rounded-2xl p-2.5 flex items-center gap-2.5 shadow-sm active:scale-[0.98] transition cursor-pointer">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 12%, white)' }}>{task.emoji}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 text-sm truncate">{task.title}</p>
                              <p className="text-[10px] text-gray-400">{task.time_of_day || 'Anytime'} · ⭐ {task.star_value}</p>
                            </div>
                            <div className="flex -space-x-1.5 flex-shrink-0">
                              {kids.slice(0, 3).map(k => k.avatar_url
                                ? <img key={k.id} src={k.avatar_url} className="w-6 h-6 rounded-full border-2 border-white object-cover" alt=""/>
                                : <div key={k.id} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs"
                                    style={{ backgroundColor: (childColorMap[k.id] || k.colour) + '40' }}>{k.avatar}</div>
                              )}
                            </div>
                          </div>
                        </TaskLauncher>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {/* Legend */}
          {children.length > 0 && !filterChildId && (
            <div className="flex gap-3 flex-wrap mt-4 pb-2">
              {children.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHILD_COLORS[i % CHILD_COLORS.length] }}/>
                  <span className="text-[10px] text-gray-500 font-semibold">{c.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {view === 'week' && (
        <div className="max-w-sm mx-auto px-2 pt-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg active:scale-90 transition">‹</button>
            <span className="text-xs font-bold text-gray-600">
              {weekDays[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg active:scale-90 transition">›</button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {weekDays.map((day, i) => {
              const ds = ymd(day)
              const isToday = ds === todayStr
              const dayTasks = getTasksForDay(day)
              return (
                <div key={i} className={`flex flex-col items-center p-1 rounded-xl min-h-[90px] ${isToday ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-gray-50'}`}>
                  <span className={`text-[10px] font-bold mb-0.5 ${isToday ? '' : 'text-gray-400'}`}
                    style={isToday ? { color: 'var(--theme-from)' } : {}}>
                    {DAY_LABELS_SHORT[i]}
                  </span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black mb-1.5 ${isToday ? 'text-white' : 'text-gray-700'}`}
                    style={isToday ? { background: 'var(--theme-gradient)' } : {}}>
                    {day.getDate()}
                  </div>
                  <div className="w-full space-y-0.5">
                    {dayTasks.slice(0, 6).map(({ task, kids }) => (
                      <TaskBar key={task.id} task={task} kids={kids}/>
                    ))}
                    {dayTasks.length > 6 && (
                      <div className="text-[8px] text-gray-400 text-center font-semibold">+{dayTasks.length - 6}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Week task list — clickable */}
          {(() => {
            const weekTaskSet: { task: Task; kids: Child[]; ds: string; day: Date }[] = []
            weekDays.forEach(day => {
              getTasksForDay(day).forEach(({ task, kids }) => {
                weekTaskSet.push({ task, kids, ds: ymd(day), day })
              })
            })
            if (weekTaskSet.length === 0) return (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-gray-400 text-sm">No tasks this week{filterChildId ? ' for this child' : ''}</p>
              </div>
            )
            const byDay: Record<string, typeof weekTaskSet> = {}
            weekTaskSet.forEach(item => { (byDay[item.ds] ||= []).push(item) })
            return (
              <div className="mt-4 space-y-3">
                {weekDays.map(day => {
                  const ds = ymd(day)
                  const items = byDay[ds]
                  if (!items?.length) return null
                  const isToday = ds === todayStr
                  return (
                    <div key={ds} className="bg-gray-50 rounded-2xl p-3">
                      <p className="text-xs font-black text-gray-700 mb-2">
                        {isToday ? 'Today' : day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </p>
                      <div className="space-y-1.5">
                        {items.map(({ task, kids }) => (
                          <TaskLauncher key={task.id} taskId={task.id} kids={kids}>
                            <div className="bg-white rounded-xl p-2.5 flex items-center gap-2.5 active:scale-[0.98] transition cursor-pointer">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base bg-gray-50 flex-shrink-0">{task.emoji}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-xs truncate">{task.title}</p>
                                <p className="text-[10px] text-gray-400">{task.time_of_day || 'Anytime'} · ⭐ {task.star_value}</p>
                              </div>
                              <div className="flex -space-x-1.5 flex-shrink-0">
                                {kids.slice(0, 3).map(k => k.avatar_url
                                  ? <img key={k.id} src={k.avatar_url} className="w-6 h-6 rounded-full border border-white object-cover" alt=""/>
                                  : <div key={k.id} className="w-6 h-6 rounded-full border border-white flex items-center justify-center text-xs"
                                      style={{ backgroundColor: (childColorMap[k.id] || k.colour) + '33' }}>{k.avatar}</div>
                                )}
                              </div>
                            </div>
                          </TaskLauncher>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {children.length > 0 && !filterChildId && (
            <div className="flex gap-3 flex-wrap mt-3 px-1 pb-2">
              {children.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHILD_COLORS[i % CHILD_COLORS.length] }}/>
                  <span className="text-[10px] text-gray-500 font-semibold">{c.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {view === 'month' && (
        <div className="max-w-sm mx-auto px-2 pt-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <button onClick={() => setMonthOffset(m => m - 1)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg active:scale-90 transition">‹</button>
            <span className="text-sm font-bold text-gray-700">{MONTHS[calMonthIdx]} {calYear}</span>
            <button onClick={() => setMonthOffset(m => m + 1)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg active:scale-90 transition">›</button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calCells.map((day, i) => {
              if (!day) return <div key={i}/>
              const ds = `${calYear}-${String(calMonthIdx + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const d = new Date(ds + 'T12:00:00')
              const isToday = ds === todayStr
              const isSelected = selectedDay === ds
              const dayTasks = getTasksForDay(d)
              return (
                <button key={i} onClick={() => setSelectedDay(isSelected ? null : ds)}
                  className="flex flex-col items-center pt-1 pb-1 px-0.5 rounded-xl transition min-h-[52px] active:scale-95"
                  style={isSelected ? { outline: '2px solid var(--theme-from)', outlineOffset: '1px' } : {}}>
                  <span className={`text-xs font-bold mb-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isToday ? 'text-white' : 'text-gray-700'}`}
                    style={isToday ? { background: 'var(--theme-gradient)' } : {}}>
                    {day}
                  </span>
                  <div className="w-full space-y-0.5 px-0.5">
                    {dayTasks.slice(0, 3).map(({ task, kids }) => (
                      <div key={task.id} className="flex h-1.5 rounded-full overflow-hidden w-full">
                        {kids.map(k => (
                          <div key={k.id} className="flex-1 h-full" style={{ backgroundColor: childColorMap[k.id] || k.colour }}/>
                        ))}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[7px] text-gray-400 text-center leading-none">+{dayTasks.length - 3}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected day task list — clickable */}
          {selectedDay && (() => {
            const d = new Date(selectedDay + 'T12:00:00')
            const dayTasks = getTasksForDay(d)
            const isToday = selectedDay === todayStr
            return (
              <div className="mt-4 bg-gray-50 rounded-3xl p-4">
                <p className="text-sm font-black text-gray-800 mb-3">
                  {isToday ? 'Today — ' : ''}{d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {dayTasks.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No tasks on this day</p>
                ) : (
                  <div className="space-y-2">
                    {dayTasks.map(({ task, kids }) => (
                      <TaskLauncher key={task.id} taskId={task.id} kids={kids}>
                        <div className="bg-white rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition cursor-pointer">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-gray-50 flex-shrink-0">{task.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{task.title}</p>
                            <p className="text-xs text-gray-400">{task.time_of_day || 'Anytime'} · ⭐ {task.star_value}</p>
                          </div>
                          <div className="flex -space-x-1.5 flex-shrink-0">
                            {kids.slice(0, 3).map(k => k.avatar_url
                              ? <img key={k.id} src={k.avatar_url} className="w-7 h-7 rounded-full border-2 border-white object-cover" alt=""/>
                              : <div key={k.id} className="w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white"
                                  style={{ backgroundColor: (childColorMap[k.id] || k.colour) + '33' }}>{k.avatar}</div>
                            )}
                          </div>
                        </div>
                      </TaskLauncher>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {children.length > 0 && !filterChildId && (
            <div className="flex gap-3 flex-wrap mt-3 px-1 pb-2">
              {children.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHILD_COLORS[i % CHILD_COLORS.length] }}/>
                  <span className="text-[10px] text-gray-500 font-semibold">{c.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
