'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const QUICK_PRAISES = [
  "You're doing amazing! 🌟",
  "I'm so proud of you! 💛",
  "You're my superstar! ⭐",
  "Keep it up, champion! 🏆",
  "You make me so happy! 😊",
  "You're unstoppable! 🚀",
  "What a legend you are! 🦁",
  "I love you to the moon! 🌙",
]

interface Props {
  childId: string
  childName: string
  childColour: string
  variant?: 'pill' | 'icon'
}

export default function PraiseButton({ childId, childName, childColour, variant = 'pill' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function sendPraise(message: string) {
    if (!message.trim() || sending) return
    setSending(true)
    const supabase = createClient()
    const { error } = await supabase.from('praises').insert({ child_id: childId, message: message.trim() })
    setSending(false)
    if (error) { alert(`Couldn't send praise: ${error.message}`); return }
    // Purge the client router cache so the kid's zone refetches and shows the
    // praise immediately (a recently-visited zone would otherwise be served
    // from the 30s stale cache without it)
    router.refresh()
    setSent(true)
    setCustom('')
    setTimeout(() => { setSent(false); setOpen(false) }, 1500)
  }

  function openSheet(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }

  return (
    <>
      {variant === 'icon' ? (
        <button onClick={openSheet} aria-label={`Send praise to ${childName.split(' ')[0]}`}
          className="w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-sm active:scale-90 transition">
          ❤️
        </button>
      ) : (
        <button onClick={openSheet}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full active:scale-90 transition"
          style={{ backgroundColor: childColour + '20', color: childColour }}>
          ❤️ Send praise
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"/>
            <h3 className="font-black text-gray-800 text-lg mb-1">Send praise to {childName.split(' ')[0]} ❤️</h3>
            <p className="text-gray-400 text-sm mb-4">They'll see it next time they open their zone</p>

            {sent ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-2">💌</div>
                <p className="font-bold text-gray-700">Praise sent!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {QUICK_PRAISES.map(msg => (
                    <button key={msg} onClick={() => sendPraise(msg)} disabled={sending}
                      className="text-left text-xs font-medium text-gray-700 bg-gray-50 rounded-2xl p-3 leading-snug active:scale-95 transition border border-gray-100">
                      {msg}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={custom} onChange={e => setCustom(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    placeholder="Write your own..."/>
                  <button onClick={() => sendPraise(custom)} disabled={!custom.trim() || sending}
                    className="text-white font-bold px-4 rounded-2xl disabled:opacity-40 active:scale-95 transition"
                    style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
