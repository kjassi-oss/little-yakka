'use client'

import { useMemo, useState } from 'react'

const SEGMENT_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']

const N = 6
const ANGLE = 360 / N
const R = 135
const CX = 160
const CY = 160

// Night-carnival colours: a fixed pure-white band up top (the logo sits on it,
// notch-safe on any phone height) fading into the brand indigo sky just below,
// then the logo's star yellow. Pixel stops for the top so the white band always
// clears the logo regardless of screen height.
const SKY = 'linear-gradient(180deg, #ffffff 0px, #ffffff 190px, #334487 275px, #232a5c 55%, #5b4a9e 100%)'
const GOLD = '#FDE047'
const GOLD_TEXT = '#412402'

// Twinkling starfield packed around the edges so nothing overlaps the wheel
// (none in the top white band, where they'd be invisible).
const STARS = [
  { top: '20%', left: '9%', size: 13, c: '#fff' },
  { top: '35%', left: '3%', size: 16, c: '#fff' }, { top: '52%', left: '8%', size: 12, c: GOLD },
  { top: '68%', left: '4%', size: 18, c: '#fff' }, { top: '84%', left: '8%', size: 14, c: GOLD },
  { top: '93%', left: '3%', size: 11, c: '#fff' },
  { top: '26%', left: '91%', size: 17, c: '#fff' }, { top: '22%', left: '94%', size: 12, c: GOLD },
  { top: '37%', left: '90%', size: 19, c: GOLD },  { top: '53%', left: '95%', size: 12, c: '#fff' },
  { top: '69%', left: '90%', size: 15, c: '#fff' },{ top: '84%', left: '93%', size: 17, c: GOLD },
  { top: '93%', left: '89%', size: 11, c: '#fff' },
  { top: '93%', left: '30%', size: 13, c: GOLD },  { top: '94%', left: '64%', size: 12, c: '#fff' },
  { top: '90%', left: '50%', size: 10, c: '#fff' },
]

const CONFETTI_COLOURS = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#EC4899', '#F97316', '#14B8A6', '#FFFFFF']

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
  childName?: string
  maxPrize: number
  onWin: (stars: number) => void
  onClose: () => void
}

export default function SpinWheel({ childColour, childAvatar, childAvatarUrl, childName, maxPrize, onWin, onClose }: Props) {
  const PRIZES = useMemo(() => buildPrizes(maxPrize), [maxPrize])
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ stars: number; label: string; color: string } | null>(null)

  // Confetti burst once the wheel lands (extra pieces for a jackpot)
  const confetti = useMemo(() => {
    if (!result) return []
    const jackpot = result.stars === maxPrize && maxPrize > 5
    return Array.from({ length: jackpot ? 60 : 36 }, (_, i) => ({
      key: i, left: Math.random() * 100, bg: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
      dur: 1.2 + Math.random() * 1.4, delay: Math.random() * 0.3, rot: Math.random() * 360,
    }))
  }, [result, maxPrize])

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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start px-6 pb-10 overflow-y-auto"
      style={{ background: SKY, paddingTop: 'calc(env(safe-area-inset-top) + 3rem)' }}>
      {/* Twinkling starfield */}
      {STARS.map((s, i) => (
        <span key={i} className="absolute pointer-events-none select-none twinkle leading-none"
          style={{ top: s.top, left: s.left, fontSize: s.size, color: s.c, animationDelay: `${(i % 7) * 0.35}s` }}>✦</span>
      ))}

      {/* Confetti when the wheel lands */}
      {result && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {confetti.map(p => (
            <span key={p.key} className="confetti-piece"
              style={{ left: `${p.left}%`, backgroundColor: p.bg, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }}/>
          ))}
        </div>
      )}

      {/* Close — sits in the white band, so dark on light; clear of the notch */}
      <button onClick={onClose}
        className="absolute right-4 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xl font-bold active:scale-90 transition z-10"
        style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        ×
      </button>

      {/* Header — logo up top on pure white; the sky fade starts just below it */}
      <div className="text-center mb-5 relative z-10">
        <img src="/logo.png" alt="Little Yakka" className="h-20 w-auto mx-auto mb-6"/>
        <h2 className="text-4xl font-black leading-none" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', color: GOLD, textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
          {childName ? (<><span className="name-flash">{childName}</span>{"'s Bonus Spin"}</>) : 'Bonus Spin'}
        </h2>
        <p className="text-base mt-1" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', color: '#e3e7ff', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>Spin to win bonus stars!</p>
        <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ background: GOLD, color: GOLD_TEXT }}>
          Max prize: ⭐ {maxPrize}
        </div>
      </div>

      <div className="relative mb-6 z-10">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 z-20" style={{ transform: 'translateX(-50%) translateY(-10px)' }}>
          <div className="w-0 h-0"
            style={{ borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: `24px solid ${GOLD}`, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}/>
        </div>

        {/* Wheel SVG */}
        <svg width="320" height="320" viewBox="0 0 320 320"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 1.0)' : 'none',
            transformOrigin: '160px 160px',
            filter: 'drop-shadow(0 0 26px rgba(253,224,71,0.45))',
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
          {/* Chasing marquee bulbs — they spin with the wheel and blink */}
          {Array.from({ length: 18 }, (_, i) => {
            const [lx, ly] = toXY(i * 20, R + 12)
            return <circle key={`l${i}`} cx={lx} cy={ly} r="4.5"
              fill={i % 2 === 0 ? GOLD : '#FFFFFF'}
              style={{ animation: `bulbBlink 1s ease-in-out ${(i % 3) * 0.33}s infinite` }}/>
          })}
        </svg>

        {/* Centre — child photo / avatar in a gold circle frame (does not spin) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          {childAvatarUrl
            ? <img src={childAvatarUrl} className="w-[72px] h-[72px] rounded-full object-cover shadow-lg" style={{ border: `4px solid ${GOLD}` }} alt=""/>
            : <div className="w-[72px] h-[72px] rounded-full shadow-lg flex items-center justify-center text-[46px] leading-none overflow-hidden bg-white"
                style={{ border: `4px solid ${GOLD}` }}>{childAvatar}</div>}
        </div>

        {/* Outer ring — dark navy rim so the wheel pops off the sky */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: '0 0 0 4px #1d2450' }}/>
      </div>

      {!result ? (
        <button onClick={spin} disabled={spinning}
          className={`font-black text-xl py-5 px-16 rounded-3xl shadow-lg active:scale-95 transition disabled:opacity-70 relative z-10 ${spinning ? 'text-white' : 'demo-pulse'}`}
          style={{ background: spinning ? '#4a5399' : GOLD, color: spinning ? '#fff' : GOLD_TEXT }}>
          {spinning ? '🌀 Spinning...' : '🎯 SPIN!'}
        </button>
      ) : (
        <div className="text-center pop-in relative z-10">
          <div className="text-7xl mb-3">{isJackpot ? '🏆' : '🎉'}</div>
          <p className="text-lg" style={{ color: '#c7cdf0' }}>You won</p>
          <p className="font-black text-5xl my-1" style={{ color: GOLD }}>+{result.stars} ⭐</p>
          {isJackpot && <p className="font-bold text-lg mb-2" style={{ color: GOLD }}>JACKPOT!! 🎊</p>}
          <button onClick={onClose}
            className="mt-4 font-black text-lg py-4 px-10 rounded-3xl active:scale-95 transition shadow-lg"
            style={{ background: GOLD, color: GOLD_TEXT }}>
            Awesome! 🚀
          </button>
        </div>
      )}
    </div>
  )
}
