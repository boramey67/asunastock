import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, formatDateTime } from '../lib/helpers'
import { ClipboardList } from 'lucide-react'

const statusColors = {
  paid: 'bg-sage/20 text-sage',
  deposit: 'bg-berry/15 text-berryDark',
  unpaid: 'bg-berry/25 text-berryDark',
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = orders.filter((o) => {
    if (filter === 'all') return true
    if (filter === 'returned') return o.is_returned
    return !o.is_returned && o.payment_status === filter
  })

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Orders</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'paid', 'deposit', 'unpaid', 'returned'].map((f) => (
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
          <ClipboardList className="mx-auto mb-3 opacity-40" size={40} />
          <p>No orders here yet.</p>
        </div>
      )}

      <div className="bg-white/60 border border-line rounded-2xl divide-y divide-line">
        {filtered.map((o) => (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-sand/50 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {o.order_number} {o.customer_name && <span className="text-inkfade font-normal">— {o.customer_name}</span>}
              </p>
              <p className="text-xs text-inkfade">{formatDateTime(o.created_at)}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {o.is_returned && (
                <span className="text-xs px-2 py-1 rounded-full bg-sand text-inkfade">Returned</span>
              )}
              <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColors[o.payment_status]}`}>
                {o.payment_status}
              </span>
              <span className="text-sm font-medium text-ink w-20 text-right">{formatMoney(o.total, o.currency)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
