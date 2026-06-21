'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Task {
  id: string
  title: string
  emoji: string
  type: string
  time_of_day: string | null
  star_value: number
}

interface Child {
  id: string
  name: string
  avatar: string
  colour: string
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const TIME_GROUPS = [
  { key: 'morning', label: '🌅 Morning' },
  { key: 'afternoon', label: '☀️ Afternoon' },
  { key: 'evening', label: '🌙 Evening' },
  { key: null, label: '📋 Anytime' },
]

export default function SchedulePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [completedSet, setCompletedSet] = useState(new Set<string>())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const todayStr = new Date().toISOString().split('T')[0]
  const selectedStr = selectedDate.toISOString().split('T')[0]
  const isToday = selectedStr === todayStr

  // Build week array starting from today
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (isToday) loadCompletions(todayStr)
    else setCompletedSet(new Set())
  }, [selectedStr]) // eslint-disable-line

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: guardian } = await supabase
      .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return

    const childIds_query = supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name')
    const tasks_query = supabase.from('tasks').select('*').eq('family_id', guardian.family_id)
    const assign_query = supabase.from('task_assignments').select('task_id, child_id')

    const [{ data: childrenData }, { data: tasksData }, { data: assignData }] = await Promise.all([
      childIds_query, tasks_query, assign_query,
    ])

    const map: Record<string, string[]> = {}
    assignData?.forEach(a => {
      if (!map[a.task_id]) map[a.task_id] = []
      map[a.task_id].push(a.child_id)
    })

    setChildren(childrenData || [])
    setTasks(tasksData || [])
    setAssignments(map)
    setLoading(false)

    await loadCompletions(todayStr)
  }

  async function loadCompletions(dateStr: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('completions').select('task_id, child_id, status').eq('date', dateStr)
    const set = new Set(
      data?.filter(c => c.status === 'approved' || c.status === 'pending')
        .map(c => `${c.task_id}-${c.child_id}`) || []
    )
    setCompletedSet(set)
  }

  const childMap: Record<string, Child> = {}
  children.forEach(c => { childMap[c.id] = c })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-spin">📅</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500 to-pink-500 pt-12 pb-6 px-4">
        <div className="max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <p className="text-purple-200 text-sm">Tasks for each day</p>
        </div>
      </div>

      {/* Day selector */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-sm mx-auto flex gap-2 overflow-x-auto pb-1">
          {week.map((date, i) => {
            const isSelected = date.toISOString().split('T')[0] === selectedStr
            const isTod = date.toISOString().split('T')[0] === todayStr
            return (
              <button key={i} onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center min-w-[48px] py-2 px-1 rounded-2xl transition ${isSelected ? 'bg-purple-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                <span className="text-xs font-semibold">{DAYS[date.getDay()]}</span>
                <span className={`text-lg font-bold ${isSelected ? 'text-white' : isTod ? 'text-purple-600' : ''}`}>{date.getDate()}</span>
                {isTod && !isSelected && <div className="w-1 h-1 bg-purple-500 rounded-full mt-0.5" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-5">
        {isToday && (
          <p className="text-xs font-bold text-purple-600 uppercase tracking-wide">Today — completion status shown</p>
        )}

        {TIME_GROUPS.map(group => {
          const groupTasks = tasks.filter(t =>
            group.key === null ? t.time_of_day === null || t.type === 'chore' : t.time_of_day === group.key
          )
          if (groupTasks.length === 0) return null

          return (
            <div key={group.key ?? 'anytime'}>
              <p className="text-sm font-bold text-gray-600 mb-2">{group.label}</p>
              <div className="space-y-2">
                {groupTasks.map(task => {
                  const assignedIds = assignments[task.id] || []
                  const assignedKids = assignedIds.map(id => childMap[id]).filter(Boolean)

                  return (
                    <div key={task.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl flex-shrink-0">
                        {task.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">{task.title}</p>
                        <p className="text-xs text-gray-400">⭐ {task.star_value}</p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end max-w-[100px]">
                        {assignedKids.map(child => {
                          const done = isToday && completedSet.has(`${task.id}-${child.id}`)
                          return (
                            <div key={child.id} className="relative flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition ${done ? 'opacity-50' : ''}`}
                                style={{ backgroundColor: child.colour + '33' }}>
                                {child.avatar}
                              </div>
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

        {tasks.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-gray-500 font-medium">No tasks yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
