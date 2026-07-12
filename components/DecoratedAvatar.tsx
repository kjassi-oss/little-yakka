import { hatById, frameById } from '@/lib/styleShop'

interface ChildLike {
  avatar: string
  avatar_url?: string | null
  colour: string
  equipped_hat?: string | null
  equipped_frame?: string | null
}

// A child's avatar with their equipped style-shop hat + frame.
// Pure presentational — safe in both server and client components.
export default function DecoratedAvatar({ child, size = 56, round = false }: {
  child: ChildLike; size?: number; round?: boolean
}) {
  const hat = hatById(child.equipped_hat)
  const frame = frameById(child.equipped_frame)
  const radius = round ? '9999px' : `${Math.round(size * 0.28)}px`
  const inner = frame ? size - 6 : size

  const avatarEl = child.avatar_url ? (
    <img src={child.avatar_url} alt="" className="object-cover"
      style={{ width: inner, height: inner, borderRadius: radius, border: frame ? 'none' : `3px solid ${child.colour}` }}/>
  ) : (
    <div className="flex items-center justify-center bg-white overflow-hidden leading-none"
      style={{ width: inner, height: inner, borderRadius: radius,
        border: frame ? 'none' : `3px solid ${child.colour}`, fontSize: inner * 0.7 }}>
      {child.avatar}
    </div>
  )

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {frame ? (
        <div className="flex items-center justify-center"
          style={{ width: size, height: size, borderRadius: radius, background: frame.bg, padding: 3 }}>
          {avatarEl}
        </div>
      ) : avatarEl}
      {hat && (
        <span className="absolute select-none pointer-events-none drop-shadow"
          style={{ top: -size * 0.32, left: '50%', transform: 'translateX(-50%) rotate(-12deg)', fontSize: size * 0.5 }}>
          {hat.emoji}
        </span>
      )}
    </div>
  )
}
