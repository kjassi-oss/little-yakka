// Where to send someone who doesn't have the app yet.
export const APP_STORE_URL = 'https://apps.apple.com/app/id6787948287'
// Android isn't published yet — see GOOGLE-PLAY.md. Until it is, Android users
// run the site itself (it's a full PWA), so we don't offer a Play link.
export const PLAY_STORE_URL = ''

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
