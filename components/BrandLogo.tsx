'use client'

import { useState } from 'react'
import Logo from './Logo'

// Uses the uploaded /logo.png if present; falls back to the built-in SVG logo
// so nothing breaks before the file is added.
export default function BrandLogo({ className = '', fallbackSize = 200 }: { className?: string; fallbackSize?: number }) {
  const [err, setErr] = useState(false)
  if (err) return <Logo size={fallbackSize} rainbow className={className} />
  return (
    <img src="/logo.png" alt="Little Yakka" className={className} onError={() => setErr(true)} />
  )
}
