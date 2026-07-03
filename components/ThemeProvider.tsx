'use client'

import { useEffect } from 'react'

// Each theme drives the WHOLE app via CSS variables:
//   --theme-from / --theme-to  → solid accent colours (text, borders, fills)
//   --theme-gradient           → the big header/button gradient (can be multi-stop)
export const THEMES = {
  rainbow:  { name: 'Rainbow',        emoji: '🌈', from: '#D6336C', to: '#7048E8', gradient: 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)' },
  candy:    { name: 'Candy Pop',      emoji: '🍭', from: '#EC4899', to: '#8B5CF6', gradient: 'linear-gradient(135deg, #EC4899, #8B5CF6)' },
  princess: { name: 'Princess Pink',  emoji: '👑', from: '#E84393', to: '#FF7AC6', gradient: 'linear-gradient(135deg, #F368E0, #FF8FB1)' },
  rockstar: { name: 'Rock Star Blue', emoji: '🎸', from: '#2563EB', to: '#06B6D4', gradient: 'linear-gradient(135deg, #2563EB, #06B6D4)' },
  sunshine: { name: 'Sunshine',       emoji: '☀️', from: '#F97316', to: '#FBBF24', gradient: 'linear-gradient(135deg, #F97316, #FBBF24)' },
  mint:     { name: 'Minty Fresh',    emoji: '🍃', from: '#059669', to: '#34D399', gradient: 'linear-gradient(135deg, #059669, #34D399)' },
  galaxy:   { name: 'Galaxy',         emoji: '🌌', from: '#6D28D9', to: '#C026D3', gradient: 'linear-gradient(135deg, #6D28D9, #C026D3)' },
  ocean:    { name: 'Ocean',          emoji: '🌊', from: '#0EA5E9', to: '#2563EB', gradient: 'linear-gradient(135deg, #0EA5E9, #2563EB)' },
} as const

export type ThemeKey = keyof typeof THEMES
const DEFAULT_THEME: ThemeKey = 'ocean'

function applyTheme(key: string) {
  const theme = THEMES[key as ThemeKey] ?? THEMES[DEFAULT_THEME]
  const root = document.documentElement
  root.setAttribute('data-theme', key)
  root.style.setProperty('--theme-from', theme.from)
  root.style.setProperty('--theme-to', theme.to)
  root.style.setProperty('--theme-gradient', theme.gradient)
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
