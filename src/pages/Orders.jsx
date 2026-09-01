import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMoney, daysSince } from '../lib/helpers'
import { ChevronDown, ChevronUp, RotateCcw, Flag, Users, Trash2, FileEdit, ArrowRightCircle } from 'lucide-react'
import { Thumb } from '../components/Thumb'

const statusColors = { paid: 'bg-sage/15 text-sage', deposit: 'bg-amber-100 text-amber-700', unpaid: 'bg-berry/15 text-berry' }
const tagColors = { urgent: 'border-l-4 border-berry', follow_up: 'border-l-4 border-amber-400' }
const tagLabels = { urgent: 'Urgent', follow_up: 'Follow up' }

export default function Orders() {
  const { user, logActivity } = useAuth()
  const [orders, setOrders] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [editingQty, setEditingQty] = useState({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [groupByCustomer, setGroupByCustomer] = useState(false)
  const [showDrafts, setShowDrafts] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, product_variants(id, size, color, quantity, photo_url, products(name)))')
      .eq('is_deleted', false)
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const drafts = orders.filter(o => o.status === 'draft')

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (o.status === 'draft') return false
      const matchesStatus = statusFilter === 'all' || o.payment_status === statusFilter
      const matchesFrom = !dateFrom || o.order_date >= dateFrom
      const matchesTo = !dateTo || o.order_date <= dateTo
      const matchesCustomer = !customerSearch.trim() || (o.customer_name || '').toLowerCase().includes(customerSearch.toLowerCase())
      return matchesStatus && matchesFrom && matchesTo && matchesCustomer
    })
  }, [orders, statusFilter, dateFrom, dateTo, customerSearch])

  const filteredTotals = useMemo(() => {
    let items = 0, revenue = 0
    filtered.forEach(o => o.order_items.forEach(i => { items += i.quantity; revenue += Number(i.line_total || 0) }))
    return { items, revenue, count: filtered.length }
  }, [filtered])

  const grouped = useMemo(() => {
    if (!groupByCustomer) return null
    const map = {}
    filtered.forEach(o => {
      const key = o.customer_name || 'No name'
      if (!map[key]) map[key] = []
      map[key].push(o)
    })
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }, [filtered, groupByCustomer])

  async function handleReturn(order) {
    if (order.status === 'returned') return
    if (!confirm(`Return this whole order (${order.customer_name || 'no name'})? Stock will be restored and income reversed.`)) return

    for (const item of order.order_items) {
      const variant = item.product_variants
      if (!variant) continue
      await supabase.from('product_variants').update({ quantity: variant.quantity + item.quantity }).eq('id', variant.id)
      await supabase.from('stock_movements').insert({
        variant_id: variant.id, change_qty: item.quantity, reason: 'return', related_order_id: order.id, created_by: user.id,
      })
    }
    const orderTotal = order.order_items.reduce((s, i) => s + Number(i.line_total || 0), 0)
    await supabase.from('transactions').insert({
      type: 'expense', amount: orderTotal, currency: order.currency, category: 'Return / Refund',
      related_order_id: order.id, note: `Return for order — ${order.customer_name || 'no name'}`, created_by: user.id,
    })
    await supabase.from('orders').update({ status: 'returned' }).eq('id', order.id)
    logActivity('returned_order', 'order', order.id, {})
    load()
  }

  async function deleteOrder(order) {
    if (!confirm(`Delete this order completely? Stock will be restored and income removed, as if it never happened.`)) return
    if (order.status === 'active') {
      for (const item of order.order_items) {
        const variant = item.product_variants
        if (!variant) continue
        await supabase.from('product_variants').update({ quantity: variant.quantity + item.quantity }).eq('id', variant.id)
        await supabase.from('stock_movements').insert({
          variant_id: variant.id, change_qty: item.quantity, reason: 'adjustment',
          related_order_id: order.id, created_by: user.id,
        })
      }
      await supabase.from('transactions').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('related_order_id', order.id).eq('type', 'income')
    }
    await supabase.from('orders').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', order.id)
    logActivity('deleted_order', 'order', order.id, {})
    load()
  }

  async function convertDraft(order) {
    for (const item of order.order_items) {
      const variant = item.product_variants
      if (!variant) continue
      if (item.quantity > variant.quantity) {
        alert(`Not enough stock for ${variant.products?.name} (${variant.size}/${variant.color}) — only ${variant.quantity} left.`)
        return
      }
    }
    for (const item of order.order_items) {
      const variant = item.product_variants
      await supabase.from('product_variants').update({ quantity: variant.quantity - item.quantity }).eq('id', variant.id)
      await supabase.from('stock_movements').insert({
        variant_id: variant.id, change_qty: -item.quantity, reason: 'sale', related_order_id: order.id, created_by: user.id,
      })
    }
    const total = order.order_items.reduce((s, i) => s + Number(i.line_total || 0), 0)
    await supabase.from('transactions').insert({
      type: 'income', amount: total, currency: order.currency, category: 'Sale',
      related_order_id: order.id, note: order.customer_name ? `Sale to ${order.customer_name}` : 'Sale', created_by: user.id,
    })
    await supabase.from('orders').update({ status: 'active' }).eq('id', order.id)
    logActivity('converted_draft', 'order', order.id, {})
    load()
  }

  async function saveQtyEdit(order, item) {
    const newQty = Number(editingQty[item.id])
    if (isNaN(newQty) || newQty < 0) return
    const diff = newQty - item.quantity
    const variant = item.product_variants
    if (!variant) return
    if (diff > variant.quantity) { alert(`Not enough stock — only ${variant.quantity} more available.`); return }

    await supabase.from('product_variants').update({ quantity: variant.quantity - diff }).eq('id', variant.id)
    await supabase.from('order_items').update({
      quantity: newQty,
      line_total: (Number(item.unit_price) * newQty) * (1 - (Number(item.discount_percent) || 0) / 100),
    }).eq('id', item.id)

    if (diff !== 0) {
      await supabase.from('stock_movements').insert({
        variant_id: variant.id, change_qty: -diff, reason: 'adjustment', related_order_id: order.id, created_by: user.id,
      })
    }
    logActivity('edited_order_item', 'order_item', item.id, { old_qty: item.quantity, new_qty: newQty })
    setEditingQty({ ...editingQty, [item.id]: undefined })
    load()
  }

  async function setTag(order, tag) {
    await supabase.from('orders').update({ tag: order.tag === tag ? null : tag }).eq('id', order.id)
    load()
  }

  function renderOrderRow(order) {
    const total = order.order_items.reduce((s, i) => s + Number(i.line_total || 0), 0)
    const isOpen = expandedId === order.id
    const daysUnpaid = order.payment_status !== 'paid' ? daysSince(order.created_at) : null
    return (
      <div key={order.id} className={tagColors[order.tag] || ''}>
        <button onClick={() => setExpandedId(isOpen ? null : order.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <div>
            <p className="font-medium text-sm flex items-center gap-1.5">
              {order.customer_name || 'Walk-in / no name'}
              {order.status === 'returned' && <span className="text-berry text-xs">(Returned)</span>}
              {order.tag && <span className="text-[10px] bg-sand px-1.5 py-0.5 rounded-full">{tagLabels[order.tag]}</span>}
            </p>
            <p className="text-xs text-inkfade">
              {order.order_date} · {order.order_items.length} item(s)
              {daysUnpaid !== null && daysUnpaid > 0 && <span className="text-berry"> · unpaid {daysUnpaid}d</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[order.payment_status]}`}>{order.payment_status}</span>
            <span className="font-medium text-sm">{formatMoney(total, order.currency)}</span>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {isOpen && (
          <div className="px-4 pb-4 space-y-2 bg-cream/50">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm py-1.5 gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Thumb src={item.product_variants?.photo_url} size={28} />
                  <span>{item.product_variants?.products?.name} — {item.product_variants?.size}/{item.product_variants?.color}</span>
                </div>
                <div className="flex items-center gap-2">
                  {editingQty[item.id] !== undefined ? (
                    <>
                      <input type="number" className="input w-16 py-1" value={editingQty[item.id]} onChange={(e) => setEditingQty({ ...editingQty, [item.id]: e.target.value })} />
                      <button onClick={() => saveQtyEdit(order, item)} className="text-sage text-xs font-medium">Save</button>
                    </>
                  ) : (
                    <>
                      <span>× {item.quantity}</span>
                      {order.status !== 'returned' && (
                        <button onClick={() => setEditingQty({ ...editingQty, [item.id]: item.quantity })} className="text-inkfade text-xs underline">edit qty</button>
                      )}
                    </>
                  )}
                  <span className="font-medium">{formatMoney(item.line_total, order.currency)}</span>
                </div>
              </div>
            ))}
            {order.customer_contact && (
              <p className="text-xs text-inkfade">Contact: {order.customer_contact}</p>
            )}
            <div className="flex items-center justify-between text-xs text-inkfade pt-2 border-t border-line flex-wrap gap-2">
              <span>{order.payment_method} · Paid {formatMoney(order.amount_paid, order.currency)}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setTag(order, 'urgent')} className={`flex items-center gap-1 ${order.tag === 'urgent' ? 'text-berry' : 'text-inkfade'}`}><Flag size={12} /> Urgent</button>
                <button onClick={() => setTag(order, 'follow_up')} className={`flex items-center gap-1 ${order.tag === 'follow_up' ? 'text-amber-600' : 'text-inkfade'}`}><Flag size={12} /> Follow up</button>
                {order.status !== 'returned' && (
                  <button onClick={() => handleReturn(order)} className="flex items-center gap-1 text-berry font-medium"><RotateCcw size={12} /> Return whole order</button>
                )}
                <button onClick={() => deleteOrder(order)} className="flex items-center gap-1 text-inkfade hover:text-berry"><Trash2 size={12} /> Delete</button>
              </div>
            </div>
            {order.note && <p className="text-xs text-inkfade italic">Note: {order.note}</p>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-1">Orders</h1>
      <p className="text-inkfade text-sm mb-4">All logged sales, most recent first.</p>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {['all', 'paid', 'deposit', 'unpaid'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${statusFilter === s ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>
            {s}
          </button>
        ))}
        <input type="date" className="input py-1.5 text-xs w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-xs text-inkfade">to</span>
        <input type="date" className="input py-1.5 text-xs w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <input className="input py-1.5 text-xs w-40" placeholder="Search customer…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
        <button onClick={() => setGroupByCustomer(!groupByCustomer)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${groupByCustomer ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>
          <Users size={12} /> Group by customer
        </button>
        <button onClick={() => setShowDrafts(!showDrafts)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${showDrafts ? 'bg-amber-500 text-white' : 'bg-sand text-inkfade'}`}>
          <FileEdit size={12} /> Drafts ({drafts.length})
        </button>
      </div>

      {showDrafts && (
        <div className="card divide-y divide-line mb-6">
          {drafts.map(order => {
            const total = order.order_items.reduce((s, i) => s + Number(i.line_total || 0), 0)
            return (
              <div key={order.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{order.customer_name || 'No name yet'}</p>
                  <p className="text-xs text-inkfade">{order.order_date} · {order.order_items.length} item(s) · {formatMoney(total, order.currency)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => convertDraft(order)} className="text-sage text-sm font-medium flex items-center gap-1"><ArrowRightCircle size={14} /> Convert to Order</button>
                  <button onClick={() => deleteOrder(order)} className="text-inkfade hover:text-berry"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
          {drafts.length === 0 && <p className="text-center text-inkfade text-sm py-6">No drafts saved.</p>}
        </div>
      )}

      <p className="text-xs text-inkfade mb-4">{filteredTotals.count} order(s) · {filteredTotals.items} items · {formatMoney(filteredTotals.revenue)}</p>

      {loading ? (
        <p className="text-inkfade text-sm">Loading…</p>
      ) : groupByCustomer ? (
        <div className="space-y-4">
          {grouped.map(([customer, orders]) => (
            <div key={customer} className="card overflow-hidden">
              <div className="px-4 py-2 bg-sand/60 text-sm font-medium">{customer} ({orders.length})</div>
              <div className="divide-y divide-line">{orders.map(renderOrderRow)}</div>
            </div>
          ))}
          {grouped.length === 0 && <p className="text-center text-inkfade text-sm py-8">No orders match.</p>}
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {filtered.map(renderOrderRow)}
          {filtered.length === 0 && <p className="text-center text-inkfade text-sm py-8">No orders match.</p>}
        </div>
      )}
    </div>
  )
}
