'use client'

import { useRef, useState } from 'react'

// Shared kid-avatar picker — 15 fun emoji avatars (7 girls, 7 boys + a clown),
// 5 per row. Tap to pick; HOLD (long-press) a human avatar to choose a skin tone.
export const KID_AVATARS = [
  '👧', '👦', '🦸‍♀️', '🦸‍♂️', '🤡',
  '👸', '🤴', '🧚‍♀️', '🥷', '🤠',
  '🧜‍♀️', '🧙‍♀️', '🧙‍♂️', '👩‍🚀', '👨‍🚀',
]

// Smiley-style faces don't take skin-tone modifiers
const NO_TONE = new Set(['🤡', '🤠'])
const TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿']

// iOS: stop long-press text selection / grey tap flash — both made every
// option look "selected" while the skin-tone popup was open.
const NO_SELECT: React.CSSProperties = {
  WebkitUserSelect: 'none', userSelect: 'none',
  WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
}

export function stripTone(e: string): string {
  return e.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')
}

// Insert a skin-tone modifier right after the base character (before any ZWJ
// sequence like ‍♀️), e.g. 🦸‍♀️ + 🏽 → 🦸🏽‍♀️
function applyTone(emoji: string, tone: string): string {
  const clean = stripTone(emoji)
  if (!tone) return clean
  const zwj = clean.indexOf('‍')
  if (zwj === -1) return clean.replace(/️/gu, '') + tone
  return clean.slice(0, zwj).replace(/️/gu, '') + tone + clean.slice(zwj)
}

export default function AvatarPicker({ value, onChange, accent = 'purple' }: {
  value: string
  onChange: (avatar: string) => void
  accent?: 'purple' | 'pink'
}) {
  const [tonePick, setTonePick] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const openedAt = useRef(0)
  const ring = accent === 'pink' ? 'ring-pink-400' : 'ring-purple-400'
  const selBase = stripTone(value)

  function press(base: string) {
    longPressed.current = false
    if (NO_TONE.has(base)) return
    timer.current = setTimeout(() => {
      longPressed.current = true
      openedAt.current = Date.now()
      setTonePick(base)
    }, 450)
  }
  function release() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }
  function tap(base: string) {
    if (longPressed.current) { longPressed.current = false; return } // long-press already opened the popup
    onChange(base)
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
        {KID_AVATARS.map(a => {
          const sel = selBase === a
          return (
            <button key={a} type="button" style={NO_SELECT}
              onPointerDown={() => press(a)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
              onClick={() => tap(a)} onContextMenu={e => e.preventDefault()}
              className={`aspect-square rounded-xl flex items-center justify-center text-5xl leading-none select-none overflow-hidden transition ${sel ? `ring-2 ${ring} bg-white` : 'bg-gray-50 hover:bg-gray-100'}`}>
              {sel ? value : a}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 text-center">Tap to pick · hold to choose a skin tone</p>

      {/* Skin-tone popup (long-press) — only the CURRENT tone is highlighted */}
      {tonePick && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-6" style={NO_SELECT}
          onClick={() => guarded(() => setTonePick(null))} onContextMenu={e => e.preventDefault()}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-xs text-center pop-in select-none" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-gray-700 mb-3">Pick a skin tone</p>
            <div className="grid grid-cols-6 gap-1.5">
              {TONES.map(t => {
                const variant = applyTone(tonePick, t)
                const active = value === variant
                return (
                  <button key={t || 'default'} type="button" style={NO_SELECT}
                    onClick={() => guarded(() => { onChange(variant); setTonePick(null) })}
                    className={`aspect-square rounded-xl flex items-center justify-center text-4xl leading-none overflow-hidden active:scale-90 transition ${active ? `ring-2 ${ring} bg-white` : 'bg-transparent'}`}>
                    {variant}
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
