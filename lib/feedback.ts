// Lightweight, asset-free completion feedback: a short happy chime + a haptic buzz.
// Safe to call from any click handler (audio needs a user gesture, which a tap is).
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

function makeCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    return Ctx ? new Ctx() : null
  } catch { return null }
}

function closeSoon(ctx: AudioContext, ms: number) {
  setTimeout(() => { try { ctx.close() } catch {} }, ms)
}

function chime(notes: number[]) {
  const ctx = makeCtx()
  if (!ctx) return
  try {
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
    closeSoon(ctx, 900)
  } catch {}
}

// A short burst of white noise, reused by the applause/cheer generators.
function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

// 👏 Applause — dozens of tiny band-passed noise "claps" scattered over ~1.1s
function applause() {
  const ctx = makeCtx()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const clap = noiseBuffer(ctx, 0.03)
    for (let i = 0; i < 42; i++) {
      const src = ctx.createBufferSource()
      src.buffer = clap
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 900 + Math.random() * 2200
      bp.Q.value = 1.2
      const gain = ctx.createGain()
      // Swell in, tail off — like a real round of applause
      const t = now + Math.pow(Math.random(), 0.7) * 1.1
      const v = 0.05 + Math.random() * 0.14
      gain.gain.setValueAtTime(v, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045)
      src.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
      src.start(t)
    }
    closeSoon(ctx, 1600)
  } catch {}
}

// 🎉 Cheer — a rising crowd swell plus two celebratory slide-whistle whoops
function cheer() {
  const ctx = makeCtx()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    // Crowd bed: 1s of noise through a band-pass that sweeps upward
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 1.1)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.8
    bp.frequency.setValueAtTime(500, now)
    bp.frequency.linearRampToValueAtTime(1400, now + 0.5)
    const bed = ctx.createGain()
    bed.gain.setValueAtTime(0.0001, now)
    bed.gain.exponentialRampToValueAtTime(0.16, now + 0.18)
    bed.gain.exponentialRampToValueAtTime(0.0001, now + 1.05)
    src.connect(bp); bp.connect(bed); bed.connect(ctx.destination)
    src.start(now)
    // Two "woo-hoo" whoops on top
    ;[0.05, 0.32].forEach((d, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const f0 = 500 + i * 120
      osc.frequency.setValueAtTime(f0, now + d)
      osc.frequency.exponentialRampToValueAtTime(f0 * 2.1, now + d + 0.16)
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.4, now + d + 0.3)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, now + d)
      g.gain.exponentialRampToValueAtTime(0.14, now + d + 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.32)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(now + d); osc.stop(now + d + 0.35)
    })
    closeSoon(ctx, 1600)
  } catch {}
}

// 🎰 Jackpot — a fast run of bright coin dings climbing up the scale
function jackpot() {
  const ctx = makeCtx()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const base = [1318.5, 1568, 1760, 2093, 2349.3, 2637, 3136, 3520] // E6→A7-ish run
    base.forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = f
      const g = ctx.createGain()
      const t = now + i * 0.07
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.18)
    })
    // Closing "win" chord
    ;[1046.5, 1318.5, 1568].forEach(f => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = f
      const g = ctx.createGain()
      const t = now + 0.6
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.5)
    })
    closeSoon(ctx, 1400)
  } catch {}
}

// 🎺 Ta-da fanfare — two pickup notes into a held major chord
function fanfare() {
  const ctx = makeCtx()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const note = (f: number, t: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = f
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 2800
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, now + t)
      g.gain.exponentialRampToValueAtTime(vol, now + t + 0.025)
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + dur)
      osc.connect(lp); lp.connect(g); g.connect(ctx.destination)
      osc.start(now + t); osc.stop(now + t + dur + 0.05)
    }
    note(523.25, 0, 0.16, 0.1)     // C5 "ta"
    note(523.25, 0.14, 0.12, 0.08) // C5 "da-"
    ;[523.25, 659.25, 783.99, 1046.5].forEach(f => note(f, 0.28, 0.6, 0.075)) // C major "daaa!"
    closeSoon(ctx, 1300)
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

// Task completed — a random celebration (applause / cheer / jackpot / fanfare /
// the classic chime) + light impact, so every DONE feels a little different.
const CELEBRATIONS = [
  applause,
  cheer,
  jackpot,
  fanfare,
  () => chime([523.25, 659.25, 783.99]), // the original C5·E5·G5 arpeggio
]

export function completionFeedback() {
  CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]()
  buzzImpact(ImpactStyle.Light, [12, 24, 12])
}

// Reward redeemed — bigger, celebratory + success notification haptic
export function redeemFeedback() {
  chime([523.25, 659.25, 783.99, 1046.5]) // C5 · E5 · G5 · C6
  buzzSuccess([15, 30, 15, 30, 40])
}
