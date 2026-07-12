'use client'

import { useRef, useState } from 'react'

// Shared kid-avatar picker — 15 fun avatars (7 girls, 7 boys + a clown), 5 per
// row. Tap to pick; HOLD (long-press) a human avatar to choose a skin tone.
export const KID_AVATARS = [
  '👧', '👦', '🦸‍♀️', '🦸‍♂️', '🤡',
  '👸', '🤴', '🧚‍♀️', '🥷', '🤠',
  '🧜‍♀️', '🧙‍♀️', '🧙‍♂️', '👩‍🚀', '👨‍🚀',
]

// Smiley-style faces don't take skin-tone modifiers
const NO_TONE = new Set(['🤡', '🤠'])
const TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿']

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
  const ring = accent === 'pink' ? 'ring-pink-400' : 'ring-purple-400'
  const selBase = stripTone(value)

  function press(base: string) {
    longPressed.current = false
    if (NO_TONE.has(base)) return
    timer.current = setTimeout(() => { longPressed.current = true; setTonePick(base) }, 450)
  }
  function release() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }
  function tap(base: string) {
    if (longPressed.current) { longPressed.current = false; return } // long-press already opened the popup
    onChange(base)
  }

  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5" style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}>
        {KID_AVATARS.map(a => {
          const sel = selBase === a
          return (
            <button key={a} type="button"
              onPointerDown={() => press(a)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
              onClick={() => tap(a)} onContextMenu={e => e.preventDefault()}
              className={`aspect-square rounded-xl flex items-center justify-center text-4xl leading-none select-none transition ${sel ? `ring-2 ${ring} bg-white` : 'bg-gray-50 hover:bg-gray-100'}`}>
              {sel ? value : a}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 text-center">Tap to pick · hold to choose a skin tone</p>

      {/* Skin-tone popup (long-press) */}
      {tonePick && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-6" onClick={() => setTonePick(null)}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-xs text-center pop-in" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-gray-700 mb-3">Pick a skin tone</p>
            <div className="grid grid-cols-6 gap-1.5">
              {TONES.map(t => (
                <button key={t || 'default'} type="button"
                  onClick={() => { onChange(applyTone(tonePick, t)); setTonePick(null) }}
                  className="aspect-square rounded-xl bg-gray-50 flex items-center justify-center text-2xl leading-none active:scale-90 transition">
                  {applyTone(tonePick, t)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
