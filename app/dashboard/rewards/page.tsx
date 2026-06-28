'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'

const REWARD_EMOJIS = [
  '🎁','🍦','🎬','🍕','🎮','📱','🏖️','🎨','📚','🍫','🎪','🏆','⚽','🎭','🎠',
  '💰','💳','🏧','💵','🍔','🍣','🍜','🍩','🍪','🎂','🧁','🥂','🍾',
  '📺','💻','🖥️','🎧','🎤','🎵','🎼','🎉','🎊','🪄','🔮','🛍️',
  '✈️','🚢','🏕️','🎡','🎢','🎰','🃏','🧩','🎯','🏅','🥇','👑',
  '💎','🌟','🌈','🦋','🌺','🌻','🌸','🧸','🪆','🎈',
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

  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🎁')
  const [starCost, setStarCost] = useState(10)
  const [scope, setScope] = useState<'family' | 'child'>('family')
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
    setEditingRewardId(null)
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
    const supabase = createClient()
    const { data: redemption } = await supabase.from('redemptions')
      .insert({ reward_id: reward.id, child_id: childId, status: 'approved' }).select('id').single()
    await supabase.from('star_ledger').insert({
      child_id: childId, delta: -(reward.star_cost),
      reason: `Redeemed: ${reward.title}`, source_type: 'redemption', source_id: redemption?.id,
    })
    setRedeemTarget(null)
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-bounce">🎁</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="pt-11 pb-2.5 px-4 bg-white border-b border-gray-100">
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto" onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
            <span className="text-2xl font-black" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'linear-gradient(135deg, #16BDCA, #F59E0B, #7C3AED, #22B14C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Rewards</span>
          </div>
          <ProfileButton/>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="bg-white px-4 pt-2.5 pb-1">
        <div className="max-w-sm mx-auto flex bg-gray-100 rounded-2xl p-1 gap-1">
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

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-4">
        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-3xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editingRewardId ? 'Edit Reward' : 'New Reward'}</h2>
              <button onClick={() => { setShowForm(false); resetForm() }} className="text-sm font-semibold text-gray-400">Cancel</button>
            </div>

            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="e.g. Movie night, Ice cream, Screen time..."
            />

            <div>
              <p className="text-xs text-gray-500 mb-2">Choose an emoji</p>
              <div className="flex flex-wrap gap-1.5">
                {REWARD_EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    className={`text-2xl p-1.5 rounded-xl transition ${emoji === e ? 'bg-pink-100 ring-2 ring-pink-400' : 'hover:bg-gray-100'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">
                Star cost: <span className="font-bold text-yellow-500">⭐ {starCost} stars</span>
              </p>
              <input type="range" min={1} max={500} value={starCost}
                onChange={e => setStarCost(Number(e.target.value))}
                className="w-full accent-pink-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1</span><span>100</span><span>250</span><span>500</span>
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
                <div className="flex gap-2 flex-wrap">
                  {children.map(c => (
                    <button key={c.id} onClick={() => setSelectedChildId(c.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition ${selectedChildId === c.id ? 'ring-2 ring-pink-400' : 'opacity-50'}`}
                      style={{ backgroundColor: c.colour + '33' }}>
                      {c.avatar} {c.name}
                    </button>
                  ))}
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
              <div className="grid grid-cols-4 gap-2">
                {[...rewards].sort((a, b) => a.star_cost - b.star_cost).map(reward => (
                  <div key={reward.id} className="bg-white rounded-2xl shadow-sm p-2 flex flex-col items-center gap-1 relative">
                    <button onClick={() => openEditReward(reward)}
                      className="absolute top-1 right-1 text-gray-300 text-[10px] active:scale-90 transition">✏️</button>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl mt-1"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 14%, white)' }}>
                      {reward.emoji}
                    </div>
                    <p className="font-semibold text-gray-800 text-[10px] text-center leading-tight line-clamp-2 w-full">{reward.title}</p>
                    <p className="text-[10px] font-bold text-yellow-500">⭐ {reward.star_cost}</p>
                    <button onClick={() => setRedeemTarget(reward)}
                      className="w-full text-white text-[10px] font-bold py-1 rounded-lg active:scale-95 transition"
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
