// Sending the co-parent invite link out of the app.
//
// Three routes, best first:
//   1. The Capacitor native share sheet (Messages, WhatsApp, Mail, AirDrop…).
//      This is a native plugin, so it only answers once a build containing it
//      is installed — until then it throws "not implemented" and we fall through.
//   2. The Web Share API, for the browser/PWA.
//   3. An `sms:` link, which needs nothing new: Capacitor cancels navigations to
//      schemes it doesn't own and hands them to the OS (WebViewDelegationHandler),
//      so Messages opens with the invite already typed out.

export type ShareResult = 'shared' | 'sms'

export function inviteMessage(link: string, familyName?: string): string {
  const family = familyName?.trim() ? ` to ${familyName.trim()}` : ''
  return `Join our family${family} on Little Yakka! Tap this link to set yourself up: ${link}`
}

// iOS wants `sms:&body=`; Android and the rest want `sms:?body=`.
export function smsHref(body: string): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return `sms:${isIOS ? '&' : '?'}body=${encodeURIComponent(body)}`
}

export async function shareInviteLink(link: string, familyName?: string): Promise<ShareResult> {
  const text = inviteMessage(link, familyName)

  // 1) Native share sheet
  try {
    const { Share } = await import('@capacitor/share')
    if ((await Share.canShare()).value) {
      // Dismissing the sheet rejects — that's a decision, not a failure, so
      // don't fall through and open Messages on top of it.
      try { await Share.share({ title: 'Little Yakka invite', text, dialogTitle: 'Send the invite' }) } catch {}
      return 'shared'
    }
  } catch {}

  // 2) Web Share API (browser / installed PWA)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try { await navigator.share({ title: 'Little Yakka invite', text }) } catch {}
    return 'shared'
  }

  // 3) Text message
  window.location.href = smsHref(text)
  return 'sms'
}
