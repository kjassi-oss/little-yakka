// A jar of round sweets that fills as progress grows. The % sits ABOVE the
// jar, and colourful sweets stack up from the bottom in real time.
const SWEETS = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93', '#EC4899', '#F97316', '#14B8A6', '#FACC15', '#A855F7', '#22C55E', '#F43F5E']

// Fixed staggered slots (left%, bottom%) so sweets pile up naturally
const SLOTS = [
  { l: 16, b: 3 },  { l: 44, b: 1 },  { l: 68, b: 4 },
  { l: 6, b: 20 },  { l: 33, b: 18 }, { l: 61, b: 21 },
  { l: 18, b: 37 }, { l: 47, b: 35 }, { l: 70, b: 38 },
  { l: 10, b: 54 }, { l: 38, b: 52 }, { l: 63, b: 55 },
]

export default function StarJar({ done, total, label, size = 72 }: {
  done: number; total: number; label?: string; size?: number
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const shown = Math.round((pct / 100) * SLOTS.length)
  const width = size
  const height = Math.round(size * 1.2)
  const sweet = Math.max(9, Math.round(size * 0.22))

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
