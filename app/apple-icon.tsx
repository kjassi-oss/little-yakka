import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS "Add to Home Screen" uses this. Rainbow tile + white high-five star.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polygon
            points="50,8 61,38 93,38 67,58 77,90 50,70 23,90 33,58 7,38 39,38"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    { ...size }
  )
}
