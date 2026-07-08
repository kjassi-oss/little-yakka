import { useId } from 'react'

// A glass lolly jar that fills with colourful sweets as progress grows.
// Drawn as an SVG mason jar (lid, shoulders, rounded base, glass shine);
// sweets are clipped to the glass so they stack up inside it. The % sits
// ABOVE the jar.
const SWEETS = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93', '#EC4899', '#F97316', '#14B8A6', '#FACC15', '#A855F7', '#22C55E', '#F43F5E']

// Fixed staggered slots (left%, bottom%) so sweets pile up naturally.
const SLOTS = [
  { l: 10, b: 3 },  { l: 32, b: 2 },  { l: 54, b: 4 },  { l: 74, b: 3 },
  { l: 6, b: 17 },  { l: 22, b: 18 }, { l: 44, b: 16 }, { l: 64, b: 19 },
  { l: 12, b: 32 }, { l: 34, b: 33 }, { l: 56, b: 31 }, { l: 76, b: 34 },
  { l: 8, b: 47 },  { l: 24, b: 48 }, { l: 46, b: 46 }, { l: 66, b: 49 },
  { l: 14, b: 62 }, { l: 36, b: 63 }, { l: 58, b: 61 }, { l: 78, b: 64 },
]

// Mason-jar glass silhouette in the 80×100 viewBox: neck → shoulders →
// straight sides → rounded base. Reused for both the outline and the clip.
const GLASS_PATH = 'M26 14 H54 V20 C54 24 70 25 70 36 V80 C70 91 62 97 53 97 H27 C18 97 10 91 10 80 V36 C10 25 26 24 26 20 Z'

export default function StarJar({ done, total, label, size = 72 }: {
  done: number; total: number; label?: string; size?: number
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const shown = Math.round((pct / 100) * SLOTS.length)
  const clipId = useId()

  return (
    <div className="flex flex-col items-center">
      <p className="text-lg font-black text-gray-800 leading-none mb-1">{pct}%</p>
      <svg width={size} height={Math.round(size * 1.25)} viewBox="0 0 80 100" aria-hidden="true">
        <defs>
          <clipPath id={clipId}><path d={GLASS_PATH}/></clipPath>
        </defs>

        {/* Lid — two-tone amber cap with a rim */}
        <rect x="21" y="1" width="38" height="9" rx="4" fill="#F59E0B"/>
        <rect x="17" y="8" width="46" height="6" rx="3" fill="#D97706"/>

        {/* Glass body */}
        <path d={GLASS_PATH} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2.5"/>

        {/* Sweets — clipped to the glass */}
        <g clipPath={`url(#${clipId})`}>
          {SLOTS.slice(0, shown).map((s, i) => {
            const cx = 12 + s.l * 0.47 + 4.6
            const cy = 90.4 - s.b * 0.6
            return (
              <g key={i} className="transition-all duration-500">
                <circle cx={cx} cy={cy} r="5" fill={SWEETS[i % SWEETS.length]}/>
                <circle cx={cx - 1.6} cy={cy - 1.6} r="1.4" fill="white" opacity="0.55"/>
              </g>
            )
          })}
        </g>

        {/* Glass shine */}
        <path d="M17 38 Q14.5 58 17 80" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.8"/>
      </svg>
      {label && <p className="text-[10px] font-bold text-gray-400 mt-1 text-center leading-tight">{label}</p>}
    </div>
  )
}
