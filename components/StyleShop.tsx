'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HATS, FRAMES } from '@/lib/styleShop'
import DecoratedAvatar from '@/components/DecoratedAvatar'
import { redeemFeedback } from '@/lib/feedback'

interface ChildLike {
  id: string; name: string; avatar: string; avatar_url?: string | null; colour: string
}

// Kid-zone style shop: spend stars on hats + frames for your avatar.
export default function StyleShop({ child, starBalance, unlocked, equippedHat, equippedFrame, onSpend, onEquip, onClose }: {
  child: ChildLike
  starBalance: number
  unlocked: Set<string>
  equippedHat: string | null
  equippedFrame: string | null
  onSpend: (cost: number) => void
  onEquip: (kind: 'hat' | 'frame', id: string | null) => void
  onClose: () => void
}) {
  const [owned, setOwned] = useState(unlocked)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function buy(kind: 'hat' | 'frame', id: string, name: string, cost: number) {
    if (busy || starBalance < cost) return
    setBusy(id); setError('')
    const supabase = createClient()
    const { error: unlockErr } = await supabase.from('child_unlocks').insert({ child_id: child.id, item_id: id })
    if (unlockErr) { setError('Shop is being restocked — try again later!'); setBusy(null); return }
    await supabase.from('star_ledger').insert({
      child_id: child.id, delta: -cost, reason: `Style shop: ${name}`, source_type: 'redemption',
    })
    redeemFeedback()
    setOwned(prev => new Set([...prev, id]))
    onSpend(cost)
    await equip(kind, id)
    setBusy(null)
  }

  async function equip(kind: 'hat' | 'frame', id: string | null) {
    const supabase = createClient()
    const patch = kind === 'hat' ? { equipped_hat: id } : { equipped_frame: id }
    await supabase.from('children').update(patch).eq('id', child.id)
    onEquip(kind, id)
  }

  const previewChild = { ...child, equipped_hat: equippedHat, equipped_frame: equippedFrame }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4"/>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black text-gray-800">✨ Style Shop</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl font-bold w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {/* Preview + balance */}
        <div className="flex items-center gap-4 mb-4">
          <div className="pt-4"><DecoratedAvatar child={previewChild} size={72}/></div>
          <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-full px-4 py-2">
            <span className="text-yellow-400 text-xl">⭐</span>
            <span className="font-black text-gray-700">{starBalance} stars</span>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 rounded-2xl p-3 mb-3">{error}</p>}

        {/* Hats */}
        <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">Hats</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {HATS.map(h => {
            const isOwned = owned.has(h.id)
            const isWorn = equippedHat === h.id
            const canAfford = starBalance >= h.cost
            return (
              <div key={h.id} className={`rounded-2xl border-2 p-2 flex flex-col items-center gap-1 ${isWorn ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-white'}`}>
                <span className="text-3xl">{h.emoji}</span>
                <p className="text-[10px] font-bold text-gray-600 text-center leading-tight">{h.name}</p>
                {isOwned ? (
                  <button onClick={() => equip('hat', isWorn ? null : h.id)}
                    className={`w-full text-[10px] font-black py-1 rounded-lg active:scale-95 transition ${isWorn ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                    {isWorn ? 'WEARING ✓' : 'WEAR'}
                  </button>
                ) : (
                  <button onClick={() => buy('hat', h.id, h.name, h.cost)} disabled={!canAfford || !!busy}
                    className={`w-full text-[10px] font-black py-1 rounded-lg active:scale-95 transition text-white disabled:opacity-40`}
                    style={{ background: 'var(--theme-gradient)' }}>
                    {busy === h.id ? '…' : `⭐ ${h.cost}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Frames */}
        <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">Frames</p>
        <div className="grid grid-cols-3 gap-2 pb-4">
          {FRAMES.map(f => {
            const isOwned = owned.has(f.id)
            const isWorn = equippedFrame === f.id
            const canAfford = starBalance >= f.cost
            return (
              <div key={f.id} className={`rounded-2xl border-2 p-2 flex flex-col items-center gap-1 ${isWorn ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-white'}`}>
                <span className="w-9 h-9 rounded-full" style={{ background: f.bg, padding: 3 }}>
                  <span className="block w-full h-full rounded-full bg-white"/>
                </span>
                <p className="text-[10px] font-bold text-gray-600 text-center leading-tight">{f.name}</p>
                {isOwned ? (
                  <button onClick={() => equip('frame', isWorn ? null : f.id)}
                    className={`w-full text-[10px] font-black py-1 rounded-lg active:scale-95 transition ${isWorn ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                    {isWorn ? 'WEARING ✓' : 'WEAR'}
                  </button>
                ) : (
                  <button onClick={() => buy('frame', f.id, f.name, f.cost)} disabled={!canAfford || !!busy}
                    className={`w-full text-[10px] font-black py-1 rounded-lg active:scale-95 transition text-white disabled:opacity-40`}
                    style={{ background: 'var(--theme-gradient)' }}>
                    {busy === f.id ? '…' : `⭐ ${f.cost}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
