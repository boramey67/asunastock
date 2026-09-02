import { useState } from 'react'
import { X } from 'lucide-react'

const STEPS = [
  { title: 'Welcome to Stock Tracker', body: 'This app tracks your inventory, sales, and profit — all in one place, updating in real time as you use it.' },
  { title: 'Add your products', body: 'Go to Products → Add Product. Each product can have multiple variants (size/color), each with its own stock count and barcode.' },
  { title: 'Log a Sale', body: 'When something sells, use Log a Sale — search by barcode or name, add it to the cart, and stock updates automatically.' },
  { title: 'Check the Dashboard anytime', body: 'Income, profit, low stock, and recent activity are all summarized on the Dashboard — that\'s your daily home base.' },
]

export default function Walkthrough() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('walkthroughSeen') === 'true')
  const [step, setStep] = useState(0)

  if (dismissed) return null

  function finish() {
    localStorage.setItem('walkthroughSeen', 'true')
    setDismissed(true)
  }

  const current = STEPS[step]

  return (
    <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6 relative">
        <button onClick={finish} className="absolute top-4 right-4 text-inkfade hover:text-ink"><X size={18} /></button>
        <p className="text-xs text-inkfade mb-2">Step {step + 1} of {STEPS.length}</p>
        <h3 className="font-display text-lg font-semibold mb-2">{current.title}</h3>
        <p className="text-sm text-inkfade mb-6">{current.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-berry' : 'bg-line'}`} />
            ))}
          </div>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="btn-primary text-sm py-1.5">Next</button>
          ) : (
            <button onClick={finish} className="btn-primary text-sm py-1.5">Get started</button>
          )}
        </div>
      </div>
    </div>
  )
}
