import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, formatDateTime } from '../lib/helpers'
import { ArrowLeft, Minus, Plus, RotateCcw } from 'lucide-react'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const [{ data: o }, { data: its }] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id).single(),
      supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
    ])
    setOrder(o)
    setItems(its || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const updateItemQuantity = async (item, delta) => {
    const newQty = item.quantity + delta
    if (newQty < 0) return
    setBusy(true)
    setError('')
    try {
      // Adjust stock in the opposite direction of the quantity change
      const { data: v } = await supabase.from('product_variants').select('quantity').eq('id', item.variant_id).single()
      if (v) {
        await supabase.from('product_variants').update({ quantity: v.quantity - delta }).eq('id', item.variant_id)
        await supabase.from('stock_movements').insert({
          variant_id: item.variant_id,
          product_name: item.product_name,
          variant_label: item.variant_label,
          change_type: 'adjustment',
          quantity_change: -delta,
          note: `Order ${order.order_number} item quantity edited`,
        })
      }

      if (newQty === 0) {
        await supabase.from('order_items').delete().eq('id', item.id)
      } else {
        await supabase.from('order_items').update({ quantity: newQty }).eq('id', item.id)
      }

      await recalcOrderTotal()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const recalcOrderTotal = async () => {
    const { data: its } = await supabase.from('order_items').select('*').eq('order_id', id)
    const subtotal = (its || []).reduce((sum, i) => sum + i.unit_price * i.quantity - (i.discount || 0), 0)
    const discountAmt =
      order.discount_type === 'percent'
        ? subtotal * ((order.discount_value || 0) / 100)
        : order.discount_type === 'amount'
        ? order.discount_value || 0
        : 0
    const newTotal = Math.max(0, subtotal - discountAmt)
    await supabase.from('orders').update({ subtotal, total: newTotal }).eq('id', id)
  }

  const handleReturn = async () => {
    if (!confirm('Return this entire order? This restores stock for all items and reverses the recorded income.')) return
    setBusy(true)
    setError('')
    try {
      for (const item of items) {
        const { data: v } = await supabase.from('product_variants').select('quantity').eq('id', item.variant_id).single()
        if (v) {
          await supabase.from('product_variants').update({ quantity: v.quantity + item.quantity }).eq('id', item.variant_id)
        }
        await supabase.from('stock_movements').insert({
          variant_id: item.variant_id,
          product_name: item.product_name,
          variant_label: item.variant_label,
          change_type: 'return',
          quantity_change: item.quantity,
          note: `Return of order ${order.order_number}`,
        })
      }

      if (order.amount_paid > 0) {
        await supabase.from('transactions').insert({
          type: 'expense',
          amount: order.amount_paid,
          currency: order.currency,
          description: `Return: order ${order.order_number}`,
          related_order_id: order.id,
        })
      }

      await supabase.from('orders').update({ is_returned: true }).eq('id', id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-inkfade text-sm">Loading…</p>
  if (!order) return <p className="text-inkfade text-sm">Order not found.</p>

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/orders')} className="flex items-center gap-1.5 text-inkfade hover:text-ink text-sm mb-4">
        <ArrowLeft size={16} /> Back to orders
      </button>

      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <h1 className="font-display text-2xl font-semibold text-ink">{order.order_number}</h1>
        {order.is_returned && <span className="text-xs px-2 py-1 rounded-full bg-sand text-inkfade">Returned</span>}
      </div>
      <p className="text-sm text-inkfade mb-6">{formatDateTime(order.created_at)}{order.customer_name ? ` · ${order.customer_name}` : ''}</p>

      <div className="bg-white/60 border border-line rounded-2xl divide-y divide-line mb-6">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">{item.product_name}</p>
              <p className="text-xs text-inkfade">{item.variant_label} · {formatMoney(item.unit_price)} each</p>
            </div>
            {!order.is_returned && (
              <div className="flex items-center gap-1.5">
                <button disabled={busy} onClick={() => updateItemQuantity(item, -1)} className="p-1 rounded bg-sand text-ink disabled:opacity-50"><Minus size={14} /></button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <button disabled={busy} onClick={() => updateItemQuantity(item, 1)} className="p-1 rounded bg-sand text-ink disabled:opacity-50"><Plus size={14} /></button>
              </div>
            )}
            {order.is_returned && <span className="text-sm text-inkfade">x{item.quantity}</span>}
            <div className="text-sm text-ink w-16 text-right">{formatMoney(item.unit_price * item.quantity - (item.discount || 0))}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/60 border border-line rounded-2xl p-4 space-y-1 mb-6">
        <div className="flex justify-between text-sm text-inkfade">
          <span>Subtotal</span><span>{formatMoney(order.subtotal, order.currency)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-ink">
          <span>Total</span><span>{formatMoney(order.total, order.currency)}</span>
        </div>
        <div className="flex justify-between text-sm text-inkfade pt-1">
          <span>Payment</span>
          <span className="capitalize">{order.payment_status} — {formatMoney(order.amount_paid, order.currency)} paid</span>
        </div>
      </div>

      {error && <p className="text-berryDark text-sm mb-4">{error}</p>}

      {!order.is_returned && (
        <button
          onClick={handleReturn}
          disabled={busy}
          className="flex items-center gap-2 text-berryDark hover:text-berry text-sm font-medium disabled:opacity-50"
        >
          <RotateCcw size={16} /> Return entire order
        </button>
      )}
    </div>
  )
}
