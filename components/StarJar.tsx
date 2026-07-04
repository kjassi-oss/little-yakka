// A jar that fills with stars — kid-friendly progress instead of a bare bar.
export default function StarJar({ done, total, width = 52, height = 68, label }: {
  done: number; total: number; width?: number; height?: number; label?: string
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
          style={{ height: `${pct}%`, background: 'var(--theme-gradient)', opacity: 0.85 }}/>
        {/* Stars floating in the fill */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none select-none">
          {pct >= 66 && <span style={{ fontSize: width * 0.26 }}>⭐</span>}
          {pct >= 33 && <span style={{ fontSize: width * 0.3 }}>⭐</span>}
          {pct > 0 && <span style={{ fontSize: width * 0.34 }}>⭐</span>}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-black text-gray-700 drop-shadow-sm" style={{ fontSize: width * 0.28 }}>{pct}%</span>
        </div>
      </div>
      {label && <p className="text-[9px] font-bold text-gray-400 mt-1 text-center leading-tight">{label}</p>}
    </div>
  )
}
