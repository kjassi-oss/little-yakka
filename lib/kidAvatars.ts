// 15 bundled cartoon kid avatars — "Custom Avatar" by Ashley Seo (CC BY 4.0),
// generated via DiceBear "big-smile" and stored in /public/avatars as
// kid{i}-t{tone}.svg. Tones run 0 (lightest) → 5 (deepest); each kid ships in
// all six so a long-press can switch skin tone.
export const AVATAR_KIDS = 15
export const TONE_COUNT = 6

// Default tone per kid (index 0 = kid1) — mixed so the picker looks diverse
export const DEFAULT_TONES = [2, 4, 0, 1, 2, 5, 1, 1, 5, 0, 2, 4, 3, 3, 1]

export function kidAvatarPath(kid: number, tone: number): string {
  return `/avatars/kid${kid}-t${tone}.svg`
}

export function isKidAvatar(v: string | null | undefined): boolean {
  return !!v && v.startsWith('/avatars/kid')
}

export function parseKidAvatar(v: string): { kid: number; tone: number } | null {
  const m = /^\/avatars\/kid(\d+)-t(\d)\.svg$/.exec(v)
  return m ? { kid: Number(m[1]), tone: Number(m[2]) } : null
}
