'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const EMOJIS = ['🛏️','🧹','🍽️','🧺','📚','🐕','🌿','🗑️','🛁','🧼','🪥','🍳','🚿','🧽','👕','🎒','🏃','🌙','⭐','🎨']
const TIME_OPTIONS = [
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
}
interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string }

type MainTab = 'tasks' | 'today'

export default function ChoresPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [completedSet, setCompletedSet] = useState(new Set<string>())
  const [familyId, setFamilyId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<MainTab>('tasks')
  const [filterChildId, setFilterChildId] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('⭐')
  const [type, setType] = useState<'chore' | 'routine'>('chore')
  const [timeOfDay, setTimeOfDay] = useState('morning')
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
  }

  function openNewForm() {
    setEditingTaskId(null)
    setTitle(''); setEmoji('⭐'); setType('chore'); setTimeOfDay('morning')
    setFrequency('daily'); setCarryOver(true); setStarValue(3)
    setRequiresPhoto(false); setRequiresBenchmarkPhoto(false)
    setBenchmarkDiffersPerChild(false); setBenchmarkFiles([]); setBenchmarkVideo(null)
    setExistingBenchmarks([]); setAssignedChildren([]); setDifficulty('medium')
    setFormError('')
    setShowForm(true)
  }

  async function openEditForm(task: Task) {
    setEditingTaskId(task.id)
    setTitle(task.title); setEmoji(task.emoji); setType(task.type)
    setTimeOfDay(task.time_of_day || 'morning')
    setFrequency(task.frequency || 'daily'); setCarryOver(task.carry_over ?? true)
    setStarValue(task.star_value); setRequiresPhoto(task.requires_photo)
    setRequiresBenchmarkPhoto(task.requires_benchmark_photo || false)
    setBenchmarkDiffersPerChild(task.benchmark_differs_per_child || false)
    setBenchmarkFiles([]); setBenchmarkVideo(null)
    setAssignedChildren(assignments[task.id] || [])
    setDifficulty((task as any).difficulty || 'medium')
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
      time_of_day: type === 'routine' ? timeOfDay : null,
      star_value: starValue,
      requires_photo: requiresPhoto || requiresBenchmarkPhoto,
      requires_benchmark_photo: requiresBenchmarkPhoto,
      benchmark_differs_per_child: benchmarkDiffersPerChild,
      frequency, carry_over: carryOver, difficulty,
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

  const childMap: Record<string, Child> = {}
  children.forEach(c => { childMap[c.id] = c })

  const visibleTasks = filterChildId
    ? tasks.filter(t => (assignments[t.id] || []).includes(filterChildId))
    : tasks

  const todayStr = new Date().toISOString().split('T')[0]
  const dateLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  if (pageLoading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="text-5xl animate-spin">✅</div></div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Compact header */}
      <div className="pt-10 pb-3 px-4" style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <h1 className="text-lg font-bold text-white">Tasks</h1>
          </div>
          <button onClick={showForm ? closeForm : openNewForm}
            className="bg-white font-bold px-4 py-2 rounded-2xl text-sm shadow active:scale-95 transition"
            style={{ color: 'var(--theme-from)' }}>
            {showForm ? '✕ Close' : '+ Add Task'}
          </button>
        </div>

        {/* Tab toggle */}
        <div className="max-w-sm mx-auto mt-3 flex bg-white/20 rounded-2xl p-1 gap-1">
          {([['tasks', '📋 Tasks'], ['today', '📅 Today']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setMainTab(tab)}
              className={`flex-1 py-1.5 rounded-xl text-sm font-semibold transition ${mainTab === tab ? 'bg-white' : 'text-white'}`}
              style={mainTab === tab ? { color: 'var(--theme-from)' } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Kid filter */}
      {children.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-2 shadow-sm">
          <div className="max-w-sm mx-auto flex gap-2 overflow-x-auto">
            <button onClick={() => setFilterChildId(null)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${!filterChildId ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
              style={!filterChildId ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
              All
            </button>
            {children.map(child => (
              <button key={child.id} onClick={() => setFilterChildId(filterChildId === child.id ? null : child.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold transition border-2 ${filterChildId === child.id ? '' : 'border-transparent bg-gray-100 text-gray-600'}`}
                style={filterChildId === child.id ? { backgroundColor: child.colour + '25', borderColor: child.colour, color: child.colour } : {}}>
                {child.avatar_url
                  ? <img src={child.avatar_url} className="w-5 h-5 rounded-full object-cover" alt=""/>
                  : <span>{child.avatar}</span>
                }
                {child.name.split(' ')[0]}
              </button>
            ))}
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

            {type === 'routine' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Time of day</p>
                <div className="flex gap-2">
                  {TIME_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setTimeOfDay(opt.value)}
                      className={`flex-1 py-2 rounded-2xl text-xs font-semibold transition ${timeOfDay === opt.value ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                      style={timeOfDay === opt.value ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            <div>
              <p className="text-xs text-gray-500 mb-2">Difficulty</p>
              <div className="flex gap-2">
                {([
                  { value: 'easy',   label: '🟢 Easy',   color: '#10B981' },
                  { value: 'medium', label: '🔵 Medium', color: '#3B82F6' },
                  { value: 'hard',   label: '🔴 Hard',   color: '#EF4444' },
                ] as const).map(opt => (
                  <button key={opt.value} onClick={() => setDifficulty(opt.value)}
                    className={`flex-1 py-2 rounded-2xl text-xs font-bold transition border-2 ${difficulty === opt.value ? 'text-white border-transparent' : 'bg-gray-50 border-gray-100 text-gray-500'}`}
                    style={difficulty === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
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
              <div className="flex gap-2 flex-wrap">
                {children.map(child => (
                  <button key={child.id}
                    onClick={() => setAssignedChildren(prev => prev.includes(child.id) ? prev.filter(id => id !== child.id) : [...prev, child.id])}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition ${assignedChildren.includes(child.id) ? 'ring-2 ring-purple-400' : 'opacity-50'}`}
                    style={{ backgroundColor: child.colour + '33' }}>
                    {child.avatar} {child.name}
                  </button>
                ))}
              </div>
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <button onClick={saveTask} disabled={saving}
              className="w-full text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
              {saving ? 'Saving...' : editingTaskId ? 'Update Task ✓' : 'Save Task ✓'}
            </button>
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {mainTab === 'tasks' && !showForm && (
          visibleTasks.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {visibleTasks.map(task => {
                const assignedKids = (assignments[task.id] || []).map(id => childMap[id]).filter(Boolean)
                return (
                  <div key={task.id} className="bg-white rounded-2xl p-2.5 shadow-sm flex flex-col items-center gap-1.5 relative">
                    <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                      <button onClick={() => openEditForm(task)} className="text-gray-300 text-xs active:scale-90 transition">✏️</button>
                      <button onClick={() => deleteTask(task.id)} className="text-gray-300 text-sm font-bold leading-none active:scale-90 transition">×</button>
                    </div>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-3xl mt-1"
                      style={{ backgroundColor: 'var(--theme-from)15' }}>
                      {task.emoji}
                    </div>
                    <p className="text-xs font-bold text-gray-700 text-center leading-tight line-clamp-2">{task.title}</p>
                    <p className="text-xs text-yellow-500 font-bold">⭐ {task.star_value}</p>
                    {(task as any).difficulty && (task as any).difficulty !== 'medium' && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${(task as any).difficulty === 'easy' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                        {(task as any).difficulty === 'easy' ? '🟢 Easy' : '🔴 Hard'}
                      </span>
                    )}
                    {task.requires_benchmark_photo && <span className="text-[9px] bg-purple-50 text-purple-400 font-semibold px-1 py-0.5 rounded-full">AI check</span>}
                    <div className="flex gap-0.5 flex-wrap justify-center">
                      {assignedKids.map(child => (
                        <span key={child.id} className="text-sm">{child.avatar}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
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
                          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl flex-shrink-0">{task.emoji}</div>
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
      </div>
    </div>
  )
}
