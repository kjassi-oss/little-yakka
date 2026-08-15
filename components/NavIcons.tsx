// Nav glyphs for the sticker-badge tray. Drawn on a 24×24 grid, coloured via
// `currentColor` so the badge decides the colour, not the icon.
//
// Emoji used to do this job, which meant iOS and Android each drew their own
// icon set and neither could take a brand colour.

type IconProps = { className?: string }

// One logo colour per section, sampled from the wordmark's letterforms. These
// are deliberately fixed rather than themed — the tray is brand furniture, so
// it stays put while the family's chosen theme colours the rest of the app.
export const navColour = {
  home: '#05A6B1',
  tasks: '#60B042',
  calendar: '#0768C3',
  rewards: '#EE4161',
  summary: '#F68F12',
  settings: '#0E2574',
} as const

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// House with a heart window — home is where the family is.
export function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" {...stroke} />
      <path d="M12 17.2c-2-1.6-3-2.5-3-3.7a1.55 1.55 0 0 1 3-.65 1.55 1.55 0 0 1 3 .65c0 1.2-1 2.1-3 3.7Z" fill="currentColor" />
    </svg>
  )
}

// Clipboard with the tick built in — the tick used to be a separate overlay dot.
export function TasksIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" {...stroke} />
      <rect x="8.5" y="2" width="7" height="4" rx="1.5" {...stroke} />
      <path d="m8.6 13.6 2.5 2.5 4.4-5" {...stroke} />
    </svg>
  )
}

// Calendar with a star on one date — the day the stars land.
export function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2.5" {...stroke} />
      <path d="M3 10h18M8 3v3.5M16 3v3.5" {...stroke} />
      <path d="m12 12.3 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3Z" fill="currentColor" />
    </svg>
  )
}

// Gift with a star where the bow would be.
export function RewardsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4.5" y="12" width="15" height="9" rx="1.8" {...stroke} />
      <rect x="3" y="8" width="18" height="4" rx="1.4" {...stroke} />
      <path d="M12 8v13" {...stroke} />
      <path d="M12 1.2l.86 2.22 2.37.13-1.84 1.5.61 2.3L12 6.06 10 7.35l.61-2.3-1.84-1.5 2.37-.13Z" fill="currentColor" />
    </svg>
  )
}

// Three rising bars with a star over the tallest — the week, at a glance.
// Replaces the trophy, which already means "trophies you unlock" in Kids Zone.
export function SummaryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="13" width="4" height="7.5" rx="1.6" fill="currentColor" />
      <rect x="10" y="10" width="4" height="10.5" rx="1.6" fill="currentColor" />
      <rect x="16.5" y="7.5" width="4" height="13" rx="1.6" fill="currentColor" />
      <path d="m18.5 1 .95 1.9 2.1.3-1.5 1.5.35 2.1-1.9-1-1.9 1 .35-2.1-1.5-1.5 2.1-.3Z" fill="currentColor" />
    </svg>
  )
}

// Sliders rather than a cog — reads cleaner at tray size. Sidebar only.
export function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" {...stroke} />
      <circle cx="9" cy="7" r="2.2" fill="currentColor" />
      <circle cx="15" cy="12" r="2.2" fill="currentColor" />
      <circle cx="8" cy="17" r="2.2" fill="currentColor" />
    </svg>
  )
}
