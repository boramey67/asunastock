import { X } from 'lucide-react'

export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">{title}</h3>
          <button onClick={onClose} className="text-inkfade hover:text-ink"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
