'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const AVATARS = ['🐨','🦁','🐯','🦊','🐻','🐼','🐸','🦄','🐙','🦋','🐬','🦉']
const COLOURS = ['#FF6B6B','#FF9F43','#FFC312','#A3CB38','#12CBC4','#1289A7','#9B59B6','#FDA7DF']

interface Child {
  id: string
  name: string
  avatar: string
  colour: string
}

export default function SettingsPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [familyName, setFamilyName] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [loading, setLoading] = useState(true)

  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newChild, setNewChild] = useState({ name: '', avatar: '🐨', colour: '#FF6B6B' })
  const [saving, setSaving] = useState(false)
  const [savingFamily, setSavingFamily] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: guardian } = await supabase
      .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return
    setFamilyId(guardian.family_id)

    const [{ data: childrenData }, { data: familyData }] = await Promise.all([
      supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
      supabase.from('families').select('name').eq('id', guardian.family_id).single(),
    ])

    setChildren(childrenData || [])
    setFamilyName(familyData?.name || '')
    setLoading(false)
  }

  async function saveFamilyName() {
    setSavingFamily(true)
    const supabase = createClient()
    await supabase.from('families').update({ name: familyName }).eq('id', familyId)
    setSavingFamily(false)
  }

  async function addChild() {
    if (!newChild.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('children').insert({ ...newChild, name: newChild.name.trim(), family_id: familyId })
    setNewChild({ name: '', avatar: '🐨', colour: '#FF6B6B' })
    setShowAddForm(false)
    setSaving(false)
    loadData()
  }

  async function saveEditChild() {
    if (!editingChild) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('children').update({
      name: editingChild.name,
      avatar: editingChild.avatar,
      colour: editingChild.colour,
    }).eq('id', editingChild.id)
    setEditingChild(null)
    setSaving(false)
    loadData()
  }

  async function deleteChild(childId: string) {
    if (!confirm('Remove this child? Their stars and completions will also be deleted.')) return
    const supabase = createClient()
    await supabase.from('children').delete().eq('id', childId)
    loadData()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-spin">⚙️</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-gradient-to-br from-gray-700 to-gray-900 pt-12 pb-8 px-4">
        <div className="max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm">Manage your family</p>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-6">

        {/* Family name */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-3">Family Name</h2>
          <div className="flex gap-2">
            <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
            <button onClick={saveFamilyName} disabled={savingFamily}
              className="bg-purple-500 text-white font-semibold px-4 py-2.5 rounded-2xl text-sm disabled:opacity-60 active:scale-95 transition">
              {savingFamily ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Children */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Children</h2>
            <button onClick={() => { setShowAddForm(!showAddForm); setEditingChild(null) }}
              className="bg-purple-100 text-purple-600 font-semibold px-3 py-1.5 rounded-xl text-sm active:scale-95 transition">
              {showAddForm ? '✕ Cancel' : '+ Add Child'}
            </button>
          </div>

          {/* Add child form */}
          {showAddForm && (
            <div className="border border-gray-100 rounded-2xl p-4 mb-4 space-y-3">
              <input type="text" value={newChild.name} onChange={e => setNewChild({ ...newChild, name: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                placeholder="Child's name" />
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Avatar</p>
                <div className="grid grid-cols-6 gap-1">
                  {AVATARS.map(a => (
                    <button key={a} onClick={() => setNewChild({ ...newChild, avatar: a })}
                      className={`text-2xl p-1 rounded-xl ${newChild.avatar === a ? 'bg-purple-100 ring-2 ring-purple-400' : 'hover:bg-gray-100'}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Colour</p>
                <div className="flex gap-2 flex-wrap">
                  {COLOURS.map(c => (
                    <button key={c} onClick={() => setNewChild({ ...newChild, colour: c })}
                      className={`w-8 h-8 rounded-full transition ${newChild.colour === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button onClick={addChild} disabled={saving || !newChild.name.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2.5 rounded-xl disabled:opacity-60 active:scale-95 transition text-sm">
                {saving ? 'Adding...' : `Add ${newChild.name || 'Child'}`}
              </button>
            </div>
          )}

          {/* Children list */}
          <div className="space-y-3">
            {children.map(child => (
              <div key={child.id}>
                {editingChild?.id === child.id ? (
                  <div className="border border-purple-200 rounded-2xl p-4 space-y-3">
                    <input type="text" value={editingChild.name}
                      onChange={e => setEditingChild({ ...editingChild, name: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Avatar</p>
                      <div className="grid grid-cols-6 gap-1">
                        {AVATARS.map(a => (
                          <button key={a} onClick={() => setEditingChild({ ...editingChild, avatar: a })}
                            className={`text-2xl p-1 rounded-xl ${editingChild.avatar === a ? 'bg-purple-100 ring-2 ring-purple-400' : 'hover:bg-gray-100'}`}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Colour</p>
                      <div className="flex gap-2 flex-wrap">
                        {COLOURS.map(c => (
                          <button key={c} onClick={() => setEditingChild({ ...editingChild, colour: c })}
                            className={`w-8 h-8 rounded-full transition ${editingChild.colour === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingChild(null)}
                        className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">Cancel</button>
                      <button onClick={saveEditChild} disabled={saving}
                        className="flex-1 bg-purple-500 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-60">
                        {saving ? '...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: child.colour + '33' }}>
                      {child.avatar}
                    </div>
                    <p className="font-semibold text-gray-800 flex-1">{child.name}</p>
                    <button onClick={() => { setEditingChild(child); setShowAddForm(false) }}
                      className="text-purple-500 text-sm font-semibold px-3 py-1.5 bg-purple-50 rounded-xl">Edit</button>
                    <button onClick={() => deleteChild(child.id)}
                      className="text-red-400 text-sm font-semibold px-3 py-1.5 bg-red-50 rounded-xl">Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <button onClick={async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          window.location.href = '/login'
        }} className="w-full bg-white rounded-2xl p-4 text-red-500 font-semibold shadow-sm text-center active:scale-95 transition">
          Sign Out
        </button>
      </div>
    </div>
  )
}
