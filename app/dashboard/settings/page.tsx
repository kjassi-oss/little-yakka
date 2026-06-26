'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { THEMES, type ThemeKey, getStoredTheme, setStoredTheme } from '@/components/ThemeProvider'
import ProfileButton from '@/components/ProfileButton'

const AVATARS = [
  '🐨','🦁','🐯','🦊','🐻','🐼','🐸','🦄','🐙','🦋','🐬','🦉',
  '🐵','🐧','🦖','🐉','🦕','🦀','🐳','🐘','🦒','🐆','🦓','🦜',
  '🧸','🦸','🦹','🧙','🧚','🧜','🧝','🏄','🤸','⭐','🌈','🚀',
  '🎯','🏆','💎','🌺','🌻','🍀','🎸','🎨','🎮','🦋','🌙','🔥',
]
const COLOURS = [
  '#FF6B6B','#FF9F43','#FFC312','#A3CB38','#12CBC4','#1289A7','#9B59B6','#FDA7DF',
  '#EE5A24','#C0392B','#6C5CE7','#00B894','#E17055','#74B9FF','#A29BFE','#55EFC4',
]

interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string }

export default function SettingsPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [familyName, setFamilyName] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTheme, setActiveTheme] = useState<ThemeKey>('rainbow')
  const [themeOpen, setThemeOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newChild, setNewChild] = useState({ name: '', avatar: '🐨', colour: '#FF6B6B' })
  const [newChildPhoto, setNewChildPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingFamily, setSavingFamily] = useState(false)
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [parentPin, setParentPin] = useState('')
  const [adjustChild, setAdjustChild] = useState<Child | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustPin, setAdjustPin] = useState('')
  const [adjustError, setAdjustError] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const newChildPhotoRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData(); setActiveTheme(getStoredTheme()) }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: guardian } = await supabase.from('guardians').select('family_id, parent_pin').eq('auth_user_id', user.id).single()
    if (!guardian) return
    setFamilyId(guardian.family_id)
    setParentPin(guardian.parent_pin || '')
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
    await createClient().from('families').update({ name: familyName }).eq('id', familyId)
    setSavingFamily(false)
  }

  async function addChild() {
    if (!newChild.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: created } = await supabase.from('children')
      .insert({ ...newChild, name: newChild.name.trim(), family_id: familyId })
      .select('id').single()
    if (created && newChildPhoto) {
      const ext = newChildPhoto.name.split('.').pop()
      const path = `${familyId}/${created.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('kid-avatars').upload(path, newChildPhoto, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('kid-avatars').getPublicUrl(path)
        await supabase.from('children').update({ avatar_url: publicUrl }).eq('id', created.id)
      }
    }
    setNewChild({ name: '', avatar: '🐨', colour: '#FF6B6B' }); setNewChildPhoto(null)
    setShowAddForm(false); setSaving(false); loadData()
  }

  async function applyStarAdjust() {
    if (!adjustChild) return
    const amount = parseInt(adjustAmount, 10)
    if (!amount || isNaN(amount)) { setAdjustError('Enter a number (e.g. 5 or -5).'); return }
    if (adjustPin !== parentPin) { setAdjustError('Wrong PIN.'); return }
    setAdjustSaving(true); setAdjustError('')
    await createClient().from('star_ledger').insert({
      child_id: adjustChild.id, delta: amount,
      reason: adjustReason.trim() || (amount > 0 ? 'Bonus stars' : 'Stars removed'),
      source_type: 'manual',
    })
    setAdjustChild(null); setAdjustAmount(''); setAdjustReason(''); setAdjustPin(''); setAdjustSaving(false)
  }

  async function saveEditChild() {
    if (!editingChild) return
    setSaving(true)
    await createClient().from('children').update({
      name: editingChild.name, avatar: editingChild.avatar, colour: editingChild.colour,
    }).eq('id', editingChild.id)
    setEditingChild(null); setSaving(false); loadData()
  }

  async function deleteChild(childId: string) {
    if (!confirm('Remove this child? Their stars and completions will also be deleted.')) return
    await createClient().from('children').delete().eq('id', childId)
    loadData()
  }

  async function uploadChildPhoto(childId: string, file: File) {
    setUploadingPhotoId(childId)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${familyId}/${childId}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('kid-avatars').upload(path, file, { upsert: true })
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('kid-avatars').getPublicUrl(path)
      await supabase.from('children').update({ avatar_url: publicUrl }).eq('id', childId)
      loadData()
    }
    setUploadingPhotoId(null)
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setSendingInvite(true)
    const supabase = createClient()
    const { data } = await supabase.from('guardian_invitations')
      .insert({ family_id: familyId, invited_email: inviteEmail.trim() })
      .select('token').single()
    if (data) {
      const link = `${window.location.origin}/join/${data.token}`
      setInviteLink(link)
    }
    setSendingInvite(false)
  }

  async function copyInviteLink() {
    await navigator.clipboard.writeText(inviteLink)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2500)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-5xl animate-spin">⚙️</div></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="pt-11 pb-4 px-4" style={{ background: 'var(--theme-gradient)' }}>
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <div>
              <h1 className="text-lg font-bold text-white">Settings</h1>
              <p className="text-white/70 text-xs">Manage your family</p>
            </div>
          </div>
          <ProfileButton/>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-6">

        {/* How it works — collapsible visual guide */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <button onClick={() => setGuideOpen(o => !o)} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📖</span>
              <div className="text-left">
                <h2 className="font-bold text-gray-800 leading-tight">How Little Yakka works</h2>
                <p className="text-xs text-gray-400">A quick visual guide</p>
              </div>
            </div>
            <span className={`text-gray-300 text-xl transition-transform ${guideOpen ? 'rotate-90' : ''}`}>›</span>
          </button>

          {guideOpen && (
            <div className="mt-4 space-y-3">
              {[
                { e: '👶', t: 'Add your kids', d: 'Create a profile and photo for each child below.' },
                { e: '📋', t: 'Create tasks', d: 'Add chores & routines, set stars, assign to kids. Tap + on the Tasks page.' },
                { e: '⭐', t: 'Kids earn stars', d: 'Open Kid Mode (⭐, top-right) — kids tap tasks to tick them off and collect stars.' },
                { e: '🕓', t: 'Approve if needed', d: 'Tasks marked "needs approval" wait for your OK before stars are given.' },
                { e: '🎁', t: 'Spend on rewards', d: 'Set up rewards; kids swap stars for them. You approve each request.' },
                { e: '📅', t: 'Plan with Calendar', d: 'See an agenda, week or month view of what\'s coming up.' },
                { e: '📊', t: 'Track with Stats', d: 'Completion %, streaks and star charts — weekly or monthly, per kid.' },
                { e: '🎨', t: 'Make it yours', d: 'Pick a colour theme below to restyle the whole app.' },
              ].map(s => (
                <div key={s.t} className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 14%, white)' }}>{s.e}</div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{s.t}</p>
                    <p className="text-xs text-gray-400 leading-snug">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Colour theme — collapsible */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <button onClick={() => setThemeOpen(o => !o)} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full shadow" style={{ background: THEMES[activeTheme]?.gradient }}/>
              <div className="text-left">
                <h2 className="font-bold text-gray-800 leading-tight">Colour Theme</h2>
                <p className="text-xs text-gray-400">{THEMES[activeTheme]?.emoji} {THEMES[activeTheme]?.name}</p>
              </div>
            </div>
            <span className={`text-gray-300 text-xl transition-transform ${themeOpen ? 'rotate-90' : ''}`}>›</span>
          </button>

          {themeOpen && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, theme]) => (
                <button key={key} onClick={() => { setActiveTheme(key); setStoredTheme(key) }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition active:scale-95 ${activeTheme === key ? 'shadow-md' : 'border-transparent hover:border-gray-200'}`}
                  style={activeTheme === key ? { borderColor: theme.from } : {}}>
                  <div className="w-10 h-10 rounded-full shadow-md" style={{ background: theme.gradient }}/>
                  <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">{theme.emoji} {theme.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Invite co-parent */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-1">Invite Co-Parent</h2>
          <p className="text-xs text-gray-400 mb-3">Give another parent access to the same family account</p>
          {!inviteLink ? (
            <div className="flex gap-2">
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                placeholder="partner@email.com"/>
              <button onClick={sendInvite} disabled={sendingInvite || !inviteEmail.trim()}
                className="text-white font-semibold px-4 py-2.5 rounded-2xl text-sm disabled:opacity-60 active:scale-95 transition"
                style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
                {sendingInvite ? '...' : 'Invite'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-green-600 font-semibold">✓ Invite link created!</p>
              <div className="bg-gray-50 rounded-2xl px-4 py-3 text-xs text-gray-500 break-all">{inviteLink}</div>
              <div className="flex gap-2">
                <button onClick={copyInviteLink}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white active:scale-95 transition"
                  style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
                  {inviteCopied ? '✓ Copied!' : 'Copy link'}
                </button>
                <button onClick={() => { setInviteLink(''); setInviteEmail('') }}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 bg-gray-100">
                  New invite
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Family name */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-3">Family Name</h2>
          <div className="flex gap-2">
            <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"/>
            <button onClick={saveFamilyName} disabled={savingFamily}
              className="text-white font-semibold px-4 py-2.5 rounded-2xl text-sm disabled:opacity-60 active:scale-95 transition"
              style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
              {savingFamily ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Children */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Children</h2>
            <button onClick={() => { setShowAddForm(!showAddForm); setEditingChild(null) }}
              className="font-semibold px-3 py-1.5 rounded-xl text-sm active:scale-95 transition"
              style={{ backgroundColor: 'var(--theme-from)22', color: 'var(--theme-from)' }}>
              {showAddForm ? '✕ Cancel' : '+ Add Child'}
            </button>
          </div>

          {showAddForm && (
            <div className="border border-gray-100 rounded-2xl p-4 mb-4 space-y-3">
              {/* Photo + name */}
              <div className="flex items-center gap-3">
                <button onClick={() => newChildPhotoRef.current?.click()} className="relative flex-shrink-0 active:scale-95 transition">
                  {newChildPhoto
                    ? <img src={URL.createObjectURL(newChildPhoto)} className="w-14 h-14 rounded-2xl object-cover" style={{ border: `3px solid ${newChild.colour}` }} alt=""/>
                    : <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: newChild.colour + '33' }}>{newChild.avatar}</div>}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs shadow">📷</div>
                </button>
                <input type="file" accept="image/*" className="hidden" ref={newChildPhotoRef}
                  onChange={e => e.target.files?.[0] && setNewChildPhoto(e.target.files[0])}/>
                <input type="text" value={newChild.name} onChange={e => setNewChild({ ...newChild, name: e.target.value })}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm" placeholder="Child's name"/>
              </div>
              <p className="text-[11px] text-gray-400 -mt-1">Tap the picture to add a photo (optional)</p>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Avatar emoji</p>
                <div className="grid grid-cols-6 gap-1">
                  {AVATARS.map(a => (
                    <button key={a} onClick={() => setNewChild({ ...newChild, avatar: a })}
                      className={`text-2xl p-1 rounded-xl ${newChild.avatar === a ? 'ring-2 ring-purple-400 bg-purple-50' : 'hover:bg-gray-100'}`}>{a}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Colour</p>
                <div className="flex gap-2 flex-wrap">
                  {COLOURS.map(c => (
                    <button key={c} onClick={() => setNewChild({ ...newChild, colour: c })}
                      className={`w-8 h-8 rounded-full transition ${newChild.colour === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''}`}
                      style={{ backgroundColor: c }}/>
                  ))}
                </div>
              </div>
              <button onClick={addChild} disabled={saving || !newChild.name.trim()}
                className="w-full text-white font-bold py-2.5 rounded-xl disabled:opacity-60 active:scale-95 transition text-sm"
                style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
                {saving ? 'Adding...' : `Add ${newChild.name || 'Child'}`}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {children.map(child => (
              <div key={child.id}>
                {editingChild?.id === child.id ? (
                  <div className="border border-purple-200 rounded-2xl p-4 space-y-3">
                    <input type="text" value={editingChild.name} onChange={e => setEditingChild({ ...editingChild, name: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"/>
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Avatar</p>
                      <div className="grid grid-cols-6 gap-1">
                        {AVATARS.map(a => (
                          <button key={a} onClick={() => setEditingChild({ ...editingChild, avatar: a })}
                            className={`text-2xl p-1 rounded-xl ${editingChild.avatar === a ? 'ring-2 ring-purple-400 bg-purple-50' : 'hover:bg-gray-100'}`}>{a}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Colour</p>
                      <div className="flex gap-2 flex-wrap">
                        {COLOURS.map(c => (
                          <button key={c} onClick={() => setEditingChild({ ...editingChild, colour: c })}
                            className={`w-8 h-8 rounded-full transition ${editingChild.colour === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''}`}
                            style={{ backgroundColor: c }}/>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingChild(null)} className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">Cancel</button>
                      <button onClick={saveEditChild} disabled={saving}
                        className="flex-1 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
                        {saving ? '...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {/* Avatar with photo upload */}
                    <div className="relative flex-shrink-0">
                      {child.avatar_url ? (
                        <img src={child.avatar_url} alt={child.name} className="w-14 h-14 rounded-2xl object-cover" style={{ border: `3px solid ${child.colour}` }}/>
                      ) : (
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>
                      )}
                      <button onClick={() => photoInputRefs.current[child.id]?.click()}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs shadow-sm active:scale-90 transition">
                        {uploadingPhotoId === child.id ? '⏳' : '📷'}
                      </button>
                      <input type="file" accept="image/*" className="hidden"
                        ref={el => { photoInputRefs.current[child.id] = el }}
                        onChange={e => e.target.files?.[0] && uploadChildPhoto(child.id, e.target.files[0])}/>
                    </div>
                    <p className="font-semibold text-gray-800 flex-1">{child.name}</p>
                    <button onClick={() => { setAdjustChild(child); setAdjustAmount(''); setAdjustReason(''); setAdjustPin(''); setAdjustError('') }}
                      aria-label="Adjust stars" className="text-sm font-bold px-2.5 py-1.5 rounded-xl bg-yellow-50 text-yellow-600">⭐ ±</button>
                    <button onClick={() => { setEditingChild(child); setShowAddForm(false) }}
                      className="text-sm font-semibold px-3 py-1.5 rounded-xl" style={{ backgroundColor: 'var(--theme-from)15', color: 'var(--theme-from)' }}>
                      Edit
                    </button>
                    <button onClick={() => deleteChild(child.id)} className="text-red-400 text-sm font-semibold px-2.5 py-1.5 bg-red-50 rounded-xl">✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/login' }}
          className="w-full bg-white rounded-2xl p-4 text-red-500 font-semibold shadow-sm text-center active:scale-95 transition">
          Sign Out
        </button>
      </div>

      {/* Manual star adjust — PIN protected */}
      {adjustChild && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setAdjustChild(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pop-in" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"/>
            <h3 className="font-black text-gray-800 text-lg mb-1">Adjust {adjustChild.name.split(' ')[0]}'s stars ⭐</h3>
            <p className="text-gray-400 text-sm mb-4">Give or remove stars. Use a minus for removing (e.g. -5).</p>

            <div className="flex gap-2 mb-3">
              <button onClick={() => setAdjustAmount(a => String((parseInt(a, 10) || 0) - 1))}
                className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-600 text-2xl font-black active:scale-90 transition">−</button>
              <input type="number" inputMode="numeric" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                className="flex-1 border border-gray-200 rounded-2xl px-4 text-center text-2xl font-black text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                placeholder="0"/>
              <button onClick={() => setAdjustAmount(a => String((parseInt(a, 10) || 0) + 1))}
                className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-600 text-2xl font-black active:scale-90 transition">+</button>
            </div>

            <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-300"
              placeholder="Reason (optional) — e.g. helped a neighbour"/>

            <input type="password" inputMode="numeric" maxLength={6} value={adjustPin} onChange={e => setAdjustPin(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-center text-xl tracking-widest text-gray-800 mb-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
              placeholder="Parent PIN"/>

            {adjustError && <p className="text-red-500 text-xs mb-2">{adjustError}</p>}

            <div className="flex gap-2">
              <button onClick={() => setAdjustChild(null)}
                className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold active:scale-95 transition">Cancel</button>
              <button onClick={applyStarAdjust} disabled={adjustSaving}
                className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
                style={{ background: 'var(--theme-gradient)' }}>
                {adjustSaving ? 'Saving...' : 'Apply'}
              </button>
            </div>
            {!parentPin && <p className="text-[11px] text-amber-500 mt-2 text-center">No parent PIN set yet — set one during setup to protect this.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
