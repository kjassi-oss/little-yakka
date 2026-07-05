// A lolly jar that fills as progress grows — kid-friendly progress meter.
// The fill height and lollies update live with the numbers passed in.
export default function StarJar({ done, total, width = 52, height = 68, label, emojis = ['🍬', '🍭', '🍬'] }: {
  done: number; total: number; width?: number; height?: number; label?: string; emojis?: string[]
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  return (
    <div className="flex flex-col items-center flex-shrink-0" style={{ width: width + 8 }}>
      {/* Lid */}
      <div className="rounded-t-md bg-gray-200" style={{ width: width * 0.6, height: 6 }}/>
      {/* Jar */}
      <div className="relative overflow-hidden border-2 border-gray-200 bg-white/60"
        style={{ width, height, borderRadius: '10px 10px 18px 18px' }}>
        <div className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out"
          style={{ height: `${pct}%`, background: 'var(--theme-gradient)', opacity: 0.25 }}/>
        {/* Lollies pile up as the jar fills */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none select-none">
          {pct >= 66 && <span style={{ fontSize: width * 0.28, marginBottom: -2 }}>{emojis[2] ?? '🍬'}</span>}
          {pct >= 33 && <span style={{ fontSize: width * 0.32, marginBottom: -3 }}>{emojis[1] ?? '🍭'}</span>}
          {pct > 0 && <span style={{ fontSize: width * 0.36 }}>{emojis[0] ?? '🍬'}</span>}
        </div>
        <div className="absolute top-1 left-0 right-0 flex justify-center">
          <span className="font-black text-gray-700 drop-shadow-sm" style={{ fontSize: width * 0.26 }}>{pct}%</span>
        </div>
      </div>
      {label && <p className="text-[9px] font-bold text-gray-400 mt-1 text-center leading-tight">{label}</p>}
    </div>
  )
}
