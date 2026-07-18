// Playful multi-coloured heading in the logo's display font — letter colours
// follow the "Little Yakka" wordmark: cyan, yellow, purple, coral, green, blue.
const TITLE_COLORS = ['#28BCE6', '#F6B11F', '#8B51D1', '#F35C77', '#4BB543', '#1976D2']

export default function ColorTitle({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`inline-block ${className}`}
      style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.05 }}>
      {Array.from(text).map((ch, i) => (
        <span key={i} style={{ color: ch === ' ' ? 'transparent' : TITLE_COLORS[i % TITLE_COLORS.length] }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}
