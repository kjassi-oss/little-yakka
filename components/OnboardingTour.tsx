'use client'

import { useEffect, useState } from 'react'

type DemoType = 'welcome' | 'kids' | 'tasks' | 'earn' | 'rewards' | 'done'

const SLIDES: { title: string; body: string; demo: DemoType }[] = [
  { demo: 'welcome', title: 'Welcome to Little Yakka!', body: 'Turn everyday chores into a fun, star-earning game for the whole family.' },
  { demo: 'kids',    title: 'Add your kids', body: 'In Settings, add each child — give them a colour and snap a photo right there.' },
  { demo: 'tasks',   title: 'Create tasks', body: 'Tap the big ＋ on the Tasks page to add a chore, set its stars, and assign it.' },
  { demo: 'earn',    title: 'Kids tap to earn', body: 'In Kid Mode, your child taps a task to tick it off — stars fly in instantly!' },
  { demo: 'rewards', title: 'Swap stars for rewards', body: 'Kids spend their stars on rewards you set up. You approve each request.' },
  { demo: 'done',    title: "You're all set!", body: 'Calendar shows what\'s coming up, and Stats tracks streaks & completion. Have fun!' },
]

function Demo({ type }: { type: DemoType }) {
  const frame = 'relative w-full h-28 rounded-2xl overflow-hidden flex items-center justify-center'
  const tint = { backgroundColor: 'color-mix(in srgb, var(--theme-from) 12%, white)' }

  if (type === 'welcome') {
    return (
      <div className={frame} style={tint}>
        <div className="text-6xl demo-pulse">⭐</div>
        <span className="absolute top-3 left-6 text-xl demo-float">✨</span>
        <span className="absolute bottom-3 right-7 text-xl demo-float" style={{ animationDelay: '0.6s' }}>🌟</span>
      </div>
    )
  }

  if (type === 'kids') {
    return (
      <div className={frame} style={tint}>
        <div className="bg-white rounded-2xl shadow-md px-4 py-3 flex items-center gap-3 demo-slide-in">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#A29BFE33' }}>🦊</div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full border border-gray-200 flex items-center justify-center text-xs shadow demo-pulse">📷</div>
          </div>
          <div>
            <div className="h-2.5 w-16 rounded-full bg-gray-200 mb-1.5"/>
            <div className="h-2 w-10 rounded-full bg-gray-100"/>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'tasks') {
    return (
      <div className={frame} style={tint}>
        <div className="bg-white rounded-2xl shadow-md p-2.5 flex flex-col items-center gap-1 w-20 demo-slide-in">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 16%, white)' }}>🧹</div>
          <div className="h-2 w-12 rounded-full bg-gray-200"/>
          <p className="text-[10px] font-black text-yellow-500">⭐ 3</p>
        </div>
        <div className="absolute bottom-3 right-3 w-11 h-11 rounded-full flex items-center justify-center text-white text-2xl shadow-lg demo-pulse"
          style={{ background: 'var(--theme-gradient)' }}>＋</div>
      </div>
    )
  }

  if (type === 'earn') {
    return (
      <div className={frame} style={tint}>
        <div className="bg-white rounded-2xl shadow-md px-3 py-2.5 flex items-center gap-3 w-[80%]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: '#74B9FF33' }}>🛏️</div>
          <div className="flex-1">
            <div className="h-2.5 w-20 rounded-full bg-gray-200 mb-1"/>
            <div className="h-2 w-10 rounded-full bg-gray-100"/>
          </div>
          <div className="relative w-8 h-8 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full demo-ripple" style={{ backgroundColor: 'var(--theme-from)' }}/>
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-black demo-check">✓</div>
          </div>
        </div>
        <span className="absolute top-2 right-10 text-lg font-black text-yellow-500 demo-float">+3 ⭐</span>
        <span className="absolute bottom-2 right-6 text-2xl demo-tap">👆</span>
      </div>
    )
  }

  if (type === 'rewards') {
    return (
      <div className={frame} style={tint}>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 text-xl">
            <span>⭐</span><span>⭐</span><span>⭐</span>
          </div>
          <span className="text-2xl text-gray-400 demo-tap">→</span>
          <div className="text-4xl demo-pulse">🎁</div>
        </div>
      </div>
    )
  }

  // done
  return (
    <div className={frame} style={tint}>
      <div className="text-5xl bounce-in">🎉</div>
      <span className="absolute top-3 left-7 text-xl demo-float">⭐</span>
      <span className="absolute top-5 right-8 text-xl demo-float" style={{ animationDelay: '0.5s' }}>🌈</span>
      <span className="absolute bottom-3 left-10 text-lg demo-float" style={{ animationDelay: '0.9s' }}>✨</span>
    </div>
  )
}

export default function OnboardingTour() {
  const [show, setShow] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    try { if (!localStorage.getItem('ly-onboarded')) setShow(true) } catch {}
  }, [])

  function finish() {
    try { localStorage.setItem('ly-onboarded', '1') } catch {}
    setShow(false)
  }

  if (!show) return null
  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-3xl p-5 w-full max-w-xs text-center pop-in">
        {/* Animated demo of the step */}
        <Demo key={i} type={slide.demo} />

        <h2 className="text-xl font-black text-gray-800 mt-4 mb-2">{slide.title}</h2>
        <p className="text-gray-500 text-sm mb-4 leading-snug">{slide.body}</p>

        <div className="flex justify-center gap-1.5 mb-4">
          {SLIDES.map((_, idx) => (
            <button key={idx} onClick={() => setI(idx)} aria-label={`Step ${idx + 1}`}
              className="w-2 h-2 rounded-full transition"
              style={{ background: idx === i ? 'var(--theme-from)' : '#e5e7eb' }}/>
          ))}
        </div>

        <div className="flex gap-2">
          {i > 0 && (
            <button onClick={() => setI(i - 1)}
              className="px-4 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold active:scale-95 transition">←</button>
          )}
          <button onClick={() => last ? finish() : setI(i + 1)}
            className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition"
            style={{ background: 'var(--theme-gradient)' }}>
            {last ? "Let's go! 🚀" : 'Next →'}
          </button>
        </div>
        {!last && <button onClick={finish} className="text-gray-400 text-sm font-semibold mt-2">Skip</button>}
      </div>
    </div>
  )
}
