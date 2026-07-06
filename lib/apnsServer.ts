// Server-only APNs (Apple Push Notifications) sender using token-based auth (.p8 key).
// Sends to native iOS devices; the browser PWA keeps using web-push. Never import client-side.
//
// Required env vars (set in Vercel):
//   APNS_KEY_ID      – 10-char Key ID from the .p8 (e.g. 2T2MT7JX3L)
//   APNS_TEAM_ID     – 10-char Apple Team ID (e.g. 9D5QNNA5ZT)
//   APNS_BUNDLE_ID   – app bundle id (defaults to com.littleyakka.app)
//   APNS_PRIVATE_KEY – full contents of the AuthKey_XXXX.p8 (PEM, BEGIN/END lines)
//   APNS_ENV         – optional; set to "sandbox" only for local dev builds
import http2 from 'node:http2'
import crypto from 'node:crypto'

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function privateKey(): string | null {
  const raw = process.env.APNS_PRIVATE_KEY
  if (!raw || !raw.includes('BEGIN')) return null
  // Vercel may store the PEM with literal "\n" — normalise to real newlines.
  return raw.replace(/\\n/g, '\n')
}

// APNs provider JWTs are reusable for up to 1h; refresh well before that.
let cached: { jwt: string; iat: number } | null = null
function providerToken(): string | null {
  const key = privateKey()
  const kid = process.env.APNS_KEY_ID
  const iss = process.env.APNS_TEAM_ID
  if (!key || !kid || !iss) return null
  const now = Math.floor(Date.now() / 1000)
  if (cached && now - cached.iat < 2400) return cached.jwt // reuse < 40 min
  const signingInput = `${b64url(JSON.stringify({ alg: 'ES256', kid }))}.${b64url(JSON.stringify({ iss, iat: now }))}`
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' })
  const jwt = `${signingInput}.${b64url(sig)}`
  cached = { jwt, iat: now }
  return jwt
}

const HOST = process.env.APNS_ENV === 'sandbox'
  ? 'https://api.sandbox.push.apple.com'
  : 'https://api.push.apple.com'
const BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'com.littleyakka.app'

export interface ApnsResult { token: string; status: number; reason?: string }

// Send one alert to many device tokens over a single HTTP/2 connection.
export async function sendApns(
  tokens: string[],
  payload: { title: string; body: string; url?: string },
): Promise<ApnsResult[]> {
  const jwt = providerToken()
  if (!jwt || !tokens.length) return []

  const client = http2.connect(HOST)
  const body = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
    url: payload.url || '/dashboard',
  })

  try {
    return await Promise.all(tokens.map(token => new Promise<ApnsResult>((resolve) => {
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      })
      let status = 0, data = ''
      req.on('response', (h) => { status = Number(h[':status']) || 0 })
      req.setEncoding('utf8')
      req.on('data', (c) => { data += c })
      req.on('end', () => {
        let reason: string | undefined
        if (data) { try { reason = JSON.parse(data).reason } catch {} }
        resolve({ token, status, reason })
      })
      req.on('error', () => resolve({ token, status: 0, reason: 'request_error' }))
      req.end(body)
    })))
  } finally {
    client.close()
  }
}
