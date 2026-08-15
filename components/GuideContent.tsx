'use client'

import { useState } from 'react'
import StarJar from '@/components/StarJar'

// "How Little Yakka Works" — comprehensive illustrated guide rendered inside
// Settings. Each section is a collapsible row (one open at a time) pairing an
// animated mini-UI vignette (same demo-* animation classes as the onboarding
// tour) with a fuller explanation.

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

// The three sub-tabs at the top of the Tasks page.
function VignetteTabs() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md p-2 w-[86%] fade-slide-up">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {['📅 Upcoming', '✅ Done', '📋 All'].map((label, i) => (
            <div key={label}
              className={`flex-1 py-1 rounded-lg text-[9px] font-black text-center truncate ${i === 0 ? 'text-white shadow' : 'text-gray-400'}`}
              style={i === 0 ? { background: 'var(--theme-gradient)' } : {}}>
              {label}
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1.5 px-0.5">
          <div className="h-2 w-2/3 rounded-full bg-gray-200"/>
          <div className="h-2 w-1/2 rounded-full bg-gray-100"/>
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

// Month grid with each child's own colour on their days (fixed cell heights —
// aspect-square would overflow the 96px frame).
function VignetteCalendar() {
  const marks: Record<number, string> = { 3: '#06A8B2', 8: '#EC4160', 12: '#5FAD43', 16: '#F8B211', 20: '#0768C3', 25: '#62449B' }
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md px-2.5 py-2 w-[78%] fade-slide-up">
        <div className="grid grid-cols-7 gap-[3px]">
          {Array.from({ length: 28 }, (_, i) => (
            <div key={i} className={`h-3 rounded-[3px] ${i === 10 ? 'demo-pulse' : ''}`}
              style={{ background: i === 10 ? 'var(--theme-gradient)' : marks[i] || '#f3f4f6' }}/>
          ))}
        </div>
      </div>
    </div>
  )
}

function VignetteRepeat() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md px-3 py-2.5 flex items-center gap-2 fade-slide-up">
        <span className="text-xl demo-pulse">🔁</span>
        <div className="flex gap-1">
          {['Daily', 'Weekly', 'Monthly'].map((label, i) => (
            <span key={label}
              className={`px-2 py-1 rounded-lg text-[9px] font-black ${i === 1 ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
              style={i === 1 ? { background: 'var(--theme-gradient)' } : {}}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// The invite arriving as a text message.
function VignetteInvite() {
  return (
    <div className={frame} style={tint}>
      <div className="flex items-center gap-2 fade-slide-up">
        <span className="text-2xl">👩</span>
        <div className="bg-white shadow-md rounded-2xl rounded-bl-sm px-3 py-2 max-w-[150px]">
          <p className="text-[9px] font-bold text-gray-600 leading-tight">Join our family on Little Yakka 🎉</p>
          <p className="text-[9px] font-semibold truncate" style={{ color: 'var(--theme-from)' }}>littleyakka.com/join/…</p>
        </div>
        <span className="text-2xl demo-pulse">👨</span>
      </div>
    </div>
  )
}

function VignetteContact() {
  return (
    <div className={frame} style={tint}>
      <div className="bg-white rounded-2xl shadow-md px-3 py-2.5 w-[78%] fade-slide-up">
        <div className="flex gap-1 mb-1.5">
          {['Broken', 'Idea', 'Help'].map((label, i) => (
            <span key={label}
              className={`px-2 py-0.5 rounded-lg text-[8px] font-black ${i === 1 ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
              style={i === 1 ? { background: 'var(--theme-gradient)' } : {}}>
              {label}
            </span>
          ))}
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 mb-1"/>
        <div className="h-2 w-2/3 rounded-full bg-gray-100"/>
        <div className="mt-2 h-4 w-14 rounded-lg flex items-center justify-center text-[8px] font-black text-white demo-pulse"
          style={{ background: 'var(--theme-gradient)' }}>Send</div>
      </div>
    </div>
  )
}

const SECTIONS: { icon: string; title: string; body: string; V: () => React.ReactElement }[] = [
  { V: VignetteKids, icon: '🧒', title: '1 · Add your kids',
    body: 'In Settings → Children, add each child with a name, age, colour and photo — or pick one of the 12 illustrated avatars. Tap a child anytime to edit them, set a savings goal to work towards, or adjust their stars.' },
  { V: VignetteTasks, icon: '🧹', title: '2 · Create tasks',
    body: 'Tap ＋ on the Tasks page. Pick from 20 ready-made templates or write your own, choose an icon, set how often (daily, weekly, monthly — and which days), what time of day, and how many stars it earns. Assign it to one child, several, or everyone. Turn on Twice a day for things like brushing teeth and you get a morning and an evening copy to tick off separately.' },
  { V: VignetteUFG, icon: '🙌', title: '3 · Up For Grabs',
    body: 'Toggle a task to Up For Grabs and it becomes a bounty — nobody owns it, and the first child to finish it wins the stars. Give it an expiry date and it disappears if nobody takes it. Great for one-off jobs!' },
  { V: VignetteTabs, icon: '📋', title: '4 · The three Tasks tabs',
    body: '📅 Upcoming is the day-by-day list of what\'s due, today first — narrow it to one child, or tap the little calendar button to jump back to today. ✅ Done is everything that\'s been ticked off, grouped by child, with an Undo on each. 📋 All is every task you\'ve made, as a grid you can edit. Once a child claims an Up For Grabs bounty it drops off Upcoming, but it stays listed under All.' },
  { V: VignetteEarn, icon: '⭐', title: '5 · Kids tick things off',
    body: 'From Home, tap a child\'s tile to open their Kids Zone. They tap DONE on a task, get a celebration, and the stars land instantly — tap the green ✓ to undo. Inside they get their own 📋 Tasks, ✅ Done and 🎁 My Rewards tabs. Tasks can Carry Over (done up to 3 days late) or be Done Early if you allow it. Tap the ❤️ on their Home tile to send a surprise message, and set a Parent PIN in Settings if you\'d like one asked for on the way out.' },
  { V: VignetteJar, icon: '🍬', title: '6 · The lolly jar & trophies',
    body: 'Each child has a lolly jar that fills as the week\'s tasks get done, plus 12 trophies to unlock — from the first star all the way to a 30-day streak. Tap any trophy to see how to earn it. Give them a savings goal and a second jar fills up towards it.' },
  { V: VignetteRewards, icon: '🎁', title: '7 · Spend stars on rewards',
    body: 'Create rewards on the Rewards page (ice cream, movie night, pocket money…) with a star price and who can redeem them. Kids redeem from their zone via Spend Stars, or you can tap Redeem yourself and pick the child. Every redemption shows in My Rewards and the parents\' Redeemed tab — undo anytime and the stars come straight back.' },
  { V: VignetteWheel, icon: '🎡', title: '8 · The Bonus Wheel',
    body: 'Once a week (or month — configure below) each child gets a prize-wheel spin. The maximum prize scales with how much of their work is done by spin time, so finishing more means winning more, and the Award Value slider sets how big the prizes get. The wheel stays available for 3 days.' },
  { V: VignetteStreak, icon: '🔥', title: '9 · Streaks',
    body: 'Doing at least one task every day builds a streak — and one missed day a week is automatically forgiven, so a busy Tuesday doesn\'t wipe out their fire. Streaks unlock some of the best trophies.' },
  { V: VignetteSummary, icon: '📊', title: '10 · Track progress',
    body: 'The Summary tab shows completion %, stars earned, best streak and Completion Champions — weekly or monthly, for the whole family or one child at a time.' },
  { V: VignetteCalendar, icon: '📅', title: '11 · The Family Calendar',
    body: 'The Calendar tab is the whole family\'s diary. Swap between 📆 Day, 🗓️ Week, 📅 Month and 📋 Agenda, and tap ＋ to add anything — school, sport, appointments. Give it a start and end time or make it all day, add a 📍 location and notes, then choose which children it\'s for. Each child has their own colour, so one look at the month tells you whose day is busy. Leave the children blank for a whole-family event.' },
  { V: VignetteRepeat, icon: '🔁', title: '12 · Events that repeat',
    body: 'Anything that happens again and again can repeat: Daily, Weekly, Fortnightly, Monthly, Yearly, or Custom days where you pick the weekdays yourself (Monday and Thursday swimming). Set an Ends date, or leave it blank to repeat forever. Editing a repeating event changes every occurrence. Deleting one asks which you mean — Only that date skips that single day and leaves the rest alone, or Delete all removes the whole series.' },
  { V: VignetteInvite, icon: '👪', title: '13 · Invite a co-parent',
    body: 'In Settings → Invite Co-Parent, tap Create link (the email is optional), then 💬 Send by text or copy the link across. They open it on their phone and set up their login right there in the browser — that\'s them in your family. The page then points them at the App Store, and they sign in to the app with the same email and password they just chose. The link only works once.' },
  { V: VignetteContact, icon: '💬', title: '14 · Contact us',
    body: 'Stuck, spotted a bug, or thought of something we should build? Settings → Contact Us: pick what it\'s about, leave the address you\'d like a reply on, and send. It comes straight to us and we read every one.' },
]

export default function GuideContent() {
  // One section open at a time — the guide is long, and this keeps it a
  // scannable list rather than a wall of vignettes.
  const [openTitle, setOpenTitle] = useState<string | null>(null)

  return (
    <div className="mt-4">
      {SECTIONS.map(({ V, icon, title, body }) => {
        const open = openTitle === title
        return (
          <div key={title} className="border-b border-gray-100 last:border-0">
            <button onClick={() => setOpenTitle(open ? null : title)}
              className="w-full flex items-center gap-3 py-3 text-left active:opacity-60 transition">
              <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
              <p className="flex-1 min-w-0 font-bold text-gray-800 text-sm leading-tight">{title}</p>
              <span className={`text-gray-300 text-lg flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
            </button>
            {open && (
              <div className="pb-4 fade-slide-up">
                <V/>
                <p className="text-xs text-gray-400 leading-snug mt-2">{body}</p>
              </div>
            )}
          </div>
        )
      })}
      <div className="rounded-2xl p-3 text-xs leading-snug text-gray-500 mt-4" style={tint}>
        <span className="font-black text-gray-700">Extras:</span> eight colour themes, your timezone, notifications, your
        family name, your password, and a history of every star you've added or taken away by hand — all right here in Settings. 🔔🎨
      </div>
    </div>
  )
}
