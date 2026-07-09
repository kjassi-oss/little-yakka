'use client'

// First-run Home hero (no kids yet): a sleek auto-rotating tour of the four
// steps to get going, with an always-visible CTA into Settings. Vignettes
// reuse the same animated mini-UI style as the Settings guide.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import StarJar from '@/components/StarJar'

const tint = { backgroundColor: 'color-mix(in srgb, var(--theme-from) 10%, white)' }
const frame = 'relative w-full h-28 rounded-2xl overflow-hidden flex items-center justify-center'

function StepKids() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md px-4 py-2.5 flex items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#A29BFE33' }}>🦊</div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full border border-gray-200 flex items-center justify-center text-[10px] shadow demo-pulse">📷</div>
        </div>
        <div>
          <div className="h-2.5 w-16 rounded-full bg-gray-200 mb-1.5"/>
          <div className="h-2 w-10 rounded-full bg-gray-100"/>
        </div>
      </div>
    </div>
  )
}

function StepTasks() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md px-3.5 py-2.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 16%, white)' }}>🧹</div>
        <div>
          <div className="h-2.5 w-20 rounded-full bg-gray-200 mb-1.5"/>
          <p className="text-xs font-black text-yellow-500 leading-none">⭐ 5</p>
        </div>
      </div>
      <span className="absolute top-2 right-8 text-lg demo-float">⭐</span>
    </div>
  )
}

function StepRewards() {
  return (
    <div className={frame} style={tint}>
      <div className="flex items-center gap-2.5">
        <div className="flex gap-0.5 text-xl"><span>⭐</span><span>⭐</span><span>⭐</span></div>
        <span className="text-2xl text-gray-400 demo-tap">→</span>
        <div className="text-4xl demo-pulse">🎁</div>
      </div>
    </div>
  )
}

function StepGrow() {
  return (
    <div className={frame} style={tint}>
      <div className="flex items-center gap-4">
        <StarJar done={7} total={10} size={42}/>
        <div className="flex gap-1.5 text-xl">
          <span className="demo-pulse">🌟</span>
          <span className="demo-pulse" style={{ animationDelay: '0.3s' }}>🔥</span>
          <span className="demo-pulse" style={{ animationDelay: '0.6s' }}>🏆</span>
        </div>
      </div>
    </div>
  )
}

const STEPS: { title: string; body: string; V: () => React.ReactElement }[] = [
  { V: StepKids, title: 'Add your kids',
    body: 'Create a profile for each child in Settings — name, colour and a photo.' },
  { V: StepTasks, title: 'Create your tasks',
    body: 'Add the jobs you want done and give each one a ⭐ value.' },
  { V: StepRewards, title: 'Set up rewards',
    body: 'Decide what stars are worth — ice cream, movie night, pocket money…' },
  { V: StepGrow, title: 'Watch them grow',
    body: 'Your child builds positive lifelong habits — and has fun along the way.' },
]

export default function GetStartedHero() {
  const [i, setI] = useState(0)

  // Auto-rotate; tapping a dot pauses on that step for a while
  useEffect(() => {
    const t = setInterval(() => setI(prev => (prev + 1) % STEPS.length), 4000)
    return () => clearInterval(t)
  }, [])

  const step = STEPS[i]
  const V = step.V

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 text-center">
      <p className="text-2xl font-black leading-none mb-1" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Welcome to Little Yakka!
      </p>
      <p className="text-xs text-gray-400 mb-4">Four quick steps and you&rsquo;re away</p>

      <div key={i} className="fade-slide-up">
        <V/>
        <p className="font-black text-gray-800 mt-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[11px] font-black mr-1.5 align-[2px]" style={{ background: 'var(--theme-gradient)' }}>{i + 1}</span>
          {step.title}
        </p>
        <p className="text-sm text-gray-400 leading-snug mt-1 min-h-[40px]">{step.body}</p>
      </div>

      <div className="flex justify-center gap-1.5 mb-4">
        {STEPS.map((_, idx) => (
          <button key={idx} onClick={() => setI(idx)} aria-label={`Step ${idx + 1}`}
            className="w-2 h-2 rounded-full transition"
            style={{ background: idx === i ? 'var(--theme-from)' : '#e5e7eb' }}/>
        ))}
      </div>

      <Link href="/dashboard/settings"
        className="block w-full text-white font-black py-3.5 rounded-2xl shadow active:scale-95 transition"
        style={{ background: 'var(--theme-gradient)' }}>
        Add your first child →
      </Link>
    </div>
  )
}
