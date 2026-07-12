'use client'

import { useRef, useState } from 'react'
import { AVATAR_KIDS, DEFAULT_TONES, TONE_COUNT, kidAvatarPath, parseKidAvatar } from '@/lib/kidAvatars'

// Shared kid-avatar picker — 15 illustrated cartoon kids (bundled SVGs), 5 per
// row. Tap to pick; HOLD (long-press) a kid to choose their skin tone.
// Art: "Custom Avatar" by Ashley Seo (CC BY 4.0) via DiceBear big-smile.

// iOS: stop long-press text selection / grey tap flash — both made every
// option look "selected" while the skin-tone popup was open.
const NO_SELECT: React.CSSProperties = {
  WebkitUserSelect: 'none', userSelect: 'none',
  WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
}

export default function AvatarPicker({ value, onChange, accent = 'purple' }: {
  value: string
  onChange: (avatar: string) => void
  accent?: 'purple' | 'pink'
}) {
  const [tonePick, setTonePick] = useState<number | null>(null) // kid number being toned
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const openedAt = useRef(0)
  const ring = accent === 'pink' ? 'ring-pink-400' : 'ring-purple-400'
  const sel = parseKidAvatar(value)

  function press(kid: number) {
    longPressed.current = false
    timer.current = setTimeout(() => {
      longPressed.current = true
      openedAt.current = Date.now()
      setTonePick(kid)
    }, 450)
  }
  function release() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }
  function tap(kid: number) {
    if (longPressed.current) { longPressed.current = false; return } // long-press already opened the popup
    onChange(kidAvatarPath(kid, DEFAULT_TONES[kid - 1]))
  }
  // Ignore the ghost click that fires when the finger lifts right after the
  // popup opens (otherwise it would instantly pick/close).
  function guarded(fn: () => void) {
    if (Date.now() - openedAt.current < 400) return
    fn()
  }

  return (
    <div style={NO_SELECT}>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: AVATAR_KIDS }, (_, i) => i + 1).map(kid => {
          const isSel = sel?.kid === kid
          const src = isSel ? value : kidAvatarPath(kid, DEFAULT_TONES[kid - 1])
          return (
            <button key={kid} type="button" style={NO_SELECT}
              onPointerDown={() => press(kid)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
              onClick={() => tap(kid)} onContextMenu={e => e.preventDefault()}
              className={`aspect-square rounded-xl overflow-hidden select-none transition p-0.5 ${isSel ? `ring-2 ${ring} bg-white` : 'bg-gray-50 hover:bg-gray-100'}`}>
              <img src={src} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none"/>
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 text-center">Tap to pick · hold to choose a skin tone</p>

      {/* Skin-tone popup (long-press) — only the CURRENT tone is highlighted */}
      {tonePick !== null && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-6" style={NO_SELECT}
          onClick={() => guarded(() => setTonePick(null))} onContextMenu={e => e.preventDefault()}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-xs text-center pop-in select-none" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-gray-700 mb-3">Pick a skin tone</p>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: TONE_COUNT }, (_, t) => {
                const variant = kidAvatarPath(tonePick, t)
                const active = value === variant
                return (
                  <button key={t} type="button" style={NO_SELECT}
                    onClick={() => guarded(() => { onChange(variant); setTonePick(null) })}
                    className={`aspect-square rounded-xl overflow-hidden active:scale-90 transition p-0.5 ${active ? `ring-2 ${ring} bg-white` : 'bg-transparent'}`}>
                    <img src={variant} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none"/>
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={() => guarded(() => setTonePick(null))}
              className="mt-3 text-xs font-bold text-gray-400">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
