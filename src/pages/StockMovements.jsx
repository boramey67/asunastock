import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMoney, dayKey } from '../lib/helpers'
import { ArrowUp, ArrowDown, RefreshCw, ShoppingCart, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Thumb } from '../components/Thumb'

const reasonLabels = { restock: 'Stock added', sale: 'Sold', return: 'Returned', adjustment: 'Adjusted' }
const reasonIcons = { restock: ArrowUp, sale: ShoppingCart, return: RotateCcw, adjustment: SlidersHorizontal }

export default function StockMovements() {
  const navigate = useNavigate()
  const { logActivity } = useAuth()
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [reasonFilter, setReasonFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    supabase
      .from('stock_movements')
      .select('*, product_variants(id, size, color, photo_url, products(name)), profiles(name)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => { setMovements(data || []); setLoading(false) })
  }, [])

  async function deleteMovement(m, e) {
    e.stopPropagation()
    if (!confirm('Delete this log entry? This only removes the record — it does not change current stock. Use Adjust for real stock corrections.')) return
    await supabase.from('stock_movements').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', m.id)
    logActivity('deleted_stock_movement', 'stock_movement', m.id, {})
    setMovements(movements.filter(x => x.id !== m.id))
  }

  const levelAfterMap = useMemo(() => {
    const byVariant = {}
    ;[...movements].reverse().forEach(m => {
      const vid = m.variant_id
      byVariant[vid] = (byVariant[vid] || 0) + m.change_qty
      m._levelAfter = byVariant[vid]
    })
    return byVariant
  }, [movements])

  const filtered = movements.filter(m => {
    const matchesReason = reasonFilter === 'all' || m.reason === reasonFilter
    const matchesProduct = !productFilter.trim() || (m.product_variants?.products?.name || '').toLowerCase().includes(productFilter.toLowerCase())
    const day = dayKey(m.created_at)
    const matchesFrom = !dateFrom || day >= dateFrom
    const matchesTo = !dateTo || day <= dateTo
    return matchesReason && matchesProduct && matchesFrom && matchesTo
  })

  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(m => {
      const key = dayKey(m.created_at)
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const totals = filtered.reduce((acc, m) => {
    if (m.change_qty > 0) acc.added += m.change_qty
    else acc.removed += Math.abs(m.change_qty)
    return acc
  }, { added: 0, removed: 0 })

  function dateLabel(key) {
    const today = dayKey(new Date().toISOString())
    const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString())
    if (key === today) return 'Today'
    if (key === yesterday) return 'Yesterday'
    return key
  }

  function goToRelated(m) {
    if (m.related_order_id) navigate('/orders')
    else if (m.related_restock_id && m.product_variants?.id) navigate(`/products/${m.product_variants.id}/edit`)
    else if (m.product_variants) navigate('/products')
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-1">Stock Movements</h1>
      <p className="text-inkfade text-sm mb-4">Every change to your inventory — added, sold, returned, adjusted.</p>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {['all', 'restock', 'sale', 'return', 'adjustment'].map(r => (
          <button key={r} onClick={() => setReasonFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${reasonFilter === r ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>
            {r === 'all' ? 'All' : reasonLabels[r]}
          </button>
        ))}
        <input className="input py-1.5 text-xs w-40" placeholder="Filter by product…" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} />
        <input type="date" className="input py-1.5 text-xs w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-xs text-inkfade">to</span>
        <input type="date" className="input py-1.5 text-xs w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <p className="text-xs text-inkfade mb-4">
        <span className="text-sage">+{totals.added} added</span> · <span className="text-berry">-{totals.removed} removed</span> · net {totals.added - totals.removed >= 0 ? '+' : ''}{totals.added - totals.removed}
      </p>

      {loading ? (
        <p className="text-inkfade text-sm">Loading…</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <p className="text-xs font-medium text-inkfade mb-2">{dateLabel(day)}</p>
              <div className="card divide-y divide-line">
                {items.map((m) => {
                  const Icon = reasonIcons[m.reason] || RefreshCw
                  return (
                    <div key={m.id} onClick={() => goToRelated(m)} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-cream/60">
                      <div className="flex items-center gap-3">
                        <Thumb src={m.product_variants?.photo_url} size={32} />
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${m.change_qty > 0 ? 'bg-sage/15 text-sage' : 'bg-berry/15 text-berry'}`}>
                          <Icon size={13} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.product_variants?.products?.name} — {m.product_variants?.size}/{m.product_variants?.color}</p>
                          <p className="text-xs text-inkfade">{reasonLabels[m.reason] || m.reason} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {m.profiles?.name || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <span className={`font-medium text-sm block ${m.change_qty > 0 ? 'text-sage' : 'text-berry'}`}>
                            {m.change_qty > 0 ? '+' : ''}{m.change_qty}
                          </span>
                          <span className="text-[11px] text-inkfade">now {m._levelAfter}</span>
                        </div>
                        <button onClick={(e) => deleteMovement(m, e)} className="text-inkfade hover:text-berry"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {grouped.length === 0 && <p className="text-center text-inkfade text-sm py-8">No stock movements match.</p>}
        </div>
      )}
    </div>
  )
}
