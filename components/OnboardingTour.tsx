'use client'

import { useEffect, useState } from 'react'

const SLIDES = [
  { emoji: '👋', title: 'Welcome to Little Yakka!', body: 'Turn everyday chores into a fun, star-earning game the whole family can enjoy.' },
  { emoji: '👶', title: 'Add your kids', body: 'Head to Settings (top-right profile) to add each child, with a photo if you like.' },
  { emoji: '📋', title: 'Create tasks', body: 'Tap the big + on the Tasks page to add chores & routines, set their star value, and assign them.' },
  { emoji: '⭐', title: 'Kids earn stars', body: 'Tap the ⭐ Kid Mode button (top-right) so your child can tick off tasks and collect stars.' },
  { emoji: '🎁', title: 'Swap stars for rewards', body: 'Set up rewards in the Rewards tab. Kids spend stars, you approve each request.' },
  { emoji: '📊', title: "You're all set!", body: 'Calendar shows what\'s coming up and Stats tracks streaks & completion. Have fun!' },
]

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
      <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center pop-in">
        <div className="text-6xl mb-3">{slide.emoji}</div>
        <h2 className="text-xl font-black text-gray-800 mb-2">{slide.title}</h2>
        <p className="text-gray-500 text-sm mb-5 leading-snug">{slide.body}</p>

        <div className="flex justify-center gap-1.5 mb-5">
          {SLIDES.map((_, idx) => (
            <div key={idx} className="w-2 h-2 rounded-full transition" style={{ background: idx === i ? 'var(--theme-from)' : '#e5e7eb' }}/>
          ))}
        </div>

        <button onClick={() => last ? finish() : setI(i + 1)}
          className="w-full text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition mb-2"
          style={{ background: 'var(--theme-gradient)' }}>
          {last ? "Let's go! 🚀" : 'Next →'}
        </button>
        {!last && <button onClick={finish} className="text-gray-400 text-sm font-semibold">Skip</button>}
      </div>
    </div>
  )
}
