// VAPID public key — safe to ship to the browser (the private key lives only
// in env as VAPID_PRIVATE_KEY). Regenerate both with: npx web-push generate-vapid-keys
export const VAPID_PUBLIC_KEY =
  'BFJ4OXuKXhKCfYHNYlmZGQwbCZxEP-qbDL625b0VWjxTveJFZtodnm4wjalCuvu6OvwPhlSRvcnx3v87SeaGqVQ'

// Convert the base64url VAPID key into the Uint8Array PushManager expects
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}
