'use client'

import { useRef, useState } from 'react'
import { PICKER_KIDS, PICKER_DEFAULT_TONES, circledAvatarPath, parseCircledAvatar } from '@/lib/kidAvatars'

// Shared kid-avatar picker — 10 cartoon avatars (5 girls then 5 boys) on
// coloured circles, 5 per row. Tap to pick; HOLD (long-press) to choose a
// skin tone. `value`/`onChange` carry the avatar's public path
// (e.g. /avatars/c3-t0.svg) — callers store it in children.avatar_url.

// iOS: stop long-press text selection / grey tap flash — both made every
// option look "selected" while the skin-tone popup was open.
const NO_SELECT: React.CSSProperties = {
  WebkitUserSelect: 'none', userSelect: 'none',
  WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
}

const TONES = [0, 1, 2, 3, 4, 5]

export default function AvatarPicker({ value, onChange, accent = 'purple' }: {
  value: string
  onChange: (avatar: string) => void
  accent?: 'purple' | 'pink'
}) {
  const [tonePick, setTonePick] = useState<number | null>(null) // kid number
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const openedAt = useRef(0)
  const ring = accent === 'pink' ? 'ring-pink-400' : 'ring-purple-400'
  const sel = parseCircledAvatar(value)

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
    // Keep the current tone when re-tapping the selected kid
    const tone = sel?.kid === kid ? sel.tone : PICKER_DEFAULT_TONES[kid] ?? 0
    onChange(circledAvatarPath(kid, tone))
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
        {PICKER_KIDS.map(kid => {
          const isSel = sel?.kid === kid
          const tone = isSel ? sel.tone : PICKER_DEFAULT_TONES[kid] ?? 0
          return (
            <button key={kid} type="button" style={NO_SELECT}
              onPointerDown={() => press(kid)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
              onClick={() => tap(kid)} onContextMenu={e => e.preventDefault()}
              className={`aspect-square rounded-full p-0.5 select-none transition ${isSel ? `ring-2 ${ring} bg-white` : ''}`}>
              <img src={circledAvatarPath(kid, tone)} alt="" draggable={false}
                className="w-full h-full rounded-full pointer-events-none"/>
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
              {TONES.map(t => {
                const path = circledAvatarPath(tonePick, t)
                const active = value === path
                return (
                  <button key={t} type="button" style={NO_SELECT}
                    onClick={() => guarded(() => { onChange(path); setTonePick(null) })}
                    className={`aspect-square rounded-full p-0.5 active:scale-90 transition ${active ? `ring-2 ${ring} bg-white` : ''}`}>
                    <img src={path} alt="" draggable={false} className="w-full h-full rounded-full pointer-events-none"/>
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
