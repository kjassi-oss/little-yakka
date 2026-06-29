'use client'

export default function LoadingLogo() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      <img
        src="/logo.png"
        alt="Little Yakka"
        className="h-20 w-auto"
        style={{ animation: 'logoBouncePulse 0.9s ease-in-out infinite alternate' }}
      />
      <style>{`
        @keyframes logoBouncePulse {
          0%   { transform: translateY(0px) scale(1); opacity: 1; }
          100% { transform: translateY(-18px) scale(1.06); opacity: 0.85; }
        }
      `}</style>
    </div>
  )
}
