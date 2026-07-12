'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Kid { id: string; name: string; avatar: string; colour: string; avatar_url?: string | null }

// Wraps any task row/card. Tapping it jumps into the kid zone for that task.
// One kid → straight in. Several → a quick picker (with a back option).
export default function TaskLauncher({ taskId, kids, children }: {
  taskId: string; kids: Kid[]; children: React.ReactNode
}) {
  const router = useRouter()
  const [picking, setPicking] = useState(false)

  function go() {
    if (kids.length === 1) router.push(`/kid-mode/${kids[0].id}?task=${taskId}`)
    else if (kids.length === 0) router.push('/kid-mode')
    else setPicking(true)
  }

  return (
    <>
      <div onClick={go} className="cursor-pointer">{children}</div>

      {picking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setPicking(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pop-in" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"/>
            <h3 className="font-black text-gray-800 text-lg mb-1">Who's doing this? ⭐</h3>
            <p className="text-gray-400 text-sm mb-4">Tap a child to enter their zone</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {kids.map(k => (
                <button key={k.id} onClick={() => router.push(`/kid-mode/${k.id}?task=${taskId}`)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition">
                  {k.avatar_url
                    ? <img src={k.avatar_url} className="w-16 h-16 rounded-2xl object-cover" style={{ border: `3px solid ${k.colour}` }} alt=""/>
                    : <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-[42px] leading-none overflow-hidden bg-white"
                        style={{ border: `3px solid ${k.colour}` }}>{k.avatar}</div>}
                  <span className="text-xs font-bold text-gray-700 truncate max-w-full">{k.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPicking(false)}
              className="w-full text-gray-500 font-semibold py-3 rounded-2xl border border-gray-200 active:scale-95 transition">
              ← Back
            </button>
          </div>
        </div>
      )}
    </>
  )
}
