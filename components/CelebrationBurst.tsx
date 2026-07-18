'use client'

import { useEffect } from 'react'

// Full-screen confetti + a pop card. Mount it to celebrate; it auto-dismisses.
export default function CelebrationBurst({
  colour = '#EC4899', emoji, photo, avatar, title = 'Nice one! 🎉', sub,
  onDone, duration = 1900,
}: {
  colour?: string
  emoji?: string
  photo?: string | null
  avatar?: string
  title?: string
  sub?: string
  onDone: () => void
  duration?: number
}) {
  useEffect(() => {
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
  }, [onDone, duration])

  const colors = ['#F35C77', '#F6B11F', '#4BB543', '#28BCE6', '#8B51D1', '#1976D2', colour]
  const pieces = Array.from({ length: 34 }, (_, i) => ({
    left: Math.random() * 100, bg: colors[i % colors.length],
    dur: 1.0 + Math.random() * 1.0, delay: Math.random() * 0.2, rot: Math.random() * 360,
  }))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden" onClick={onDone}>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece"
          style={{ left: `${p.left}%`, backgroundColor: p.bg, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }}/>
      ))}
      <div className="claim-pop bg-white rounded-3xl px-8 py-6 shadow-2xl text-center max-w-[80%]">
        {photo ? (
          <div className="relative w-24 h-24 mx-auto mb-2">
            <img src={photo} className="w-24 h-24 rounded-2xl object-cover" style={{ border: `3px solid ${colour}` }} alt=""/>
            {emoji && <span className="absolute -bottom-2 -right-2 text-3xl drop-shadow">{emoji}</span>}
          </div>
        ) : (
          <div className="text-6xl mb-1">{avatar || emoji || '🎉'}</div>
        )}
        <p className="text-2xl font-black" style={{ color: colour }}>{title}</p>
        {sub && <p className="text-sm font-bold text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}
