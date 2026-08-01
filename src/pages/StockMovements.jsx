import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatDateTime } from '../lib/helpers'
import { ArrowLeftRight } from 'lucide-react'

const typeColors = {
  restock: 'bg-sage/20 text-sage',
  sale: 'bg-berry/15 text-berryDark',
  return: 'bg-sand text-inkfade',
  adjustment: 'bg-line/50 text-inkfade',
}

export default function StockMovements() {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data }) => {
        setMovements(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = movements.filter((m) => filter === 'all' || m.change_type === filter)

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Stock Movements</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'restock', 'sale', 'return', 'adjustment'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize whitespace-nowrap ${
              filter === f ? 'bg-berry text-cream' : 'bg-sand text-inkfade hover:text-ink'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-inkfade text-sm">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-inkfade">
          <ArrowLeftRight className="mx-auto mb-3 opacity-40" size={40} />
          <p>No movements recorded yet.</p>
        </div>
      )}

      <div className="bg-white/60 border border-line rounded-2xl divide-y divide-line">
        {filtered.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">
                {m.product_name} {m.variant_label && m.variant_label !== '—' ? `· ${m.variant_label}` : ''}
              </p>
              <p className="text-xs text-inkfade truncate">{m.note}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-xs px-2 py-1 rounded-full capitalize ${typeColors[m.change_type] || 'bg-sand text-inkfade'}`}>
                {m.change_type}
              </span>
              <span className={`text-sm font-medium w-12 text-right ${m.quantity_change < 0 ? 'text-berryDark' : 'text-sage'}`}>
                {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
              </span>
              <span className="text-xs text-inkfade w-32 text-right hidden sm:block">{formatDateTime(m.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
