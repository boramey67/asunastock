import { useState } from 'react'
import { ImageOff, X } from 'lucide-react'

export function Thumb({ src, size = 36, className = '' }) {
  const [hover, setHover] = useState(false)
  const [open, setOpen] = useState(false)

  if (!src) {
    return (
      <div className={`bg-sand rounded-lg flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
        <ImageOff size={size * 0.4} className="text-line" />
      </div>
    )
  }

  return (
    <div className="relative shrink-0" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={`rounded-lg object-cover cursor-pointer ${className}`}
        style={{ width: size, height: size }}
      />
      {hover && (
        <div className="hidden md:block absolute z-40 left-full top-0 ml-2 pointer-events-none">
          <img src={src} alt="" className="w-40 h-40 object-cover rounded-xl shadow-lg border border-line" />
        </div>
      )}
      {open && (
        <div
          className="fixed inset-0 bg-ink/70 z-50 flex items-center justify-center p-6"
          onClick={(e) => { e.stopPropagation(); setOpen(false) }}
        >
          <img src={src} alt="" className="max-w-full max-h-full rounded-2xl" />
          <button className="absolute top-6 right-6 text-white" onClick={() => setOpen(false)}>
            <X size={28} />
          </button>
        </div>
      )}
    </div>
  )
}
