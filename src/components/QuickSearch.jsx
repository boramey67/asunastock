import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function QuickSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('product_variants')
        .select('id, size, color, barcode, quantity, selling_price, products!inner(name, is_deleted)')
        .eq('is_deleted', false)
        .eq('products.is_deleted', false)
        .or(`barcode.ilike.%${query}%`)
        .limit(8)
      const { data: byName } = await supabase
        .from('product_variants')
        .select('id, size, color, barcode, quantity, selling_price, products!inner(name, is_deleted)')
        .eq('is_deleted', false)
        .eq('products.is_deleted', false)
        .limit(20)
      const nameMatches = (byName || []).filter(v =>
        v.products?.name?.toLowerCase().includes(query.toLowerCase())
      )
      const merged = [...(data || []), ...nameMatches].filter(
        (v, i, arr) => arr.findIndex(x => x.id === v.id) === i
      )
      setResults(merged.slice(0, 8))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-inkfade bg-sand hover:bg-line px-3 py-2 rounded-xl text-sm transition-colors w-full md:w-64"
      >
        <Search size={16} />
        <span>Search barcode or name…</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-ink/40 z-50 flex items-start justify-center pt-20 px-4" onClick={() => setOpen(false)}>
      <div className="card w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border border-line rounded-xl px-3 py-2 mb-3">
          <Search size={18} className="text-inkfade" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a barcode or product name…"
            className="flex-1 outline-none bg-transparent"
          />
          <button onClick={() => setOpen(false)}><X size={18} className="text-inkfade" /></button>
        </div>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {results.map((v) => (
            <button
              key={v.id}
              onClick={() => { setOpen(false); setQuery(''); navigate('/products') }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-sand flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-sm">{v.products?.name} — {v.size}/{v.color}</p>
                <p className="text-xs text-inkfade">{v.barcode}</p>
              </div>
              <span className={`text-xs font-medium ${v.quantity > 0 ? 'text-sage' : 'text-berry'}`}>
                {v.quantity > 0 ? `${v.quantity} in stock` : 'Sold out'}
              </span>
            </button>
          ))}
          {query && results.length === 0 && (
            <p className="text-sm text-inkfade px-3 py-4 text-center">No matches found</p>
          )}
        </div>
      </div>
    </div>
  )
}
