'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const REWARD_EMOJIS = ['🎁','🍦','🎬','🍕','🎮','📱','🏖️','🎨','📚','🍫','🎪','🏆','⚽','🎭','🎠']

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
}

interface Redemption {
  id: string
  child_id: string
  status: string
  rewards: { title: string; emoji: string; star_cost: number }
  children: { name: string; avatar: string; colour: string }
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [pending, setPending] = useState<Redemption[]>([])
  const [redeemed, setRedeemed] = useState<Redemption[]>([])
  const [familyId, setFamilyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'catalogue' | 'requests' | 'redeemed'>('catalogue')

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

    setChildren(childrenData || [])
    setRewards(rewardsData || [])
    setPending(pendingData as any || [])
    setRedeemed(redeemedData as any || [])
    setLoading(false)
  }

  async function saveReward() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('rewards').insert({
      family_id: familyId,
      title: title.trim(),
      emoji,
      star_cost: starCost,
      scope,
      child_id: scope === 'child' ? selectedChildId : null,
    })
    setTitle(''); setEmoji('🎁'); setStarCost(10); setScope('family'); setSelectedChildId(null)
    setShowForm(false); setSaving(false)
    loadData()
  }

  async function approveRedemption(r: Redemption) {
    const supabase = createClient()
    await supabase.from('redemptions').update({ status: 'approved' }).eq('id', r.id)
    await supabase.from('star_ledger').insert({
      child_id: r.child_id,
      delta: -(r.rewards.star_cost),
      reason: `Redeemed: ${r.rewards.title}`,
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
      <div className="pt-12 pb-4 px-4" style={{ background: 'var(--theme-gradient)' }}>
        <div className="max-w-sm mx-auto flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎁</span>
            <div>
              <h1 className="text-lg font-bold text-white">Rewards</h1>
              <p className="text-white/70 text-xs">{rewards.length} in catalogue</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-white font-bold px-4 py-2 rounded-2xl text-sm shadow active:scale-95 transition"
            style={{ color: 'var(--theme-from)' }}
          >
            {showForm ? '✕ Close' : '+ Add Reward'}
          </button>
        </div>

        <div className="max-w-sm mx-auto flex bg-white/20 rounded-2xl p-1 gap-1">
          {([['catalogue', 'Catalogue'], ['requests', 'Requests'], ['redeemed', 'Redeemed']] as const).map(([tab, lbl]) => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition relative ${activeTab === tab ? 'bg-white' : 'text-white'}`}
              style={activeTab === tab ? { color: 'var(--theme-from)' } : {}}
            >
              {lbl}
              {tab === 'requests' && pending.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-4">
        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-3xl shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800">New Reward</h2>

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
              <input type="range" min={1} max={100} value={starCost}
                onChange={e => setStarCost(Number(e.target.value))}
                className="w-full accent-pink-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1</span><span>100</span>
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
              {saving ? 'Saving...' : 'Save Reward ✓'}
            </button>
          </div>
        )}

        {/* Catalogue tab */}
        {activeTab === 'catalogue' && (
          <div className="space-y-5">
            {(() => {
              const tiers = [
                { label: '🌱 Quick Wins', sub: '1–20 stars', items: rewards.filter(r => r.star_cost <= 20), color: '#10B981' },
                { label: '🌟 Weekly Goals', sub: '21–75 stars', items: rewards.filter(r => r.star_cost > 20 && r.star_cost <= 75), color: '#F59E0B' },
                { label: '🏆 Big Prizes', sub: '76+ stars', items: rewards.filter(r => r.star_cost > 75), color: '#EF4444' },
              ]
              const hasTiered = tiers.some(t => t.items.length > 0)

              if (!hasTiered && rewards.length === 0) return (
                !showForm && (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4">🎁</div>
                    <p className="text-gray-500 font-medium">No rewards yet</p>
                    <p className="text-gray-400 text-sm mt-1">Tap "+ Add Reward" to create some</p>
                  </div>
                )
              )

              return tiers.map(tier => tier.items.length === 0 ? null : (
                <div key={tier.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base font-black text-gray-700">{tier.label}</span>
                    <span className="text-xs text-gray-400 font-medium">{tier.sub}</span>
                    <div className="flex-1 h-px bg-gray-100"/>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {tier.items.map(reward => (
                      <div key={reward.id} className="bg-white rounded-3xl shadow-sm p-3 flex flex-col items-center gap-2 relative">
                        <button onClick={() => deleteReward(reward.id)}
                          className="absolute top-2 right-2 text-gray-200 hover:text-red-400 text-lg font-bold leading-none transition">×</button>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-4xl mt-1"
                          style={{ backgroundColor: tier.color + '18' }}>
                          {reward.emoji}
                        </div>
                        <p className="font-semibold text-gray-800 text-xs text-center leading-tight">{reward.title}</p>
                        <p className="text-xs font-bold" style={{ color: tier.color }}>⭐ {reward.star_cost}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}

        {/* Requests tab */}
        {activeTab === 'requests' && (
          <div className="space-y-3">
            {pending.map(r => (
              <div key={r.id} className="bg-white rounded-3xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{(r.children as any)?.avatar}</span>
                  <div>
                    <p className="font-bold text-gray-800">{(r.children as any)?.name}</p>
                    <p className="text-sm text-gray-400">wants a reward</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-pink-50 rounded-2xl p-3 mb-3">
                  <span className="text-2xl">{(r.rewards as any)?.emoji}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{(r.rewards as any)?.title}</p>
                    <p className="text-sm text-yellow-500 font-semibold">⭐ {(r.rewards as any)?.star_cost} stars</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => denyRedemption(r.id)}
                    className="flex-1 border-2 border-gray-200 text-gray-500 font-semibold py-2.5 rounded-2xl hover:border-red-300 hover:text-red-500 transition">
                    Deny ✗
                  </button>
                  <button onClick={() => approveRedemption(r)}
                    className="flex-1 bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold py-2.5 rounded-2xl shadow active:scale-95 transition">
                    Approve ✓
                  </button>
                </div>
              </div>
            ))}
            {pending.length === 0 && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">✅</div>
                <p className="text-gray-500 font-medium">No pending requests</p>
                <p className="text-gray-400 text-sm mt-1">Kids can request rewards in Kid Mode</p>
              </div>
            )}
          </div>
        )}

        {/* Redeemed history tab */}
        {activeTab === 'redeemed' && (
          <div className="space-y-2">
            {redeemed.map(r => (
              <div key={r.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                {(r.children as any)?.avatar_url
                  ? <img src={(r.children as any).avatar_url} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt=""/>
                  : <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: ((r.children as any)?.colour || '#ccc') + '33' }}>{(r.children as any)?.avatar}</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span>{(r.rewards as any)?.emoji}</span>
                    <p className="font-semibold text-gray-800 text-sm truncate">{(r.rewards as any)?.title}</p>
                  </div>
                  <p className="text-xs text-gray-400">{(r.children as any)?.name}</p>
                </div>
                <span className="text-xs font-bold text-gray-400 flex-shrink-0">−{(r.rewards as any)?.star_cost} ⭐</span>
              </div>
            ))}
            {redeemed.length === 0 && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🎁</div>
                <p className="text-gray-500 font-medium">No rewards redeemed yet</p>
                <p className="text-gray-400 text-sm mt-1">Approved rewards will show up here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
