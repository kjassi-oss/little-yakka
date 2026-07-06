// Lightweight, asset-free completion feedback: a short happy chime + a haptic buzz.
// Safe to call from any click handler (audio needs a user gesture, which a tap is).
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

function chime(notes: number[]) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = now + i * 0.09
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
      osc.start(t)
      osc.stop(t + 0.3)
    })
    setTimeout(() => { try { ctx.close() } catch {} }, 900)
  } catch {}
}

// Inside the Capacitor app, use real native haptics (iOS ignores navigator.vibrate).
// In the browser PWA, fall back to the Web Vibration API (works on Android).
function buzzImpact(style: ImpactStyle, webPattern: number | number[]) {
  if (Capacitor.isNativePlatform()) { Haptics.impact({ style }).catch(() => {}); return }
  try { navigator.vibrate?.(webPattern) } catch {}
}

function buzzSuccess(webPattern: number | number[]) {
  if (Capacitor.isNativePlatform()) { Haptics.notification({ type: NotificationType.Success }).catch(() => {}); return }
  try { navigator.vibrate?.(webPattern) } catch {}
}

// Task completed — bright ascending arpeggio + light impact
export function completionFeedback() {
  chime([523.25, 659.25, 783.99]) // C5 · E5 · G5
  buzzImpact(ImpactStyle.Light, [12, 24, 12])
}

// Reward redeemed — bigger, celebratory + success notification haptic
export function redeemFeedback() {
  chime([523.25, 659.25, 783.99, 1046.5]) // C5 · E5 · G5 · C6
  buzzSuccess([15, 30, 15, 30, 40])
}
