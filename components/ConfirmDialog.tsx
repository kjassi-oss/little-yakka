'use client'

// Themed replacement for the browser's confirm()/alert() popups so every
// dialog in the app looks the same (matches the 'i' info popups).
//
// Confirm mode (onConfirm set): secondary cancel + primary confirm button —
// red when `danger` (destructive actions), theme gradient otherwise.
// Alert mode (`alert: true`): a single "Got it!" gradient button.
//
// The dialog does NOT auto-close on confirm — close it inside onConfirm
// (matches the app's existing handlers, which need to close before awaiting).
export interface DialogAsk {
  emoji?: string
  title: string
  sub?: string
  confirmLabel?: string // default "Yes"
  cancelLabel?: string  // default "Cancel"
  danger?: boolean
  alert?: boolean
  onConfirm?: () => void
}

export default function ConfirmDialog({ ask, onClose }: { ask: DialogAsk | null; onClose: () => void }) {
  if (!ask) return null
  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl pop-in text-center" onClick={e => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl bg-white"
          style={{ border: '2px solid var(--theme-from)' }}>{ask.emoji || '❓'}</div>
        <h3 className="text-lg font-black text-gray-800 leading-tight mb-1">{ask.title}</h3>
        {ask.sub && <p className="text-sm font-semibold text-gray-400 mb-5">{ask.sub}</p>}
        {ask.alert ? (
          <button onClick={onClose}
            className="w-full py-3 rounded-2xl font-black text-sm text-white shadow active:scale-95 transition"
            style={{ background: 'var(--theme-gradient)' }}>
            Got it!
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-5 py-3 rounded-2xl font-black text-sm text-gray-500 border-2 border-gray-200 bg-white active:scale-95 transition">
              {ask.cancelLabel || 'Cancel'}
            </button>
            <button onClick={ask.onConfirm}
              className="flex-1 py-3 rounded-2xl font-black text-sm text-white shadow active:scale-95 transition"
              style={ask.danger ? { background: '#EF4444' } : { background: 'var(--theme-gradient)' }}>
              {ask.confirmLabel || 'Yes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
