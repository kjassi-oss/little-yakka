// Trophy shelf — earned badges in colour, locked ones greyed with a hint.
interface Trophy { emoji: string; name: string; hint: string; earned: boolean }

export function buildTrophies(stars: number, streak: number, completions: number): Trophy[] {
  return [
    { emoji: '🌟', name: 'First Star',   hint: 'Earn 1 star',        earned: stars >= 1 },
    { emoji: '🎯', name: 'On Target',    hint: 'Finish 10 tasks',    earned: completions >= 10 },
    { emoji: '💯', name: 'Fifty Club',   hint: 'Finish 50 tasks',    earned: completions >= 50 },
    { emoji: '🏅', name: 'Century',      hint: 'Finish 100 tasks',   earned: completions >= 100 },
    { emoji: '💫', name: 'Star Hoard',   hint: 'Earn 100 stars',     earned: stars >= 100 },
    { emoji: '🏆', name: 'Superstar',    hint: 'Earn 500 stars',     earned: stars >= 500 },
    { emoji: '🔥', name: 'Hot Streak',   hint: '3 days in a row',    earned: streak >= 3 },
    { emoji: '⚡', name: 'Unstoppable',  hint: '7 days in a row',    earned: streak >= 7 },
    { emoji: '👑', name: 'Legend',       hint: '14 days in a row',   earned: streak >= 14 },
  ]
}

export default function TrophyShelf({ stars, streak, completions }: {
  stars: number; streak: number; completions: number
}) {
  const trophies = buildTrophies(stars, streak, completions)
  const earnedCount = trophies.filter(t => t.earned).length
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
      <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">🏆 Trophies · {earnedCount}/{trophies.length}</p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {trophies.map(t => (
          <div key={t.name} className={`flex flex-col items-center flex-shrink-0 w-16 rounded-xl p-1.5 ${t.earned ? 'bg-yellow-50' : 'bg-gray-50'}`}>
            <span className={`text-2xl ${t.earned ? '' : 'grayscale opacity-40'}`}>{t.earned ? t.emoji : '🔒'}</span>
            <p className={`text-[9px] font-bold text-center leading-tight mt-0.5 ${t.earned ? 'text-yellow-700' : 'text-gray-400'}`}>{t.name}</p>
            {!t.earned && <p className="text-[8px] text-gray-300 text-center leading-tight">{t.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
