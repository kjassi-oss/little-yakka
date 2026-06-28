'use client'

import { useMemo, useState } from 'react'

const SEGMENT_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']

const N = 6
const ANGLE = 360 / N
const R = 120
const CX = 150
const CY = 150

function toXY(deg: number, r: number): [number, number] {
  const rad = (deg - 90) * Math.PI / 180
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
}

function sectorPath(i: number): string {
  const a1 = i * ANGLE, a2 = (i + 1) * ANGLE
  const [x1, y1] = toXY(a1, R)
  const [x2, y2] = toXY(a2, R)
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`
}

// Build 6 prize slots scaled to maxPrize.
// Tier tiers defined by the completion % passed from server:
//   0% done    → maxPrize 1  → prizes mostly 0 with one 1
//   1–50%      → maxPrize = 25% of week total
//   50–80%     → maxPrize = 45% of week total
//   >80%/100%  → maxPrize = 100% of week total
function buildPrizes(maxPrize: number) {
  if (maxPrize <= 1) {
    return [
      { stars: 0, label: '+0', color: SEGMENT_COLORS[0] },
      { stars: 1, label: '+1', color: SEGMENT_COLORS[1] },
      { stars: 0, label: '+0', color: SEGMENT_COLORS[2] },
      { stars: 0, label: '+0', color: SEGMENT_COLORS[3] },
      { stars: 1, label: '+1', color: SEGMENT_COLORS[4] },
      { stars: 0, label: '+0', color: SEGMENT_COLORS[5] },
    ]
  }
  const slots = [
    Math.max(1, Math.round(maxPrize * 0.1)),
    Math.max(1, Math.round(maxPrize * 0.2)),
    Math.max(2, Math.round(maxPrize * 0.35)),
    Math.max(2, Math.round(maxPrize * 0.5)),
    Math.max(3, Math.round(maxPrize * 0.7)),
    maxPrize,
  ]
  // Shuffle so jackpot isn't always in same spot
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]]
  }
  return slots.map((stars, i) => ({
    stars,
    label: stars === maxPrize ? '🏆' : `+${stars}`,
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }))
}

interface Props {
  childColour: string
  maxPrize: number
  onWin: (stars: number) => void
  onClose: () => void
}

export default function SpinWheel({ childColour, maxPrize, onWin, onClose }: Props) {
  const PRIZES = useMemo(() => buildPrizes(maxPrize), [maxPrize])
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ stars: number; label: string; color: string } | null>(null)

  function spin() {
    if (spinning || result) return
    setSpinning(true)
    const idx = Math.floor(Math.random() * N)
    const target = rotation + 6 * 360 - (idx + 0.5) * ANGLE
    setRotation(target)
    setTimeout(() => {
      setSpinning(false)
      setResult(PRIZES[idx])
      onWin(PRIZES[idx].stars)
    }, 4500)
  }

  const isJackpot = result !== null && result.stars === maxPrize && maxPrize > 5

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-white overflow-y-auto">
      {/* Close */}
      <button onClick={onClose}
        className="absolute top-12 right-4 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xl font-bold active:scale-90 transition">
        ×
      </button>

      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-4xl mb-2">🎰</p>
        <h2 className="text-3xl font-black text-gray-800">Bonus Spin!</h2>
        <p className="text-gray-400 text-sm mt-1">Spin to win bonus stars!</p>
        <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-xs font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${childColour}, #EC4899)` }}>
          Max prize: ⭐ {maxPrize}
        </div>
      </div>

      <div className="relative mb-6">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 z-10" style={{ transform: 'translateX(-50%) translateY(-10px)' }}>
          <div className="w-0 h-0"
            style={{ borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '24px solid #1F2937' }}/>
        </div>

        {/* Wheel SVG */}
        <svg width="300" height="300" viewBox="0 0 300 300"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 1.0)' : 'none',
            transformOrigin: '150px 150px',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.12))',
          }}>
          {PRIZES.map((prize, i) => {
            const mid = (i + 0.5) * ANGLE
            const [tx, ty] = toXY(mid, R * 0.63)
            const [sx, sy] = toXY(mid, R * 0.82)
            return (
              <g key={i}>
                <path d={sectorPath(i)} fill={prize.color} stroke="white" strokeWidth="2.5"/>
                <text x={sx} y={sy} textAnchor="middle" dominantBaseline="central" fontSize="14"
                  transform={`rotate(${mid}, ${sx}, ${sy})`}>⭐</text>
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central"
                  fill="white" fontWeight="900" fontSize="15"
                  transform={`rotate(${mid}, ${tx}, ${ty})`}>{prize.label}</text>
              </g>
            )
          })}
          <circle cx={CX} cy={CY} r="22" fill="white" opacity="0.95"/>
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontSize="20">⭐</text>
        </svg>

        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: '0 0 0 3px #E5E7EB' }}/>
      </div>

      {!result ? (
        <button onClick={spin} disabled={spinning}
          className="font-black text-xl py-5 px-16 rounded-3xl shadow-lg active:scale-95 transition disabled:opacity-50 text-white"
          style={{ background: spinning ? '#9CA3AF' : `linear-gradient(135deg, ${childColour}, #EC4899)` }}>
          {spinning ? '🌀 Spinning...' : '🎯 SPIN!'}
        </button>
      ) : (
        <div className="text-center pop-in">
          <div className="text-7xl mb-3">{isJackpot ? '🏆' : '🎉'}</div>
          <p className="text-gray-500 text-lg">You won</p>
          <p className="font-black text-5xl my-1" style={{ color: childColour }}>+{result.stars} ⭐</p>
          {isJackpot && <p className="font-bold text-lg mb-2" style={{ color: childColour }}>JACKPOT!! 🎊</p>}
          <button onClick={onClose}
            className="mt-4 font-black text-lg py-4 px-10 rounded-3xl active:scale-95 transition shadow-lg text-white"
            style={{ background: `linear-gradient(135deg, ${childColour}, #EC4899)` }}>
            Awesome! 🚀
          </button>
        </div>
      )}
    </div>
  )
}
