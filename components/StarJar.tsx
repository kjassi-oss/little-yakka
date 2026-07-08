// A jar of round sweets that fills as progress grows. The % sits ABOVE the
// jar, and colourful sweets stack up from the bottom in real time.
const SWEETS = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93', '#EC4899', '#F97316', '#14B8A6', '#FACC15', '#A855F7', '#22C55E', '#F43F5E']

// Fixed staggered slots (left%, bottom%) so sweets pile up naturally. More,
// smaller sweets fill the jar for a fuller, lolly-jar look.
const SLOTS = [
  { l: 10, b: 3 },  { l: 32, b: 2 },  { l: 54, b: 4 },  { l: 74, b: 3 },
  { l: 6, b: 17 },  { l: 22, b: 18 }, { l: 44, b: 16 }, { l: 64, b: 19 },
  { l: 12, b: 32 }, { l: 34, b: 33 }, { l: 56, b: 31 }, { l: 76, b: 34 },
  { l: 8, b: 47 },  { l: 24, b: 48 }, { l: 46, b: 46 }, { l: 66, b: 49 },
  { l: 14, b: 62 }, { l: 36, b: 63 }, { l: 58, b: 61 }, { l: 78, b: 64 },
]

export default function StarJar({ done, total, label, size = 72 }: {
  done: number; total: number; label?: string; size?: number
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const shown = Math.round((pct / 100) * SLOTS.length)
  const width = size
  const height = Math.round(size * 1.2)
  const sweet = Math.max(7, Math.round(size * 0.155))

  return (
    <div className="flex flex-col items-center">
      <p className="text-lg font-black text-gray-800 leading-none mb-1">{pct}%</p>
      <div className="rounded-t-md bg-gray-200" style={{ width: width * 0.55, height: 6 }}/>
      <div className="relative overflow-hidden border-2 border-gray-200 bg-white/70"
        style={{ width, height, borderRadius: '12px 12px 20px 20px' }}>
        {SLOTS.slice(0, shown).map((s, i) => (
          <span key={i} className="absolute rounded-full transition-all duration-500"
            style={{ left: `${s.l}%`, bottom: `${s.b}%`, width: sweet, height: sweet,
              backgroundColor: SWEETS[i % SWEETS.length],
              boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.1)' }}/>
        ))}
      </div>
      {label && <p className="text-[10px] font-bold text-gray-400 mt-1 text-center leading-tight">{label}</p>}
    </div>
  )
}
