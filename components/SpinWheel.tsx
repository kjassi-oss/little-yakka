'use client'

import { useState } from 'react'

const PRIZES = [
  { stars: 2,  label: '+2', color: '#8B5CF6' },
  { stars: 1,  label: '+1', color: '#EC4899' },
  { stars: 5,  label: '+5', color: '#F59E0B' },
  { stars: 1,  label: '+1', color: '#10B981' },
  { stars: 3,  label: '+3', color: '#3B82F6' },
  { stars: 20, label: '🏆', color: '#EF4444' },
]

const N = PRIZES.length
const ANGLE = 360 / N
const R = 120
const CX = 150
const CY = 150

function toXY(wheelDeg: number, r: number) {
  const rad = (wheelDeg - 90) * Math.PI / 180
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
}

function sectorPath(i: number) {
  const a1 = i * ANGLE, a2 = (i + 1) * ANGLE
  const [x1, y1] = toXY(a1, R)
  const [x2, y2] = toXY(a2, R)
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`
}

interface Props {
  childColour: string
  onWin: (stars: number) => void
  onClose: () => void
}

export default function SpinWheel({ childColour, onWin, onClose }: Props) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<typeof PRIZES[0] | null>(null)

  function spin() {
    if (spinning || result) return
    setSpinning(true)
    const idx = Math.floor(Math.random() * N)
    // Rotate so segment idx's midpoint lands under the top pointer
    const target = rotation + 6 * 360 - (idx + 0.5) * ANGLE
    setRotation(target)
    setTimeout(() => {
      setSpinning(false)
      setResult(PRIZES[idx])
      onWin(PRIZES[idx].stars)
    }, 4500)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.92), rgba(0,0,0,0.97))' }}>

      <div className="text-4xl mb-1">🎰</div>
      <h2 className="text-3xl font-black text-white mb-1">Bonus Spin!</h2>
      <p className="text-white/60 text-sm mb-8">You finished everything — spin for bonus stars!</p>

      <div className="relative">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 z-10" style={{ transform: 'translateX(-50%) translateY(-10px)' }}>
          <div className="w-0 h-0"
            style={{ borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '24px solid white' }}/>
        </div>

        {/* Wheel */}
        <svg width="300" height="300" viewBox="0 0 300 300"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 1.0)' : 'none',
            transformOrigin: '150px 150px',
          }}>
          {PRIZES.map((prize, i) => {
            const mid = (i + 0.5) * ANGLE
            const [tx, ty] = toXY(mid, R * 0.63)
            return (
              <g key={i}>
                <path d={sectorPath(i)} fill={prize.color} stroke="white" strokeWidth="2.5"/>
                {/* Star emoji */}
                <text x={toXY(mid, R * 0.82)[0]} y={toXY(mid, R * 0.82)[1]}
                  textAnchor="middle" dominantBaseline="central" fontSize="14"
                  transform={`rotate(${mid}, ${toXY(mid, R * 0.82)[0]}, ${toXY(mid, R * 0.82)[1]})`}>
                  ⭐
                </text>
                {/* Amount */}
                <text x={tx} y={ty}
                  textAnchor="middle" dominantBaseline="central"
                  fill="white" fontWeight="900" fontSize="15"
                  transform={`rotate(${mid}, ${tx}, ${ty})`}>
                  {prize.label}
                </text>
              </g>
            )
          })}
          {/* Centre hub */}
          <circle cx={CX} cy={CY} r="22" fill="white" opacity="0.95"/>
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontSize="20">⭐</text>
        </svg>

        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: '0 0 40px rgba(255,255,255,0.15), inset 0 0 0 3px white' }}/>
      </div>

      {!result ? (
        <button onClick={spin} disabled={spinning}
          className="mt-10 font-black text-xl py-5 px-16 rounded-3xl shadow-2xl active:scale-95 transition disabled:opacity-50"
          style={{
            background: spinning ? '#4B5563' : `linear-gradient(135deg, ${childColour}, #EC4899)`,
            color: 'white',
          }}>
          {spinning ? '🌀 Spinning...' : '🎯  SPIN!'}
        </button>
      ) : (
        <div className="mt-10 text-center pop-in">
          <div className="text-7xl mb-3">{result.stars === 20 ? '🏆' : '🎉'}</div>
          <p className="text-white/80 text-lg">You won</p>
          <p className="text-yellow-300 font-black text-5xl my-1">+{result.stars} ⭐</p>
          {result.stars === 20 && <p className="text-yellow-300 font-bold mb-2">JACKPOT!!</p>}
          <button onClick={onClose}
            className="mt-4 bg-white font-black text-gray-800 text-lg py-4 px-10 rounded-3xl active:scale-95 transition shadow-xl">
            Awesome! 🚀
          </button>
        </div>
      )}
    </div>
  )
}
