export default function Logo({ size = 72, className = '', rainbow = false }: { size?: number; className?: string; rainbow?: boolean }) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: size * 0.22, flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
          {rainbow ? (
            <>
              <stop offset="0%" stopColor="#FF595E"/>
              <stop offset="28%" stopColor="#FFCA3A"/>
              <stop offset="52%" stopColor="#8AC926"/>
              <stop offset="78%" stopColor="#1982C4"/>
              <stop offset="100%" stopColor="#6A4C93"/>
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="var(--theme-from, #7C3AED)"/>
              <stop offset="100%" stopColor="var(--theme-to, #EC4899)"/>
            </>
          )}
        </linearGradient>
        <linearGradient id="logoGlow" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>
      </defs>

      <rect width="200" height="200" rx="44" fill="url(#logoBg)"/>
      <rect width="200" height="200" rx="44" fill="url(#logoGlow)"/>

      {/* Left kid */}
      <circle cx="57" cy="76" r="17" fill="white"/>
      <ellipse cx="57" cy="60" rx="10" ry="6" fill="white" opacity="0.6"/>
      <circle cx="51" cy="74" r="2.8" fill="#5B21B6"/>
      <circle cx="63" cy="74" r="2.8" fill="#5B21B6"/>
      <circle cx="52.2" cy="72.8" r="1" fill="white"/>
      <circle cx="64.2" cy="72.8" r="1" fill="white"/>
      <path d="M 51 80 Q 57 86 63 80" stroke="#5B21B6" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <circle cx="47" cy="79" r="6" fill="#F9A8D4" opacity="0.35"/>
      <rect x="48" y="93" width="18" height="27" rx="8" fill="white"/>
      <line x1="66" y1="100" x2="97" y2="65" stroke="white" strokeWidth="7" strokeLinecap="round"/>
      <line x1="48" y1="100" x2="36" y2="115" stroke="white" strokeWidth="7" strokeLinecap="round"/>
      <line x1="53" y1="120" x2="47" y2="150" stroke="white" strokeWidth="7" strokeLinecap="round"/>
      <line x1="63" y1="120" x2="67" y2="150" stroke="white" strokeWidth="7" strokeLinecap="round"/>

      {/* Right kid */}
      <circle cx="143" cy="76" r="17" fill="white"/>
      <circle cx="130" cy="63" r="7" fill="white" opacity="0.55"/>
      <circle cx="156" cy="63" r="7" fill="white" opacity="0.55"/>
      <circle cx="137" cy="74" r="2.8" fill="#5B21B6"/>
      <circle cx="149" cy="74" r="2.8" fill="#5B21B6"/>
      <circle cx="138.2" cy="72.8" r="1" fill="white"/>
      <circle cx="150.2" cy="72.8" r="1" fill="white"/>
      <path d="M 137 80 Q 143 86 149 80" stroke="#5B21B6" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <circle cx="153" cy="79" r="6" fill="#F9A8D4" opacity="0.35"/>
      <rect x="134" y="93" width="18" height="27" rx="8" fill="white"/>
      <line x1="134" y1="100" x2="103" y2="65" stroke="white" strokeWidth="7" strokeLinecap="round"/>
      <line x1="152" y1="100" x2="164" y2="115" stroke="white" strokeWidth="7" strokeLinecap="round"/>
      <line x1="139" y1="120" x2="133" y2="150" stroke="white" strokeWidth="7" strokeLinecap="round"/>
      <line x1="149" y1="120" x2="153" y2="150" stroke="white" strokeWidth="7" strokeLinecap="round"/>

      {/* High-five star burst */}
      <circle cx="100" cy="60" r="20" fill="#FCD34D" opacity="0.25"/>
      <polygon
        points="100,43 104.1,54.3 116.2,54.8 106.7,62.2 110,73.7 100,67 90,73.7 93.3,62.2 83.8,54.8 95.9,54.3"
        fill="#FCD34D"
      />
      <polygon
        points="100,49 102.2,56 108.6,56.2 103.8,60.1 105.5,66.4 100,62.8 94.5,66.4 96.2,60.1 91.4,56.2 97.8,56"
        fill="white" opacity="0.3"
      />
      <g stroke="#FCD34D" strokeWidth="2.5" strokeLinecap="round">
        <line x1="100" y1="37" x2="100" y2="29"/>
        <line x1="118" y1="43" x2="123" y2="37"/>
        <line x1="124" y1="62" x2="132" y2="62"/>
        <line x1="82" y1="43" x2="77" y2="37"/>
        <line x1="76" y1="62" x2="68" y2="62"/>
      </g>
      <circle cx="126" cy="78" r="3.5" fill="#FCD34D" opacity="0.6"/>
      <circle cx="74" cy="78" r="3.5" fill="#FCD34D" opacity="0.6"/>
    </svg>
  )
}
