'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'
import LoadingLogo from '@/components/LoadingLogo'
import CelebrationBurst from '@/components/CelebrationBurst'
import { redeemFeedback } from '@/lib/feedback'

const REWARD_EMOJIS = [
  '🎁','🍦','🎬','🍕','🎮','📱','🏖️','🎨','📚','🍫','🏆','⚽',
  '🎠','🍔','🍩','🍪','🎂','🧁','📺','💻','🎧','🎵','🎉','🛍️',
  '✈️','🎡','🎢','🎯','🏅','🥇','👑','💎','🌟','🧸','🍭','🌈',
]

// Quick-start templates (same set as the setup wizard) — hidden until requested
const REWARD_TEMPLATES: { title: string; emoji: string }[] = [
  { title: 'Ice Cream', emoji: '🍦' }, { title: 'iPad Time', emoji: '📱' },
  { title: 'Go To Movies', emoji: '🎬' }, { title: 'Takeaway', emoji: '🍔' },
  { title: 'Choose Dessert', emoji: '🍰' }, { title: 'Stay Up Extra 30 Mins', emoji: '🌙' },
  { title: '30 Mins Computer Games', emoji: '🎮' }, { title: 'Lollie', emoji: '🍭' },
  { title: 'Choose Family Movie', emoji: '🍿' },
]

interface Reward {
  id: string
  title: string
  emoji: string
  star_cost: number
  scope: 'family' | 'child'
  child_id: string | null
}

interface Child {
  id: string
  name: string
  avatar: string
  colour: string
  avatar_url?: string
}

interface Redemption {
  id: string
  child_id: string
  status: string
  rewards: { title: string; emoji: string; star_cost: number } | null
  children: { name: string; avatar: string; colour: string; avatar_url?: string } | null
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [pending, setPending] = useState<Redemption[]>([])
  const [redeemed, setRedeemed] = useState<Redemption[]>([])
  const [familyId, setFamilyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'catalogue' | 'redeemed'>('catalogue')
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null)
  const [redeemTarget, setRedeemTarget] = useState<Reward | null>(null)
  const [expandedChild, setExpandedChild] = useState<string | null>(null)
  const [redeemBurst, setRedeemBurst] = useState<{ colour: string; emoji: string; photo?: string | null; avatar?: string; title: string; sub?: string } | null>(null)

  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🎁')
  const [starCost, setStarCost] = useState(10)
  const [scope, setScope] = useState<'family' | 'child'>('family')
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: guardian } = await supabase
      .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return
    setFamilyId(guardian.family_id)

    const { data: childrenData } = await supabase
      .from('children').select('*').eq('family_id', guardian.family_id).order('name')
    const childIds = childrenData?.map(c => c.id) || []

    const [{ data: rewardsData }, { data: pendingData }, { data: redeemedData }] = await Promise.all([
      supabase.from('rewards').select('*').eq('family_id', guardian.family_id).order('star_cost'),
      supabase.from('redemptions')
        .select('*, rewards(title, emoji, star_cost), children(name, avatar, colour, avatar_url)')
        .eq('status', 'requested')
        .in('child_id', childIds.length ? childIds : ['none'])
        .order('created_at', { ascending: false }),
      supabase.from('redemptions')
        .select('*, rewards(title, emoji, star_cost), children(name, avatar, colour, avatar_url)')
        .eq('status', 'approved')
        .in('child_id', childIds.length ? childIds : ['none'])
        .order('created_at', { ascending: false })
        .limit(80),
    ])

    const { data: starData } = await supabase.from('star_ledger').select('child_id, delta')
      .in('child_id', childIds.length ? childIds : ['none'])
    const bal: Record<string, number> = {}
    starData?.forEach(s => { bal[s.child_id] = (bal[s.child_id] || 0) + s.delta })

    setChildren(childrenData || [])
    setRewards(rewardsData || [])
    setPending(pendingData as any || [])
    setRedeemed(redeemedData as any || [])
    setBalances(bal)
    setLoading(false)
  }

  function resetForm() {
    setTitle(''); setEmoji('🎁'); setStarCost(10); setScope('family'); setSelectedChildId(null)
    setEditingRewardId(null); setShowTemplates(false)
  }

  function openEditReward(r: Reward) {
    setEditingRewardId(r.id)
    setTitle(r.title); setEmoji(r.emoji); setStarCost(r.star_cost)
    setScope(r.scope); setSelectedChildId(r.child_id)
    setShowForm(true)
  }

  async function saveReward() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      family_id: familyId,
      title: title.trim(),
      emoji,
      star_cost: starCost,
      scope,
      child_id: scope === 'child' ? selectedChildId : null,
    }
    if (editingRewardId) await supabase.from('rewards').update(payload).eq('id', editingRewardId)
    else await supabase.from('rewards').insert(payload)
    resetForm()
    setShowForm(false); setSaving(false)
    loadData()
  }

  // Parent redeems a reward directly for a child (deducts stars now).
  async function directRedeem(reward: Reward, childId: string) {
    const child = children.find(c => c.id === childId)
    redeemFeedback()
    setRedeemTarget(null)
    setRedeemBurst({
      colour: child?.colour || '#EC4899', emoji: reward.emoji,
      photo: child?.avatar_url, avatar: child?.avatar,
      title: 'Redeemed! 🎉', sub: reward.title,
    })
    const supabase = createClient()
    const { data: redemption } = await supabase.from('redemptions')
      .insert({ reward_id: reward.id, child_id: childId, status: 'approved' }).select('id').single()
    await supabase.from('star_ledger').insert({
      child_id: childId, delta: -(reward.star_cost),
      reason: `Redeemed: ${reward.title}`, source_type: 'redemption', source_id: redemption?.id,
    })
    loadData()
  }

  async function undoRedemption(r: Redemption) {
    if (!confirm(`Undo "${r.rewards?.title}" for ${r.children?.name}? Stars will be refunded.`)) return
    const supabase = createClient()
    await supabase.from('redemptions').delete().eq('id', r.id)
    await supabase.from('star_ledger').insert({
      child_id: r.child_id, delta: r.rewards?.star_cost || 0,
      reason: `Undo redeem: ${r.rewards?.title}`, source_type: 'undo',
    })
    loadData()
  }

  async function approveRedemption(r: Redemption) {
    const supabase = createClient()
    await supabase.from('redemptions').update({ status: 'approved' }).eq('id', r.id)
    await supabase.from('star_ledger').insert({
      child_id: r.child_id,
      delta: -(r.rewards?.star_cost || 0),
      reason: `Redeemed: ${r.rewards?.title}`,
      source_type: 'redemption',
      source_id: r.id,
    })
    loadData()
  }

  async function denyRedemption(id: string) {
    const supabase = createClient()
    await supabase.from('redemptions').update({ status: 'denied' }).eq('id', id)
    loadData()
  }

  async function deleteReward(id: string) {
    const supabase = createClient()
    await supabase.from('rewards').delete().eq('id', id)
    loadData()
  }

  if (loading) return <LoadingLogo />

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="pt-11 pb-2.5 px-4 bg-white border-b border-gray-100">
        <div className="max-w-sm lg:max-w-3xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center">
          <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto justify-self-start" onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
          <span className="text-4xl font-black leading-none justify-self-center" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'linear-gradient(135deg, #16BDCA, #F59E0B, #7C3AED, #22B14C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Rewards</span>
          <div className="justify-self-end"><ProfileButton/></div>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="bg-white px-4 pt-2.5 pb-1">
        <div className="max-w-sm lg:max-w-3xl mx-auto flex bg-gray-100 rounded-2xl p-1 gap-1">
          {([['catalogue', 'Catalogue'], ['redeemed', 'Redeemed']] as const).map(([tab, lbl]) => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-xl text-sm font-semibold transition ${activeTab === tab ? 'text-white shadow' : 'text-gray-400'}`}
              style={activeTab === tab ? { background: 'var(--theme-gradient)' } : {}}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-sm lg:max-w-3xl mx-auto px-4 mt-4 space-y-4">
        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-3xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editingRewardId ? 'Edit Reward' : 'New Reward'}</h2>
              <button onClick={() => { setShowForm(false); resetForm() }} className="text-sm font-semibold text-gray-400">Cancel</button>
            </div>

            {/* Templates — hidden until requested */}
            <div>
              <button onClick={() => setShowTemplates(t => !t)}
                className="text-sm font-bold" style={{ color: 'var(--theme-from)' }}>
                {showTemplates ? '× Hide templates' : '✨ Use a template'}
              </button>
              {showTemplates && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {REWARD_TEMPLATES.map(t => (
                    <button key={t.title} onClick={() => { setTitle(t.title); setEmoji(t.emoji); setShowTemplates(false) }}
                      className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-gray-50 active:scale-95 transition">
                      <span className="text-2xl">{t.emoji}</span>
                      <span className="text-[10px] font-semibold text-gray-500 text-center leading-tight">{t.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="e.g. Movie night, Ice cream, Screen time..."
            />

            <div>
              <p className="text-xs text-gray-500 mb-2">Choose an emoji</p>
              <div className="grid grid-cols-6 gap-1.5">
                {REWARD_EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    className={`text-2xl p-1.5 rounded-xl transition flex items-center justify-center ${emoji === e ? 'bg-pink-100 ring-2 ring-pink-400' : 'hover:bg-gray-100'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">Star cost</p>
                <input type="number" inputMode="numeric" min={1} value={starCost}
                  onChange={e => setStarCost(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-1.5 text-center font-black text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"/>
              </div>
              <input type="range" min={1} max={50} value={Math.min(starCost, 50)}
                onChange={e => setStarCost(Number(e.target.value))}
                className="w-full accent-pink-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1</span><span>25</span><span>50</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Who can redeem this?</p>
              <div className="flex bg-gray-100 rounded-2xl p-1 mb-2">
                <button onClick={() => setScope('family')}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${scope === 'family' ? 'bg-white text-pink-600 shadow' : 'text-gray-400'}`}>
                  👨‍👩‍👧 All kids
                </button>
                <button onClick={() => setScope('child')}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${scope === 'child' ? 'bg-white text-pink-600 shadow' : 'text-gray-400'}`}>
                  One child
                </button>
              </div>
              {scope === 'child' && (
                <div className="flex gap-3 flex-wrap">
                  {children.map(c => {
                    const sel = selectedChildId === c.id
                    return (
                      <button key={c.id} onClick={() => setSelectedChildId(c.id)}
                        className={`flex flex-col items-center gap-1 active:scale-95 transition ${sel ? '' : 'opacity-50'}`}>
                        {c.avatar_url
                          ? <img src={c.avatar_url} className="w-12 h-12 rounded-full object-cover"
                              style={{ boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${c.colour}` : 'none' }} alt=""/>
                          : <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                              style={{ backgroundColor: c.colour + '25', boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${c.colour}` : 'none' }}>{c.avatar}</div>}
                        <span className="text-[11px] font-bold truncate max-w-[56px]" style={{ color: sel ? c.colour : '#9ca3af' }}>{c.name.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button onClick={saveReward} disabled={saving || !title.trim()}
              className="w-full text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
              style={{ background: 'var(--theme-gradient)' }}>
              {saving ? 'Saving...' : editingRewardId ? 'Update Reward ✓' : 'Save Reward ✓'}
            </button>
            {editingRewardId && (
              <button onClick={() => { if (confirm('Delete this reward?')) { deleteReward(editingRewardId); setShowForm(false); resetForm() } }}
                className="w-full text-red-500 font-semibold py-2.5 rounded-2xl bg-red-50 active:scale-95 transition text-sm">
                🗑 Delete reward
              </button>
            )}
          </div>
        )}

        {/* Catalogue tab — flat grid sorted by star cost */}
        {activeTab === 'catalogue' && (
          <div>
            {rewards.length === 0 && !showForm ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🎁</div>
                <p className="text-gray-500 font-medium">No rewards yet</p>
                <p className="text-gray-400 text-sm mt-1">Tap + to create some</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
                {[...rewards].sort((a, b) => a.star_cost - b.star_cost).map(reward => (
                  <div key={reward.id} className="bg-white rounded-2xl shadow-sm p-3 flex flex-col items-center gap-1.5 relative">
                    <button onClick={() => openEditReward(reward)}
                      className="absolute top-1.5 right-1.5 text-gray-300 text-xs active:scale-90 transition">✏️</button>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mt-1 bg-white"
                      style={{ border: '1.5px solid var(--theme-from)' }}>
                      {reward.emoji}
                    </div>
                    <p className="font-semibold text-gray-800 text-xs text-center leading-tight line-clamp-2 w-full">{reward.title}</p>
                    <p className="text-xs font-bold text-yellow-500">⭐ {reward.star_cost}</p>
                    <button onClick={() => setRedeemTarget(reward)}
                      className="w-full text-white text-xs font-bold py-1.5 rounded-lg active:scale-95 transition"
                      style={{ background: 'var(--theme-gradient)' }}>
                      Redeem
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Redeemed history tab — grouped by child, collapsible */}
        {activeTab === 'redeemed' && (
          <div className="space-y-3">
            {children.map(child => {
              const items = redeemed.filter(r => r.child_id === child.id)
              if (items.length === 0) return null
              const open = expandedChild === child.id
              return (
                <div key={child.id} className="bg-white rounded-3xl shadow-sm overflow-hidden">
                  <button onClick={() => setExpandedChild(open ? null : child.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition">
                    {child.avatar_url
                      ? <img src={child.avatar_url} className="w-9 h-9 rounded-full object-cover" alt=""/>
                      : <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                          style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>}
                    <p className="font-bold text-gray-800 flex-1 text-left">{child.name.split(' ')[0]}</p>
                    <span className="text-xs font-semibold text-gray-400">{items.length} redeemed</span>
                    <span className={`text-gray-300 text-lg transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-3 space-y-2">
                      {items.map(r => (
                        <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
                          <span className="text-xl">{(r.rewards as any)?.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{(r.rewards as any)?.title}</p>
                            <p className="text-xs text-gray-400">−{(r.rewards as any)?.star_cost} ⭐</p>
                          </div>
                          <button onClick={() => undoRedemption(r)}
                            className="text-xs text-gray-300 hover:text-red-400 font-semibold transition px-2 py-1 rounded-lg hover:bg-red-50">Undo</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {redeemed.length === 0 && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🎁</div>
                <p className="text-gray-500 font-medium">No rewards redeemed yet</p>
                <p className="text-gray-400 text-sm mt-1">Redeemed rewards will show up here</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Direct-redeem child picker */}
      {redeemTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setRedeemTarget(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pop-in" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"/>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{redeemTarget.emoji}</span>
              <h3 className="font-black text-gray-800 text-lg">Redeem {redeemTarget.title}</h3>
            </div>
            <p className="text-gray-400 text-sm mb-4">Costs ⭐ {redeemTarget.star_cost} — who's redeeming?</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {children
                .filter(c => redeemTarget.scope === 'family' || redeemTarget.child_id === c.id)
                .map(child => {
                  const bal = balances[child.id] || 0
                  const canAfford = bal >= redeemTarget.star_cost
                  return (
                    <button key={child.id} disabled={!canAfford} onClick={() => directRedeem(redeemTarget, child.id)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition ${canAfford ? 'active:scale-95' : 'opacity-40'}`}>
                      {child.avatar_url
                        ? <img src={child.avatar_url} className="w-14 h-14 rounded-2xl object-cover" style={{ border: `3px solid ${child.colour}` }} alt=""/>
                        : <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                            style={{ backgroundColor: child.colour + '25', border: `3px solid ${child.colour}40` }}>{child.avatar}</div>}
                      <span className="text-xs font-bold text-gray-700 truncate max-w-full">{child.name.split(' ')[0]}</span>
                      <span className="text-[10px] font-semibold" style={{ color: canAfford ? '#eab308' : '#ef4444' }}>⭐ {bal}</span>
                    </button>
                  )
                })}
            </div>
            <button onClick={() => setRedeemTarget(null)}
              className="w-full text-gray-500 font-semibold py-3 rounded-2xl border border-gray-200 active:scale-95 transition">Cancel</button>
          </div>
        </div>
      )}

      {redeemBurst && (
        <CelebrationBurst colour={redeemBurst.colour} emoji={redeemBurst.emoji} photo={redeemBurst.photo}
          avatar={redeemBurst.avatar} title={redeemBurst.title} sub={redeemBurst.sub}
          duration={2400} onDone={() => setRedeemBurst(null)} />
      )}

      {/* Large + FAB */}
      <button onClick={() => { if (showForm) { setShowForm(false); resetForm() } else { resetForm(); setShowForm(true) } }}
        aria-label={showForm ? 'Close' : 'Add reward'}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition z-40"
        style={{ background: 'var(--theme-gradient)' }}>
        <span className="text-3xl leading-none mb-0.5">{showForm ? '×' : '+'}</span>
      </button>
    </div>
  )
}
