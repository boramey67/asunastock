import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { Undo2 } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timeoutRef = useRef(null)

  const showUndo = useCallback((message, onUndo) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setToast({ message, onUndo })
    timeoutRef.current = setTimeout(() => setToast(null), 6000)
  }, [])

  function handleUndo() {
    toast?.onUndo?.()
    setToast(null)
  }

  return (
    <ToastContext.Provider value={{ showUndo }}>
      {children}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-4 text-sm">
          <span>{toast.message}</span>
          <button onClick={handleUndo} className="flex items-center gap-1 font-medium text-cream underline">
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
