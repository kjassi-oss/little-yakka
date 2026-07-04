'use client'

import { useEffect, useState } from 'react'

// The Yakka buddy — a friendly mascot with a time-of-day greeting and a
// message that reacts to how the day is going.
export default function BuddyGreeting({ name, tasksLeft, allDone }: {
  name: string; tasksLeft: number; allDone: boolean
}) {
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => { setHour(new Date().getHours()) }, [])
  if (hour === null) return null

  const time = hour < 12
    ? { emoji: '☀️', greet: 'Good morning' }
    : hour < 17
      ? { emoji: '🌤️', greet: "G'day" }
      : { emoji: '🌙', greet: 'Good evening' }

  const face = allDone ? '🥳' : tasksLeft > 0 ? '🤩' : '😊'
  const message = allDone
    ? "All done — you're a SUPERSTAR!"
    : tasksLeft > 0
      ? `${tasksLeft} to go today — you've got this!`
      : 'Nothing due right now — nice one!'

  return (
    <div className="flex items-center gap-3 px-1">
      <div className="relative flex-shrink-0 buddy-wobble">
        <span className="text-5xl drop-shadow-sm select-none">⭐</span>
        <span className="absolute inset-0 flex items-center justify-center text-xl select-none" style={{ marginTop: 2 }}>{face}</span>
      </div>
      <div className="bg-white rounded-2xl rounded-bl-sm border border-gray-100 shadow-sm px-3 py-2">
        <p className="text-sm font-black text-gray-800 leading-tight">{time.greet}, {name}! {time.emoji}</p>
        <p className="text-xs font-semibold text-gray-500 leading-tight mt-0.5">{message}</p>
      </div>
    </div>
  )
}
