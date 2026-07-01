// Lightweight, asset-free completion feedback: a short happy chime + a haptic buzz.
// Safe to call from any click handler (audio needs a user gesture, which a tap is).

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

function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch {}
}

// Task completed — bright ascending arpeggio + light double-tap buzz
export function completionFeedback() {
  chime([523.25, 659.25, 783.99]) // C5 · E5 · G5
  buzz([12, 24, 12])
}

// Reward redeemed — bigger, celebratory
export function redeemFeedback() {
  chime([523.25, 659.25, 783.99, 1046.5]) // C5 · E5 · G5 · C6
  buzz([15, 30, 15, 30, 40])
}
