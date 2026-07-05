'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteUserAccount } from './actions'

interface UserRow {
  authUserId: string
  email: string
  name: string
  family: string
  familyId: string | null
  kids: { id: string; name: string; avatar: string; avatar_url?: string }[]
  created: string
  lastSignIn: string
  isAdmin: boolean
  tasksCount: number
  rewardsCount: number
  redeemedCount: number
  lastActivity: string
}

export default function AdminUserList({ rows }: { rows: UserRow[] }) {
  const router = useRouter()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const confirmRow = rows.find(r => r.authUserId === confirmId)

  async function handleDelete(authUserId: string) {
    setDeleting(authUserId)
    setErrorMsg(null)
    const result = await deleteUserAccount(authUserId)
    setDeleting(null)
    setConfirmId(null)
    if (result.error) {
      setErrorMsg(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <>
      {errorMsg && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600 font-semibold">
          ⚠️ {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="ml-2 text-red-400 font-black">×</button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        {rows.length === 0 && (
          <p className="p-6 text-center text-gray-400 text-sm">No registered users yet.</p>
        )}
        {rows.map((r, i) => (
          <div key={r.authUserId} className={`px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-800 text-sm truncate">{r.name}</p>
                <p className="text-xs text-gray-400 truncate">{r.email}</p>
              </div>
              <div className="text-right flex-shrink-0 min-w-0">
                <p className="text-xs font-semibold text-gray-600 truncate max-w-[130px]">{r.family}</p>
                <p className="text-[11px] text-gray-400">joined {r.created}</p>
              </div>
              {!r.isAdmin && (
                <button
                  onClick={() => setConfirmId(r.authUserId)}
                  disabled={!!deleting}
                  className="flex-shrink-0 w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center text-base hover:bg-red-100 active:scale-90 transition disabled:opacity-40"
                  title="Delete account">
                  🗑️
                </button>
              )}
              {r.isAdmin && (
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-base" title="Admin — cannot delete">
                  🔒
                </div>
              )}
            </div>
            {r.kids.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {r.kids.map(k => (
                  <span key={k.id} className="inline-flex items-center gap-1 text-[11px] bg-gray-50 rounded-full px-2 py-0.5 text-gray-600">
                    {k.avatar_url
                      ? <img src={k.avatar_url} className="w-4 h-4 rounded-full object-cover" alt=""/>
                      : <span>{k.avatar}</span>}
                    {k.name}
                  </span>
                ))}
              </div>
            )}
            {/* Usage stats */}
            {r.familyId && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                📋 {r.tasksCount} task{r.tasksCount !== 1 ? 's' : ''} · 🎁 {r.rewardsCount} reward{r.rewardsCount !== 1 ? 's' : ''} · ✅ {r.redeemedCount} redeemed · ⏱ last active {r.lastActivity}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmId && confirmRow && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setConfirmId(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-4xl text-center mb-3">⚠️</div>
            <h2 className="text-lg font-black text-gray-800 text-center mb-1">Delete this account?</h2>
            <p className="text-sm text-gray-500 text-center mb-4">
              <span className="font-semibold text-gray-700">{confirmRow.email}</span>
            </p>

            <div className="bg-red-50 rounded-2xl p-3 mb-4 text-xs text-red-700 space-y-1">
              <p className="font-bold text-red-800">This will permanently delete:</p>
              <p>• Their login account</p>
              {confirmRow.familyId && (
                <>
                  <p>• Family: <span className="font-semibold">{confirmRow.family}</span></p>
                  {confirmRow.kids.length > 0 && (
                    <p>• {confirmRow.kids.length} child profile{confirmRow.kids.length !== 1 ? 's' : ''}: {confirmRow.kids.map(k => k.name).join(', ')}</p>
                  )}
                  <p>• All tasks, completions, stars, and rewards</p>
                  <p className="font-semibold text-red-900">This cannot be undone.</p>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmId(null)}
                disabled={!!deleting}
                className="flex-1 border border-gray-200 text-gray-500 font-semibold py-3 rounded-2xl active:scale-95 transition disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmRow.authUserId)}
                disabled={!!deleting}
                className="flex-1 bg-red-500 text-white font-black py-3 rounded-2xl active:scale-95 transition disabled:opacity-50">
                {deleting === confirmRow.authUserId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
