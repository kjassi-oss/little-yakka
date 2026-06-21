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
  const [familyId, setFamilyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'catalogue' | 'requests'>('catalogue')

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

    const [{ data: rewardsData }, { data: pendingData }] = await Promise.all([
      supabase.from('rewards').select('*').eq('family_id', guardian.family_id).order('star_cost'),
      supabase.from('redemptions')
        .select('*, rewards(title, emoji, star_cost), children(name, avatar, colour)')
        .eq('status', 'requested')
        .in('child_id', childIds.length ? childIds : ['none'])
        .order('created_at', { ascending: false }),
    ])

    setChildren(childrenData || [])
    setRewards(rewardsData || [])
    setPending(pendingData as any || [])
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
      <div className="bg-gradient-to-br from-pink-500 to-orange-400 pt-12 pb-4 px-4">
        <div className="max-w-sm mx-auto flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Rewards</h1>
            <p className="text-pink-100 text-sm">{rewards.length} in catalogue</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-white text-pink-600 font-bold px-4 py-2 rounded-2xl text-sm shadow active:scale-95 transition"
          >
            {showForm ? '✕ Close' : '+ Add Reward'}
          </button>
        </div>

        <div className="max-w-sm mx-auto flex bg-white/20 rounded-2xl p-1">
          <button
            onClick={() => setActiveTab('catalogue')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'catalogue' ? 'bg-white text-pink-600' : 'text-white'}`}
          >
            Catalogue
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition relative ${activeTab === 'requests' ? 'bg-white text-pink-600' : 'text-white'}`}
          >
            Requests
            {pending.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                {pending.length}
              </span>
            )}
          </button>
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
              className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Reward ✓'}
            </button>
          </div>
        )}

        {/* Catalogue tab */}
        {activeTab === 'catalogue' && (
          <div className="space-y-2">
            {rewards.map(reward => (
              <div key={reward.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                  {reward.emoji}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{reward.title}</p>
                  <p className="text-sm text-yellow-500 font-semibold">⭐ {reward.star_cost} stars</p>
                </div>
                <button onClick={() => deleteReward(reward.id)}
                  className="text-gray-300 hover:text-red-400 text-2xl font-bold transition">×</button>
              </div>
            ))}
            {rewards.length === 0 && !showForm && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🎁</div>
                <p className="text-gray-500 font-medium">No rewards yet</p>
                <p className="text-gray-400 text-sm mt-1">Tap "+ Add Reward" to create some</p>
              </div>
            )}
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
      </div>
    </div>
  )
}
