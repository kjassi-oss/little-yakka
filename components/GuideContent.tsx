'use client'

import StarJar from '@/components/StarJar'

// "How Little Yakka Works" — comprehensive illustrated guide rendered inside
// Settings. Each section pairs an animated mini-UI vignette (same demo-*
// animation classes as the onboarding tour) with a fuller explanation.

const tint = { backgroundColor: 'color-mix(in srgb, var(--theme-from) 10%, white)' }
const frame = 'relative w-full h-24 rounded-2xl overflow-hidden flex items-center justify-center'

function VignetteKids() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md px-4 py-2.5 flex items-center gap-3 fade-slide-up">
        <div className="relative">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#A29BFE33' }}>🦊</div>
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

function VignetteTasks() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md p-2.5 flex flex-col items-center gap-1 w-20 fade-slide-up">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 16%, white)' }}>🧹</div>
        <div className="h-2 w-12 rounded-full bg-gray-200"/>
        <p className="text-[10px] font-black text-yellow-500">⭐ 3</p>
      </div>
      <div className="absolute bottom-2.5 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl shadow-lg demo-pulse"
        style={{ background: 'var(--theme-gradient)' }}>＋</div>
    </div>
  )
}

function VignetteUFG() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl px-4 py-2.5 flex items-center gap-3 fade-slide-up">
        <span className="text-2xl">🙌</span>
        <div>
          <p className="text-xs font-black text-amber-700">Up For Grabs</p>
          <p className="text-[10px] text-amber-600">First one done wins the stars!</p>
        </div>
      </div>
    </div>
  )
}

function VignetteEarn() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md px-3 py-2.5 flex items-center gap-3 w-[82%]">
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
      <span className="absolute top-1.5 right-9 text-base font-black text-yellow-500 demo-float">+3 ⭐</span>
    </div>
  )
}

function VignetteJar() {
  return (
    <div className={frame} style={tint}>
      <div className="flex items-center gap-5">
        <StarJar done={7} total={10} size={40}/>
        <div className="flex gap-1.5 text-xl">
          <span className="demo-pulse">🌟</span>
          <span className="demo-pulse" style={{ animationDelay: '0.3s' }}>🔥</span>
          <span className="grayscale opacity-40">👑</span>
          <span className="grayscale opacity-40">💎</span>
        </div>
      </div>
    </div>
  )
}

function VignetteRewards() {
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

function VignetteWheel() {
  return (
    <div className={frame} style={tint}>
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-white shadow-md animate-[spin_7s_linear_infinite]"
          style={{ background: 'conic-gradient(#8B5CF6 0 60deg, #EC4899 60deg 120deg, #F59E0B 120deg 180deg, #10B981 180deg 240deg, #3B82F6 240deg 300deg, #EF4444 300deg 360deg)' }}/>
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0"
          style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '9px solid #1F2937' }}/>
      </div>
      <span className="absolute bottom-2 right-8 text-base font-black text-yellow-500 demo-float">+8 ⭐</span>
    </div>
  )
}

function VignetteStreak() {
  return (
    <div className={frame} style={tint}>
      <div className="flex items-center gap-2">
        <span className="text-3xl demo-pulse">🔥</span>
        <div className="flex gap-1">
          {[1, 1, 1, 1, 1, 0, 0].map((on, i) => (
            <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${on ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
              {on ? '✓' : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function VignetteSummary() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md px-4 py-2.5 flex items-end gap-1.5 fade-slide-up">
        {[10, 16, 8, 20, 14].map((h, i) => (
          <div key={i} className="w-3.5 rounded-t-md" style={{ height: h * 2, background: 'var(--theme-gradient)', opacity: 0.5 + i * 0.12 }}/>
        ))}
        <span className="text-lg ml-1">🏆</span>
      </div>
    </div>
  )
}

const SECTIONS: { title: string; body: string; V: () => React.ReactElement }[] = [
  { V: VignetteKids, title: '1 · Add your kids',
    body: 'In Settings → Children, add each child with a name, colour and photo (or a fun avatar). Tap a child anytime to edit them, set a savings goal, or adjust their stars.' },
  { V: VignetteTasks, title: '2 · Create tasks',
    body: 'Tap ＋ on the Tasks page. Pick from 20 ready-made templates or write your own, choose an icon, set how often (daily, weekly, monthly — and which days), what time of day, and how many stars it earns. Assign it to one child, several, or everyone.' },
  { V: VignetteUFG, title: '3 · Up For Grabs',
    body: 'Toggle a task to Up For Grabs and it becomes a bounty — nobody owns it, and the first child to finish it wins the stars. Great for one-off jobs!' },
  { V: VignetteEarn, title: '4 · Kids tick things off',
    body: 'From Home, tap a child\'s tile to open their Kids Zone. They tap DONE on a task, get a celebration, and the stars land instantly. Parents can undo a tick by tapping it. Tasks can Carry Over (done up to 3 days late) or be Done Early if you allow it.' },
  { V: VignetteJar, title: '5 · The lolly jar & trophies',
    body: 'Each child has a lolly jar that fills as the week\'s tasks get done, plus 12 trophies to unlock — from the first star all the way to a 30-day streak. Tap any trophy to see how to earn it.' },
  { V: VignetteRewards, title: '6 · Spend stars on rewards',
    body: 'Create rewards on the Rewards page (ice cream, movie night, pocket money…) with a star price and who can redeem them. Kids redeem from their zone via Spend Stars; every redemption shows in My Rewards and the parents\' Redeemed tab — undo anytime.' },
  { V: VignetteWheel, title: '7 · The Bonus Wheel',
    body: 'Once a week (or month — configure below) each child gets a prize-wheel spin. The maximum prize scales with how much of their work is done by spin time, so finishing more means winning more. The wheel stays available for 3 days.' },
  { V: VignetteStreak, title: '8 · Streaks',
    body: 'Doing at least one task every day builds a streak — and one missed day a week is automatically forgiven, so a busy Tuesday doesn\'t wipe out their fire. Streaks unlock some of the best trophies.' },
  { V: VignetteSummary, title: '9 · Track progress',
    body: 'The Summary tab shows completion %, stars earned and Completion Champions — weekly or monthly, for the whole family or per child.' },
]

export default function GuideContent() {
  return (
    <div className="mt-4 space-y-5">
      {SECTIONS.map(({ V, title, body }) => (
        <div key={title}>
          <V/>
          <p className="font-bold text-gray-800 text-sm mt-2">{title}</p>
          <p className="text-xs text-gray-400 leading-snug mt-0.5">{body}</p>
        </div>
      ))}
      <div className="rounded-2xl p-3 text-xs leading-snug text-gray-500" style={tint}>
        <span className="font-black text-gray-700">Extras:</span> invite a co-parent, switch colour themes, set your timezone,
        and turn on notifications — all right here in Settings. 🔔🎨
      </div>
    </div>
  )
}
