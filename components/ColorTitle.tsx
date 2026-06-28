// Playful multi-coloured heading in the logo's display font.
const TITLE_COLORS = ['#16BDCA', '#F59E0B', '#7C3AED', '#22B14C', '#1E88E5', '#EC4899']

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
