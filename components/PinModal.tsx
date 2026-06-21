'use client'

import { useState, useEffect } from 'react'

interface PinModalProps {
  title: string
  onSuccess: () => void
  onCancel: () => void
  checkPin: (pin: string) => Promise<boolean>
}

export default function PinModal({ title, onSuccess, onCancel, checkPin }: PinModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (pin.length === 4 && !loading) {
      setLoading(true)
      checkPin(pin).then(correct => {
        if (correct) {
          onSuccess()
        } else {
          setError('Wrong PIN. Try again.')
          setPin('')
          setLoading(false)
        }
      })
    }
  }, [pin]) // eslint-disable-line

  function handleDigit(digit: string) {
    if (pin.length < 4 && !loading) {
      setPin(p => p + digit)
      setError('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
        <h2 className="text-lg font-bold text-gray-800 text-center mb-1">🔐 {title}</h2>
        <p className="text-sm text-gray-500 text-center mb-6">Enter the 4-digit parent PIN</p>

        <div className="flex justify-center gap-3 mb-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition ${
                pin.length > i ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-gray-200 bg-gray-50'
              }`}
            >
              {pin.length > i ? '•' : ''}
            </div>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

        <div className="grid grid-cols-3 gap-2 mb-3">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button
              key={i}
              onClick={() => {
                if (d === '⌫') { setPin(p => p.slice(0, -1)); setError('') }
                else if (d) handleDigit(d)
              }}
              disabled={loading || d === ''}
              className={`h-14 rounded-2xl font-bold text-xl transition active:scale-95 ${
                !d ? 'invisible' :
                d === '⌫' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' :
                'bg-gray-50 text-gray-800 hover:bg-purple-50 hover:text-purple-600'
              } disabled:opacity-60`}
            >
              {d}
            </button>
          ))}
        </div>

        <button onClick={onCancel} className="w-full text-sm text-gray-400 py-2 hover:text-gray-600 transition">
          Cancel
        </button>
      </div>
    </div>
  )
}
