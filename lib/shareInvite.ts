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

// Written for someone who may never have heard of the app: it says what it is,
// and the link itself handles the rest — the join page creates their account in
// the browser and then points them at the App Store, so there's no chicken-and-egg
// where they'd need the app installed before the invite works.
export function inviteMessage(link: string, familyName?: string): string {
  const family = familyName?.trim() ? ` (${familyName.trim()})` : ''
  return `I'm using Little Yakka to run the kids' chores, stars and rewards — join our family${family} here: ${link}\n\nOpen the link first to set up your login, then it'll help you get the app.`
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
