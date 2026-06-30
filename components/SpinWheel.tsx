'use client'

import { useMemo, useState } from 'react'

const SEGMENT_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']

const N = 6
const ANGLE = 360 / N
const R = 135
const CX = 160
const CY = 160

// Faint background decoration — task & reward icons, varied size/rotation
const DECOR = [
  { e: '🧹', top: '8%', left: '8%', size: 46, rot: -18 },
  { e: '🎁', top: '14%', left: '78%', size: 54, rot: 14 },
  { e: '📚', top: '70%', left: '6%', size: 50, rot: 10 },
  { e: '🍦', top: '78%', left: '82%', size: 44, rot: -12 },
  { e: '⭐', top: '40%', left: '2%', size: 38, rot: 8 },
  { e: '🪥', top: '4%', left: '46%', size: 36, rot: 20 },
  { e: '🎮', top: '88%', left: '44%', size: 42, rot: -8 },
  { e: '🚗', top: '46%', left: '88%', size: 40, rot: 16 },
]

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
  childAvatar: string
  childAvatarUrl?: string
  maxPrize: number
  onWin: (stars: number) => void
  onClose: () => void
}

export default function SpinWheel({ childColour, childAvatar, childAvatarUrl, maxPrize, onWin, onClose }: Props) {
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
      {/* Faint task/reward decoration */}
      {DECOR.map((d, i) => (
        <span key={i} className="absolute pointer-events-none select-none opacity-[0.08]"
          style={{ top: d.top, left: d.left, fontSize: d.size, transform: `rotate(${d.rot}deg)` }}>{d.e}</span>
      ))}

      {/* Close */}
      <button onClick={onClose}
        className="absolute top-12 right-4 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xl font-bold active:scale-90 transition z-10">
        ×
      </button>

      {/* Header */}
      <div className="text-center mb-5 relative z-10">
        <h2 className="text-4xl font-black leading-none" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Bonus Spin
        </h2>
        <p className="text-gray-400 text-base mt-1" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Spin to win bonus stars!</p>
        <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-xs font-bold text-white"
          style={{ background: 'var(--theme-gradient)' }}>
          Max prize: ⭐ {maxPrize}
        </div>
      </div>

      <div className="relative mb-6 z-10">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 z-20" style={{ transform: 'translateX(-50%) translateY(-10px)' }}>
          <div className="w-0 h-0"
            style={{ borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '24px solid #1F2937' }}/>
        </div>

        {/* Wheel SVG */}
        <svg width="320" height="320" viewBox="0 0 320 320"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 1.0)' : 'none',
            transformOrigin: '160px 160px',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.12))',
          }}>
          {PRIZES.map((prize, i) => {
            const mid = (i + 0.5) * ANGLE
            const [tx, ty] = toXY(mid, R * 0.63)
            const [sx, sy] = toXY(mid, R * 0.82)
            return (
              <g key={i}>
                <path d={sectorPath(i)} fill={prize.color} stroke="white" strokeWidth="2.5"/>
                <text x={sx} y={sy} textAnchor="middle" dominantBaseline="central" fontSize="15"
                  transform={`rotate(${mid}, ${sx}, ${sy})`}>⭐</text>
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central"
                  fill="white" fontWeight="900" fontSize="16"
                  transform={`rotate(${mid}, ${tx}, ${ty})`}>{prize.label}</text>
              </g>
            )
          })}
        </svg>

        {/* Centre — child photo / avatar in a circle frame (does not spin) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          {childAvatarUrl
            ? <img src={childAvatarUrl} className="w-[72px] h-[72px] rounded-full object-cover border-4 border-white shadow-lg" alt=""/>
            : <div className="w-[72px] h-[72px] rounded-full border-4 border-white shadow-lg flex items-center justify-center text-4xl"
                style={{ backgroundColor: childColour + '33' }}>{childAvatar}</div>}
        </div>

        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: '0 0 0 3px #E5E7EB' }}/>
      </div>

      {!result ? (
        <button onClick={spin} disabled={spinning}
          className="font-black text-xl py-5 px-16 rounded-3xl shadow-lg active:scale-95 transition disabled:opacity-50 text-white relative z-10"
          style={{ background: spinning ? '#9CA3AF' : 'var(--theme-gradient)' }}>
          {spinning ? '🌀 Spinning...' : '🎯 SPIN!'}
        </button>
      ) : (
        <div className="text-center pop-in relative z-10">
          <div className="text-7xl mb-3">{isJackpot ? '🏆' : '🎉'}</div>
          <p className="text-gray-500 text-lg">You won</p>
          <p className="font-black text-5xl my-1" style={{ color: childColour }}>+{result.stars} ⭐</p>
          {isJackpot && <p className="font-bold text-lg mb-2" style={{ color: childColour }}>JACKPOT!! 🎊</p>}
          <button onClick={onClose}
            className="mt-4 font-black text-lg py-4 px-10 rounded-3xl active:scale-95 transition shadow-lg text-white"
            style={{ background: 'var(--theme-gradient)' }}>
            Awesome! 🚀
          </button>
        </div>
      )}
    </div>
  )
}
