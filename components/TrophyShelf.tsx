'use client'

import { useState } from 'react'

// Trophy shelf — 12 trophies in a 4×3 grid, easy→hard. Earned ones show in
// full colour; locked ones are greyed with a padlock. Tapping any trophy
// reveals a playful ~30-word blurb (earned) or exactly what's needed (locked).
interface Trophy { emoji: string; name: string; hint: string; blurb: string; earned: boolean }

export function buildTrophies(stars: number, streak: number, completions: number): Trophy[] {
  return [
    { emoji: '🌟', name: 'First Star',      hint: 'Earn your very first star',
      blurb: 'Your very first star! Every superstar starts with just one. Look how it shines — and this is only the beginning of your collection. Keep going!',
      earned: stars >= 1 },
    { emoji: '🌱', name: 'Getting Started', hint: 'Finish 5 tasks',
      blurb: "Five tasks done and dusted! You've figured out how this works. Little sprout today, mighty tree tomorrow. Keep watering those good habits!",
      earned: completions >= 5 },
    { emoji: '🔥', name: 'Hot Streak',      hint: 'Do your tasks 3 days in a row',
      blurb: "Three days in a row — you're on fire! Doing your tasks every single day is TOUGH, and you nailed it. Can you keep the flame alive?",
      earned: streak >= 3 },
    { emoji: '💫', name: 'Star Collector',  hint: 'Earn 100 stars in total',
      blurb: "One hundred stars in your jar! That's a whole galaxy you've earned all by yourself. Twinkle twinkle, you little legend.",
      earned: stars >= 100 },
    { emoji: '🎯', name: 'Fifty Club',      hint: 'Finish 50 tasks',
      blurb: 'Fifty tasks smashed! You aim, you fire, you finish. Nothing gets past you now. Welcome to the Fifty Club — very exclusive!',
      earned: completions >= 50 },
    { emoji: '⚡', name: 'Week Warrior',    hint: 'Do your tasks 7 days in a row',
      blurb: 'A whole week without missing a day?! You are UNSTOPPABLE. Seven suns rose and you were ready every time. Lightning-fast legend!',
      earned: streak >= 7 },
    { emoji: '🏅', name: 'Century',         hint: 'Finish 100 tasks',
      blurb: "One hundred tasks complete! That's a proper achievement medal right there. You've done more chores than most grown-ups. Take a bow, champion!",
      earned: completions >= 100 },
    { emoji: '🏆', name: 'Star Champion',   hint: 'Earn 500 stars in total',
      blurb: "Five hundred stars! This shiny golden trophy is all yours. You've worked harder than almost anyone. Absolute superstar — show it off!",
      earned: stars >= 500 },
    { emoji: '🎖️', name: 'Task Master',     hint: 'Finish 250 tasks',
      blurb: "Two hundred and fifty tasks! You're not just helping — you're a MASTER. Cool, calm, and always getting it done. Seriously impressive stuff.",
      earned: completions >= 250 },
    { emoji: '👑', name: 'Streak Royalty',  hint: 'Do your tasks 14 days in a row',
      blurb: 'Two weeks straight — bow down, everybody! Fourteen days of never giving up makes you the ruler of routines. Long live the streak!',
      earned: streak >= 14 },
    { emoji: '💎', name: 'Diamond Hoard',   hint: 'Earn 1,500 stars in total',
      blurb: 'One thousand five hundred stars — rare as a diamond! Only the most dedicated ever get here. You sparkle brighter than the rest. Dazzling!',
      earned: stars >= 1500 },
    { emoji: '🐐', name: 'The G.O.A.T.',    hint: 'Do your tasks 30 days in a row',
      blurb: 'THIRTY. DAYS. STRAIGHT. You are officially the Greatest Of All Time. A whole month, never missing once. Nobody does it better. LEGEND!',
      earned: streak >= 30 },
  ]
}

export default function TrophyShelf({ stars, streak, completions }: {
  stars: number; streak: number; completions: number
}) {
  const trophies = buildTrophies(stars, streak, completions)
  const earnedCount = trophies.filter(t => t.earned).length
  const [selected, setSelected] = useState<Trophy | null>(null)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
      <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">🏆 Trophies · {earnedCount}/{trophies.length}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {trophies.map(t => (
          <button key={t.name}
            onClick={() => setSelected(selected?.name === t.name ? null : t)}
            className={`flex flex-col items-center rounded-xl py-1.5 active:scale-95 transition ${t.earned ? 'bg-yellow-50' : 'bg-gray-50'} ${selected?.name === t.name ? 'ring-2 ring-amber-300' : ''}`}>
            <span className={`text-2xl leading-none ${t.earned ? '' : 'grayscale opacity-40'}`}>{t.earned ? t.emoji : '🔒'}</span>
            <p className={`text-[8px] font-bold text-center leading-tight mt-1 px-0.5 ${t.earned ? 'text-yellow-700' : 'text-gray-400'}`}>{t.name}</p>
          </button>
        ))}
      </div>
      {selected && (
        <div className={`mt-2 rounded-xl px-3 py-2 text-xs font-semibold leading-snug ${selected.earned ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-500'}`}>
          {selected.earned ? (
            <><span className="font-black">{selected.emoji} {selected.name}</span> — {selected.blurb}</>
          ) : (
            <><span className="font-black">🔒 {selected.name}</span> — {selected.hint} to unlock this trophy!</>
          )}
        </div>
      )}
    </div>
  )
}
