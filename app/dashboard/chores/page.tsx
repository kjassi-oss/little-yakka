'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'

const EMOJIS = ['🛏️','🧹','🍽️','🧺','📚','🐕','🌿','🗑️','🛁','🧼','🪥','🍳','🚿','🧽','👕','🎒','🏃','🌙','🎨','🪀']
const TIME_OPTIONS = [
  { value: 'anytime',   label: '📋 Anytime' },
  { value: 'morning',   label: '🌅 Morning' },
  { value: 'afternoon', label: '☀️ Afternoon' },
  { value: 'evening',   label: '🌙 Evening' },
]
const FREQ_OPTIONS = [
  { value: 'daily',   label: '📅 Daily' },
  { value: 'weekly',  label: '🗓️ Weekly' },
  { value: 'monthly', label: '📆 Monthly' },
]
const TIME_GROUPS = [
  { key: 'morning',   label: '🌅 Morning' },
  { key: 'afternoon', label: '☀️ Afternoon' },
  { key: 'evening',   label: '🌙 Evening' },
  { key: null,        label: '📋 Anytime' },
]

interface Task {
  id: string; title: string; emoji: string; type: 'chore' | 'routine'
  time_of_day: string | null; star_value: number
  requires_photo: boolean; requires_benchmark_photo: boolean
  benchmark_differs_per_child: boolean
  frequency: 'daily' | 'weekly' | 'monthly'; carry_over: boolean
  start_date?: string | null; requires_approval?: boolean
}
interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string }
interface HistoryRow {
  id: string; date: string; child_id: string; star_value: number
  tasks: { title: string; emoji: string; star_value: number } | null
  children: { name: string; avatar: string; colour: string; avatar_url?: string } | null
}

type MainTab = 'tasks' | 'today' | 'history'

export default function ChoresPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [completedSet, setCompletedSet] = useState(new Set<string>())
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [familyId, setFamilyId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<MainTab>('tasks')
  const [filterChildId, setFilterChildId] = useState<string | null>(null)
  const [showChildPicker, setShowChildPicker] = useState(false)
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<HistoryRow[]>([])

  // Form state
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🧹')
  const [type, setType] = useState<'chore' | 'routine'>('chore')
  const [timeOfDay, setTimeOfDay] = useState('anytime')
  const [startDate, setStartDate] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [carryOver, setCarryOver] = useState(true)
  const [starValue, setStarValue] = useState(3)
  const [requiresPhoto, setRequiresPhoto] = useState(false)
  const [requiresBenchmarkPhoto, setRequiresBenchmarkPhoto] = useState(false)
  const [benchmarkDiffersPerChild, setBenchmarkDiffersPerChild] = useState(false)
  const [benchmarkFiles, setBenchmarkFiles] = useState<File[]>([])
  const [benchmarkVideo, setBenchmarkVideo] = useState<File | null>(null)
  const [existingBenchmarks, setExistingBenchmarks] = useState<{ id: string; url: string; media_type: string }[]>([])
  const [assignedChildren, setAssignedChildren] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const benchmarkPhotoRef = useRef<HTMLInputElement>(null)
  const benchmarkVideoRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: guardian } = await supabase.from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return
    setFamilyId(guardian.family_id)

    const today = new Date().toISOString().split('T')[0]
    const [{ data: tasksData }, { data: childrenData }, { data: assignmentsData }, { data: completionsData }] = await Promise.all([
      supabase.from('tasks').select('*').eq('family_id', guardian.family_id).order('created_at'),
      supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
      supabase.from('task_assignments').select('task_id, child_id'),
      supabase.from('completions').select('task_id, child_id, status').eq('date', today),
    ])

    const map: Record<string, string[]> = {}
    assignmentsData?.forEach(a => { if (!map[a.task_id]) map[a.task_id] = []; map[a.task_id].push(a.child_id) })
    setTasks(tasksData || [])
    setChildren(childrenData || [])
    setAssignments(map)
    setCompletedSet(new Set(
      completionsData?.filter(c => c.status === 'approved' || c.status === 'pending')
        .map(c => `${c.task_id}-${c.child_id}`) || []
    ))
    setPageLoading(false)

    // Completion history + pending approvals (moved here from the old History page)
    const childIds = childrenData?.map(c => c.id) || []
    const [{ data: historyData }, { data: approvalData }] = await Promise.all([
      supabase.from('completions')
        .select('id, date, child_id, tasks(title, emoji, star_value), children(name, avatar, colour, avatar_url)')
        .eq('status', 'approved')
        .in('child_id', childIds.length ? childIds : ['none'])
        .order('created_at', { ascending: false })
        .limit(120),
      supabase.from('completions')
        .select('id, date, child_id, tasks(title, emoji, star_value), children(name, avatar, colour, avatar_url)')
        .eq('status', 'pending')
        .in('child_id', childIds.length ? childIds : ['none'])
        .order('created_at', { ascending: false }),
    ])
    setHistory((historyData as any) || [])
    setPendingApprovals((approvalData as any) || [])
  }

  function handleTaskClick(task: Task) {
    // Tapping a task jumps into the kid zone, deep-linked to that task.
    const kids = assignments[task.id] || []
    if (filterChildId) router.push(`/kid-mode/${filterChildId}?task=${task.id}`)
    else if (kids.length === 1) router.push(`/kid-mode/${kids[0]}?task=${task.id}`)
    else { setPendingTaskId(task.id); setShowChildPicker(true) }
  }

  async function approveCompletion(row: HistoryRow) {
    const supabase = createClient()
    await supabase.from('completions').update({ status: 'approved' }).eq('id', row.id)
    await supabase.from('star_ledger').insert({
      child_id: row.child_id,
      delta: row.tasks?.star_value || 0,
      reason: `Approved: ${row.tasks?.title}`,
      source_type: 'completion',
      source_id: row.id,
    })
    loadData()
  }

  async function rejectCompletion(row: HistoryRow) {
    if (!confirm(`Reject "${row.tasks?.title}" for ${row.children?.name}? No stars will be given.`)) return
    await createClient().from('completions').delete().eq('id', row.id)
    loadData()
  }

  function openNewForm() {
    setEditingTaskId(null)
    setTitle(''); setEmoji('🧹'); setType('chore'); setTimeOfDay('anytime')
    setFrequency('daily'); setCarryOver(true); setStarValue(3)
    setStartDate('')
    setRequiresPhoto(false); setRequiresBenchmarkPhoto(false)
    setBenchmarkDiffersPerChild(false); setBenchmarkFiles([]); setBenchmarkVideo(null)
    setExistingBenchmarks([]); setAssignedChildren([]); setDifficulty('medium')
    setRequiresApproval(false)
    setFormError('')
    setShowForm(true)
  }

  async function openEditForm(task: Task) {
    setEditingTaskId(task.id)
    setTitle(task.title); setEmoji(task.emoji); setType(task.type)
    setTimeOfDay(task.time_of_day || 'anytime')
    setFrequency(task.frequency || 'daily'); setCarryOver(task.carry_over ?? true)
    setStarValue(task.star_value); setRequiresPhoto(task.requires_photo)
    setStartDate(task.start_date || '')
    setRequiresBenchmarkPhoto(task.requires_benchmark_photo || false)
    setBenchmarkDiffersPerChild(task.benchmark_differs_per_child || false)
    setBenchmarkFiles([]); setBenchmarkVideo(null)
    setAssignedChildren(assignments[task.id] || [])
    setDifficulty((task as any).difficulty || 'medium')
    setRequiresApproval((task as any).requires_approval || false)
    setFormError('')
    setShowForm(true)
    const supabase = createClient()
    const { data } = await supabase.from('task_benchmark_photos').select('id, url, media_type').eq('task_id', task.id)
    setExistingBenchmarks(data || [])
  }

  function closeForm() { setShowForm(false); setEditingTaskId(null) }

  async function saveTask() {
    if (!title.trim()) { setFormError('Please enter a task name.'); return }
    if (assignedChildren.length === 0) { setFormError('Please assign to at least one child.'); return }
    setSaving(true); setFormError('')
    const supabase = createClient()
    const payload = {
      title: title.trim(), emoji, type,
      time_of_day: timeOfDay === 'anytime' ? null : timeOfDay,
      star_value: starValue,
      start_date: startDate || null,
      requires_photo: requiresPhoto || requiresBenchmarkPhoto,
      requires_benchmark_photo: requiresBenchmarkPhoto,
      benchmark_differs_per_child: benchmarkDiffersPerChild,
      frequency, carry_over: carryOver, difficulty,
      requires_approval: requiresApproval,
    }

    let taskId = editingTaskId
    if (editingTaskId) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editingTaskId)
      if (error) { setFormError(error.message); setSaving(false); return }
      await supabase.from('task_assignments').delete().eq('task_id', editingTaskId)
      await supabase.from('task_assignments').insert(assignedChildren.map(cid => ({ task_id: editingTaskId, child_id: cid })))
    } else {
      const { data: task, error } = await supabase.from('tasks')
        .insert({ ...payload, family_id: familyId, recurrence: frequency }).select().single()
      if (error || !task) { setFormError(error?.message || 'Failed to save.'); setSaving(false); return }
      taskId = task.id
      await supabase.from('task_assignments').insert(assignedChildren.map(cid => ({ task_id: task.id, child_id: cid })))
    }

    if (taskId && requiresBenchmarkPhoto) {
      for (let i = 0; i < benchmarkFiles.length; i++) {
        const file = benchmarkFiles[i]
        const ext = file.name.split('.').pop()
        const path = `${familyId}/${taskId}/photo_${i}.${ext}`
        const { error: upErr } = await supabase.storage.from('task-benchmarks').upload(path, file, { upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('task-benchmarks').getPublicUrl(path)
          await supabase.from('task_benchmark_photos').insert({ task_id: taskId, url: publicUrl, media_type: 'photo', sort_order: i })
        }
      }
      if (benchmarkVideo) {
        const ext = benchmarkVideo.name.split('.').pop()
        const path = `${familyId}/${taskId}/video.${ext}`
        const { error: upErr } = await supabase.storage.from('task-benchmarks').upload(path, benchmarkVideo, { upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('task-benchmarks').getPublicUrl(path)
          await supabase.from('task_benchmark_photos').insert({ task_id: taskId, url: publicUrl, media_type: 'video', sort_order: 99 })
        }
      }
    }

    closeForm(); setSaving(false); loadData()
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return
    await createClient().from('tasks').delete().eq('id', taskId)
    loadData()
  }

  async function undoCompletion(row: HistoryRow) {
    if (!confirm(`Undo "${row.tasks?.title}" for ${row.children?.name}? This removes the stars.`)) return
    const supabase = createClient()
    await supabase.from('completions').delete().eq('id', row.id)
    await supabase.from('star_ledger').insert({
      child_id: row.child_id,
      delta: -(row.tasks?.star_value || 0),
      reason: `Undo: ${row.tasks?.title}`,
      source_type: 'undo',
    })
    loadData()
  }

  const childMap: Record<string, Child> = {}
  children.forEach(c => { childMap[c.id] = c })

  const visibleTasks = filterChildId
    ? tasks.filter(t => (assignments[t.id] || []).includes(filterChildId))
    : tasks

  const todayStr = new Date().toISOString().split('T')[0]
  const dateLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  if (pageLoading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="text-5xl animate-spin">📋</div></div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Compact header */}
      <div className="pt-11 pb-2.5 px-4" style={{ background: 'var(--theme-gradient)' }}>
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <h1 className="text-lg font-bold text-white">Tasks</h1>
          </div>
          <ProfileButton/>
        </div>

        {/* Tab toggle */}
        <div className="max-w-sm mx-auto mt-2.5 flex bg-white/20 rounded-2xl p-1 gap-1">
          {([['tasks', '📋 All'], ['today', '📅 Today'], ['history', '✅ Done']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setMainTab(tab)}
              className={`relative flex-1 py-1.5 rounded-xl text-sm font-semibold transition ${mainTab === tab ? 'bg-white' : 'text-white'}`}
              style={mainTab === tab ? { color: 'var(--theme-from)' } : {}}>
              {label}
              {tab === 'history' && pendingApprovals.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{pendingApprovals.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Kid filter — round photo thumbnails, 4 per row */}
      {children.length > 0 && mainTab !== 'history' && (
        <div className="bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
          <div className="max-w-sm mx-auto grid grid-cols-4 gap-3">
            {/* All */}
            <button onClick={() => setFilterChildId(null)} className="flex flex-col items-center gap-1 active:scale-95 transition">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black ${!filterChildId ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                style={!filterChildId ? { background: 'var(--theme-gradient)', boxShadow: '0 0 0 3px white, 0 0 0 5px var(--theme-from)' } : {}}>
                All
              </div>
              <span className={`text-[11px] font-bold ${!filterChildId ? '' : 'text-gray-400'}`}
                style={!filterChildId ? { color: 'var(--theme-from)' } : {}}>Everyone</span>
            </button>
            {children.map(child => {
              const sel = filterChildId === child.id
              return (
                <button key={child.id} onClick={() => setFilterChildId(sel ? null : child.id)}
                  className="flex flex-col items-center gap-1 active:scale-95 transition">
                  {child.avatar_url
                    ? <img src={child.avatar_url} alt={child.name} className="w-14 h-14 rounded-full object-cover"
                        style={{ boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}/>
                    : <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                        style={{ backgroundColor: child.colour + '25', boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}>
                        {child.avatar}
                      </div>
                  }
                  <span className="text-[11px] font-bold truncate max-w-[56px]"
                    style={{ color: sel ? child.colour : '#9ca3af' }}>{child.name.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-4">

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-3xl shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800">{editingTaskId ? 'Edit Task' : 'New Task'}</h2>

            <div className="flex bg-gray-100 rounded-2xl p-1">
              {(['chore', 'routine'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition capitalize ${type === t ? 'bg-white shadow' : 'text-gray-400'}`}
                  style={type === t ? { color: 'var(--theme-from)' } : {}}>
                  {t}
                </button>
              ))}
            </div>

            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder={type === 'chore' ? 'e.g. Make bed, Tidy room...' : 'e.g. Brush teeth, Read...'}/>

            <div>
              <p className="text-xs text-gray-500 mb-2">Choose an emoji</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    className={`text-2xl p-1.5 rounded-xl transition ${emoji === e ? 'ring-2 ring-purple-400' : 'hover:bg-gray-100'}`}
                    style={emoji === e ? { backgroundColor: 'var(--theme-from)22' } : {}}>
                    {e}
                  </button>
                ))}
              </div>
              <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)}
                className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-center text-xl focus:outline-none"
                maxLength={2} placeholder="✏️"/>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">How often?</p>
              <div className="flex gap-2">
                {FREQ_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setFrequency(opt.value as any)}
                    className={`flex-1 py-2 rounded-2xl text-xs font-semibold transition ${frequency === opt.value ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={frequency === opt.value ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Time of day</p>
              <div className="grid grid-cols-2 gap-2">
                {TIME_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setTimeOfDay(opt.value)}
                    className={`py-2 rounded-2xl text-xs font-semibold transition ${timeOfDay === opt.value ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={timeOfDay === opt.value ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Start date <span className="text-gray-300">(optional — defaults to today)</span></p>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
            </div>

            <div className="flex items-center justify-between py-1">
              <div><p className="text-sm font-medium text-gray-700">Carry over if missed ↩️</p><p className="text-xs text-gray-400">{carryOver ? 'Shows as overdue' : 'Marked expired'}</p></div>
              <button onClick={() => setCarryOver(!carryOver)}
                className={`w-12 h-6 rounded-full transition-colors relative ${carryOver ? '' : 'bg-gray-200'}`}
                style={carryOver ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${carryOver ? 'translate-x-6' : 'translate-x-0.5'}`}/>
              </button>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Stars to earn: <span className="font-bold text-yellow-500">⭐ {starValue}</span></p>
              <input type="range" min={1} max={10} value={starValue} onChange={e => setStarValue(Number(e.target.value))} className="w-full"/>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1</span><span>10</span></div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div><p className="text-sm font-medium text-gray-700">Needs parent approval 🕓</p><p className="text-xs text-gray-400">{requiresApproval ? 'Stars given after you approve' : 'Stars awarded automatically'}</p></div>
              <button onClick={() => setRequiresApproval(!requiresApproval)}
                className={`w-12 h-6 rounded-full transition-colors relative ${requiresApproval ? '' : 'bg-gray-200'}`}
                style={requiresApproval ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${requiresApproval ? 'translate-x-6' : 'translate-x-0.5'}`}/>
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div><p className="text-sm font-medium text-gray-700">Requires photo proof 📷</p><p className="text-xs text-gray-400">Kid snaps a photo when done</p></div>
              <button onClick={() => setRequiresPhoto(!requiresPhoto)}
                className={`w-12 h-6 rounded-full transition-colors relative ${requiresPhoto ? '' : 'bg-gray-200'}`}
                style={requiresPhoto ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${requiresPhoto ? 'translate-x-6' : 'translate-x-0.5'}`}/>
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div><p className="text-sm font-medium text-gray-700">Add benchmark photos 🖼️</p><p className="text-xs text-gray-400">Show kids the expected standard</p></div>
              <button onClick={() => setRequiresBenchmarkPhoto(!requiresBenchmarkPhoto)}
                className={`w-12 h-6 rounded-full transition-colors relative ${requiresBenchmarkPhoto ? '' : 'bg-gray-200'}`}
                style={requiresBenchmarkPhoto ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${requiresBenchmarkPhoto ? 'translate-x-6' : 'translate-x-0.5'}`}/>
              </button>
            </div>

            {requiresBenchmarkPhoto && (
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                {existingBenchmarks.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Current benchmarks</p>
                    <div className="flex gap-2 flex-wrap">
                      {existingBenchmarks.map(b => (
                        <div key={b.id} className="relative">
                          {b.media_type === 'video'
                            ? <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center text-2xl">🎥</div>
                            : <img src={b.url} className="w-16 h-16 object-cover rounded-xl" alt="benchmark"/>}
                          <button onClick={async () => {
                            await createClient().from('task_benchmark_photos').delete().eq('id', b.id)
                            setExistingBenchmarks(prev => prev.filter(x => x.id !== b.id))
                          }} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Add photos <span className="text-gray-400">(up to {5 - existingBenchmarks.filter(b => b.media_type === 'photo').length} more)</span></p>
                  {benchmarkFiles.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {benchmarkFiles.map((f, i) => (
                        <div key={i} className="relative">
                          <img src={URL.createObjectURL(f)} className="w-16 h-16 object-cover rounded-xl" alt=""/>
                          <button onClick={() => setBenchmarkFiles(prev => prev.filter((_, j) => j !== i))}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => benchmarkPhotoRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 font-medium w-full justify-center">
                    📷 Add photos
                  </button>
                  <input type="file" accept="image/*" multiple className="hidden" ref={benchmarkPhotoRef}
                    onChange={e => {
                      const files = Array.from(e.target.files || [])
                      const maxNew = 5 - existingBenchmarks.filter(b => b.media_type === 'photo').length - benchmarkFiles.length
                      setBenchmarkFiles(prev => [...prev, ...files.slice(0, maxNew)])
                    }}/>
                </div>
                <div>
                  {benchmarkVideo ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center text-2xl">🎥</div>
                      <div className="flex-1"><p className="text-xs text-gray-600 truncate">{benchmarkVideo.name}</p>
                        <button onClick={() => setBenchmarkVideo(null)} className="text-xs text-red-400 font-semibold mt-0.5">Remove</button></div>
                    </div>
                  ) : !existingBenchmarks.some(b => b.media_type === 'video') ? (
                    <button onClick={() => benchmarkVideoRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 font-medium w-full justify-center">
                      🎥 Add short video
                    </button>
                  ) : null}
                  <input type="file" accept="video/*" className="hidden" ref={benchmarkVideoRef}
                    onChange={e => { if (e.target.files?.[0]) setBenchmarkVideo(e.target.files[0]) }}/>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div><p className="text-sm font-medium text-gray-700">Different per child</p><p className="text-xs text-gray-400">Each child has their own benchmark</p></div>
                  <button onClick={() => setBenchmarkDiffersPerChild(!benchmarkDiffersPerChild)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${benchmarkDiffersPerChild ? '' : 'bg-gray-200'}`}
                    style={benchmarkDiffersPerChild ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${benchmarkDiffersPerChild ? 'translate-x-6' : 'translate-x-0.5'}`}/>
                  </button>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-2">Assign to</p>
              <div className="grid grid-cols-4 gap-3">
                {children.map(child => {
                  const sel = assignedChildren.includes(child.id)
                  return (
                    <button key={child.id}
                      onClick={() => setAssignedChildren(prev => prev.includes(child.id) ? prev.filter(id => id !== child.id) : [...prev, child.id])}
                      className="flex flex-col items-center gap-1 active:scale-95 transition">
                      {child.avatar_url
                        ? <img src={child.avatar_url} alt={child.name} className={`w-14 h-14 rounded-full object-cover transition ${sel ? '' : 'opacity-40 grayscale'}`}
                            style={{ boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}/>
                        : <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition ${sel ? '' : 'opacity-40 grayscale'}`}
                            style={{ backgroundColor: child.colour + '25', boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}>
                            {child.avatar}
                          </div>}
                      <span className="text-[11px] font-bold truncate max-w-[56px]" style={{ color: sel ? child.colour : '#9ca3af' }}>{child.name.split(' ')[0]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <button onClick={closeForm}
                className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold active:scale-95 transition">
                Cancel
              </button>
              <button onClick={saveTask} disabled={saving}
                className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
                {saving ? 'Saving...' : editingTaskId ? 'Update Task ✓' : 'Save Task ✓'}
              </button>
            </div>
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {mainTab === 'tasks' && !showForm && (
          visibleTasks.length > 0 ? (
            <>
              <p className="text-[11px] text-gray-400 text-center -mt-1">Tap a task to jump into Kid Mode ⭐</p>
              <div className="grid grid-cols-3 gap-2">
                {visibleTasks.map(task => {
                  const assignedKids = (assignments[task.id] || []).map(id => childMap[id]).filter(Boolean)
                  return (
                    <div key={task.id} onClick={() => handleTaskClick(task)}
                      className="bg-white rounded-2xl p-2.5 shadow-sm flex flex-col items-center gap-1.5 relative cursor-pointer active:scale-95 transition">
                      <div className="absolute top-1.5 right-1.5 flex gap-0.5 z-10">
                        <button onClick={e => { e.stopPropagation(); openEditForm(task) }} className="text-gray-300 text-xs active:scale-90 transition">✏️</button>
                        <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }} className="text-gray-300 text-sm font-bold leading-none active:scale-90 transition">×</button>
                      </div>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-3xl mt-1"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 14%, white)' }}>
                        {task.emoji}
                      </div>
                      <p className="text-xs font-bold text-gray-700 text-center leading-tight line-clamp-2">{task.title}</p>
                      <p className="text-xs text-yellow-500 font-bold">⭐ {task.star_value}</p>
                      {task.requires_benchmark_photo && <span className="text-[9px] bg-purple-50 text-purple-400 font-semibold px-1 py-0.5 rounded-full">AI check</span>}
                      {(task as any).requires_approval && <span className="text-[9px] bg-amber-50 text-amber-500 font-semibold px-1 py-0.5 rounded-full">🕓 OK</span>}
                      <div className="flex -space-x-1.5 justify-center">
                        {assignedKids.map(child => (
                          child.avatar_url
                            ? <img key={child.id} src={child.avatar_url} className="w-6 h-6 rounded-full object-cover border-2 border-white" alt=""/>
                            : <div key={child.id} className="w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 border-white"
                                style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-gray-500 font-medium">No tasks yet</p>
              <p className="text-gray-400 text-sm mt-1">Tap "+ Add Task" to get started</p>
            </div>
          )
        )}

        {/* ── TODAY TAB ── */}
        {mainTab === 'today' && !showForm && (
          <div className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--theme-from)' }}>
              📅 {dateLabel}
            </p>
            {TIME_GROUPS.map(group => {
              const groupTasks = visibleTasks.filter(t =>
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
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 14%, white)' }}>{task.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm">{task.title}</p>
                            <p className="text-xs text-gray-400">⭐ {task.star_value}</p>
                          </div>
                          <div className="flex gap-1 flex-wrap justify-end max-w-[80px]">
                            {assignedKids.map(child => {
                              const done = completedSet.has(`${task.id}-${child.id}`)
                              return (
                                <div key={child.id} className="relative flex-shrink-0">
                                  {child.avatar_url
                                    ? <img src={child.avatar_url} className={`w-8 h-8 rounded-full object-cover ${done ? 'opacity-50' : ''}`} alt=""/>
                                    : <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${done ? 'opacity-50' : ''}`}
                                        style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>
                                  }
                                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${done ? 'bg-green-500' : 'bg-gray-200'}`}>
                                    {done && <span className="text-white text-[8px] font-bold">✓</span>}
                                  </div>
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
            {visibleTasks.length === 0 && (
              <div className="text-center py-16"><div className="text-6xl mb-4">📅</div><p className="text-gray-500">No tasks to show</p></div>
            )}
          </div>
        )}

        {/* ── DONE / HISTORY TAB ── */}
        {mainTab === 'history' && !showForm && (
          <div className="space-y-5">
            {/* Needs parent approval */}
            {pendingApprovals.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--theme-from)' }}>🕓 Needs your OK ({pendingApprovals.length})</p>
                <div className="space-y-2">
                  {pendingApprovals.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-amber-100">
                      <div className="flex items-center gap-3 mb-2">
                        {p.children?.avatar_url
                          ? <img src={p.children.avatar_url} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt=""/>
                          : <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                              style={{ backgroundColor: (p.children?.colour || '#ccc') + '33' }}>{p.children?.avatar}</div>}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span>{p.tasks?.emoji}</span>
                            <p className="font-semibold text-gray-800 text-sm truncate">{p.tasks?.title}</p>
                          </div>
                          <p className="text-xs text-gray-400">{p.children?.name} · ⭐ {p.tasks?.star_value}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => rejectCompletion(p)}
                          className="flex-1 border-2 border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm hover:border-red-300 hover:text-red-500 transition">Reject ✗</button>
                        <button onClick={() => approveCompletion(p)}
                          className="flex-1 text-white font-bold py-2 rounded-xl text-sm shadow active:scale-95 transition"
                          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>Approve ✓</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const grouped: Record<string, HistoryRow[]> = {}
              history.forEach(h => { (grouped[h.date] ||= []).push(h) })
              const dates = Object.keys(grouped).sort().reverse()
              const fmt = (iso: string) => {
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
                if (iso === todayStr) return 'Today'
                if (iso === yesterday) return 'Yesterday'
                return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
              }
              if (dates.length === 0) return (
                <div className="text-center py-16"><div className="text-6xl mb-4">✅</div><p className="text-gray-500 font-medium">No completed tasks yet</p></div>
              )
              return dates.map(date => (
                <div key={date}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{fmt(date)}</p>
                  <div className="space-y-2">
                    {grouped[date].map(h => (
                      <div key={h.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                        {h.children?.avatar_url
                          ? <img src={h.children.avatar_url} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt=""/>
                          : <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                              style={{ backgroundColor: (h.children?.colour || '#ccc') + '33' }}>{h.children?.avatar}</div>}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span>{h.tasks?.emoji}</span>
                            <p className="font-semibold text-gray-800 text-sm truncate">{h.tasks?.title}</p>
                          </div>
                          <p className="text-xs text-gray-400">{h.children?.name} · <span className="text-yellow-500 font-semibold">+{h.tasks?.star_value} ⭐</span></p>
                        </div>
                        <button onClick={() => undoCompletion(h)}
                          className="text-xs text-gray-300 hover:text-red-400 font-semibold transition px-2 py-1 rounded-lg hover:bg-red-50 flex-shrink-0">Undo</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </div>

      {/* Large + FAB — add a task / reward */}
      {!showForm && (
        <button onClick={openNewForm} aria-label="Add task"
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition z-40"
          style={{ background: 'var(--theme-gradient)' }}>
          <span className="text-3xl leading-none mb-0.5">+</span>
        </button>
      )}

      {/* Child picker — shown when tapping a task with no kid filter selected */}
      {showChildPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => { setShowChildPicker(false); setPendingTaskId(null) }}>
          <div className="bg-white w-full rounded-t-3xl p-5 pop-in" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"/>
            <h3 className="font-black text-gray-800 text-lg mb-1">Who's doing this? ⭐</h3>
            <p className="text-gray-400 text-sm mb-4">Tap a child to enter their zone</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {(pendingTaskId ? (assignments[pendingTaskId] || []).map(id => childMap[id]).filter(Boolean) : children).map(child => (
                <button key={child.id} onClick={() => router.push(`/kid-mode/${child.id}${pendingTaskId ? `?task=${pendingTaskId}` : ''}`)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition">
                  {child.avatar_url
                    ? <img src={child.avatar_url} className="w-16 h-16 rounded-2xl object-cover" style={{ border: `3px solid ${child.colour}` }} alt=""/>
                    : <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ backgroundColor: child.colour + '25', border: `3px solid ${child.colour}40` }}>{child.avatar}</div>}
                  <span className="text-xs font-bold text-gray-700 truncate max-w-full">{child.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowChildPicker(false); setPendingTaskId(null) }}
              className="w-full text-gray-500 font-semibold py-3 rounded-2xl border border-gray-200 active:scale-95 transition">
              ← Back to tasks
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
