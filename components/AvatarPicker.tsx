'use client'

import { PICKER_AVATARS } from '@/lib/kidAvatars'

// Shared kid-avatar picker — 12 illustrated kid portraits (6 girls then
// 6 boys), 6 per row. Tap to pick. `value`/`onChange` carry the avatar's
// public path (e.g. /avatars/kid-g1.webp) — callers store it in
// children.avatar_url.
//
// (The old long-press skin-tone switcher only worked with the generated SVG
// set, where every face shipped in six tones; these are finished paintings
// with the skin tone baked in, so the set itself carries the diversity.)

// iOS: no grey tap flash / text selection on press
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
  const ring = accent === 'pink' ? 'ring-pink-400' : 'ring-purple-400'

  return (
    <div style={NO_SELECT}>
      <div className="grid grid-cols-6 gap-1.5">
        {PICKER_AVATARS.map(path => {
          const sel = value === path
          return (
            <button key={path} type="button" style={NO_SELECT}
              onClick={() => onChange(path)} onContextMenu={e => e.preventDefault()}
              className={`aspect-square rounded-full p-0.5 select-none transition active:scale-90 ${sel ? `ring-2 ${ring} bg-white` : ''}`}>
              <img src={path} alt="" draggable={false}
                className="w-full h-full rounded-full object-cover pointer-events-none"/>
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 text-center">Tap to pick an avatar</p>
    </div>
  )
}
