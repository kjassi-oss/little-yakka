// Avatar style-shop catalogue — hats (emoji overlays) and frames (rings),
// bought with stars and equipped on the child's avatar.

export interface HatItem { id: string; emoji: string; name: string; cost: number }
export interface FrameItem { id: string; name: string; cost: number; bg: string }

export const HATS: HatItem[] = [
  { id: 'cap',    emoji: '🧢', name: 'Cool Cap',    cost: 10 },
  { id: 'bow',    emoji: '🎀', name: 'Big Bow',     cost: 15 },
  { id: 'grad',   emoji: '🎓', name: 'Smarty Cap',  cost: 15 },
  { id: 'top',    emoji: '🎩', name: 'Fancy Hat',   cost: 20 },
  { id: 'rocket', emoji: '🚀', name: 'Rocket',      cost: 25 },
  { id: 'crown',  emoji: '👑', name: 'Royal Crown', cost: 30 },
]

export const FRAMES: FrameItem[] = [
  { id: 'theme',   name: 'Team Colours', cost: 10, bg: 'var(--theme-gradient)' },
  { id: 'gold',    name: 'Gold Star',    cost: 15, bg: 'linear-gradient(135deg, #FBBF24, #F59E0B)' },
  { id: 'neon',    name: 'Neon Glow',    cost: 20, bg: 'linear-gradient(135deg, #22C55E, #84CC16)' },
  { id: 'galaxy',  name: 'Galaxy',       cost: 25, bg: 'linear-gradient(135deg, #6D28D9, #C026D3)' },
  { id: 'rainbow', name: 'Rainbow',      cost: 30, bg: 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)' },
]

export const hatById = (id?: string | null) => HATS.find(h => h.id === id) || null
export const frameById = (id?: string | null) => FRAMES.find(f => f.id === id) || null
