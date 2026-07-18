'use client'

import { useEffect } from 'react'

// Each theme drives the WHOLE app via CSS variables:
//   --theme-from / --theme-to  → solid accent colours (text, borders, fills)
//   --theme-gradient           → the big header/button gradient (can be multi-stop)
//
// The Little Yakka brand palette (2026 logo):
//   cyan #28BCE6 · yellow #F6B11F · purple #8B51D1 · coral #F35C77
//   green #4BB543 · royal blue #1976D2 · navy #0B4EA2
// Princess Pink stays deliberately off-palette (kept by request).
export const BRAND = {
  cyan: '#28BCE6', yellow: '#F6B11F', purple: '#8B51D1', coral: '#F35C77',
  green: '#4BB543', blue: '#1976D2', navy: '#0B4EA2',
} as const

export const THEMES = {
  rainbow:  { name: 'Rainbow',        emoji: '🌈', from: '#F35C77', to: '#8B51D1', gradient: 'linear-gradient(135deg, #F35C77, #F6B11F, #4BB543, #28BCE6, #1976D2, #8B51D1)' },
  candy:    { name: 'Candy Pop',      emoji: '🍭', from: '#F35C77', to: '#F6B11F', gradient: 'linear-gradient(135deg, #F35C77, #F6B11F)' },
  princess: { name: 'Princess Pink',  emoji: '👑', from: '#E84393', to: '#FF7AC6', gradient: 'linear-gradient(135deg, #F368E0, #FF8FB1)' },
  rockstar: { name: 'Rock Star Blue', emoji: '🎸', from: '#0B4EA2', to: '#1976D2', gradient: 'linear-gradient(135deg, #0B4EA2, #1976D2)' },
  sunshine: { name: 'Sunshine',       emoji: '☀️', from: '#F6B11F', to: '#F35C77', gradient: 'linear-gradient(135deg, #F6B11F, #F35C77)' },
  mint:     { name: 'Minty Fresh',    emoji: '🍃', from: '#4BB543', to: '#28BCE6', gradient: 'linear-gradient(135deg, #4BB543, #28BCE6)' },
  galaxy:   { name: 'Galaxy',         emoji: '🌌', from: '#8B51D1', to: '#F35C77', gradient: 'linear-gradient(135deg, #8B51D1, #F35C77)' },
  ocean:    { name: 'Ocean',          emoji: '🌊', from: '#1976D2', to: '#28BCE6', gradient: 'linear-gradient(135deg, #1976D2, #28BCE6)' },
} as const

export type ThemeKey = keyof typeof THEMES
const DEFAULT_THEME: ThemeKey = 'ocean'

// "#0EA5E9" → "14, 165, 233"
function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

function applyTheme(key: string) {
  const theme = THEMES[key as ThemeKey] ?? THEMES[DEFAULT_THEME]
  const root = document.documentElement
  root.setAttribute('data-theme', key)
  root.style.setProperty('--theme-from', theme.from)
  root.style.setProperty('--theme-to', theme.to)
  root.style.setProperty('--theme-gradient', theme.gradient)
  // Channels only, so tints can be built with rgba(var(--theme-from-rgb), 0.08).
  // `var(--theme-from)14` LOOKS like it appends an alpha byte but is invalid CSS —
  // it silently computes to transparent, which is why themed tints never showed.
  root.style.setProperty('--theme-from-rgb', hexToRgb(theme.from))
  root.style.setProperty('--theme-to-rgb', hexToRgb(theme.to))
}

export function getStoredTheme(): ThemeKey {
  try { return (localStorage.getItem('ly-theme') as ThemeKey) || DEFAULT_THEME } catch { return DEFAULT_THEME }
}

export function setStoredTheme(key: ThemeKey) {
  try { localStorage.setItem('ly-theme', key) } catch {}
  applyTheme(key)
  window.dispatchEvent(new CustomEvent('ly-theme-change', { detail: key }))
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme(getStoredTheme())
    const handler = (e: Event) => applyTheme((e as CustomEvent).detail)
    window.addEventListener('ly-theme-change', handler)
    return () => window.removeEventListener('ly-theme-change', handler)
  }, [])

  return <>{children}</>
}
