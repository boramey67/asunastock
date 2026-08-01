import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, generateOrderNumber, variantLabel } from '../lib/helpers'
import { Search, Trash2, Minus, Plus, ScanBarcode } from 'lucide-react'

export default function LogSale() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [cart, setCart] = useState([]) // { variantId, productName, variantLabel, price, cost, quantity, available, photo }
  const [customerName, setCustomerName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [orderDiscountType, setOrderDiscountType] = useState('') // '', 'percent', 'amount'
  const [orderDiscountValue, setOrderDiscountValue] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [amountPaid, setAmountPaid] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [exchangeRate, setExchangeRate] = useState(4100)
  const searchRef = useRef(null)

  useEffect(() => {
    searchRef.current?.focus()
    supabase.from('settings').select('*').eq('key', 'exchange_rate_khr_per_usd').single()
      .then(({ data }) => { if (data) setExchangeRate(Number(data.value)) })
  }, [])

  useEffect(() => {
    const search = async () => {
      if (!query.trim()) { setResults([]); return }
      const { data } = await supabase
        .from('product_variants')
        .select('*, product:products(name)')
        .eq('is_deleted', false)
        .or(`barcode.ilike.%${query}%,product_id.in.(${await matchingProductIds(query)})`)
        .limit(8)
      setResults(data || [])
    }
    const t = setTimeout(search, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const matchingProductIds = async (q) => {
    const { data } = await supabase.from('products').select('id').ilike('name', `%${q}%`)
    const ids = (data || []).map((p) => p.id)
    return ids.length ? ids.join(',') : '00000000-0000-0000-0000-000000000000'
  }

  const addToCart = (variant) => {
    setCart((c) => {
      const existing = c.find((i) => i.variantId === variant.id)
      if (existing) {
        if (existing.quantity >= variant.quantity) return c
        return c.map((i) => (i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      if (variant.quantity <= 0) return c
      return [
        ...c,
        {
          variantId: variant.id,
          productName: variant.product?.name || 'Product',
          variantLabel: variantLabel(variant),
          price: Number(variant.price_usd),
          quantity: 1,
          available: variant.quantity,
          photo: variant.photo_url,
          itemDiscount: 0,
        },
      ]
    })
    setQuery('')
    setResults([])
    searchRef.current?.focus()
  }

  const updateQty = (variantId, delta) => {
    setCart((c) =>
      c.map((i) => {
        if (i.variantId !== variantId) return i
        const next = i.quantity + delta
        if (next < 1 || next > i.available) return i
        return { ...i, quantity: next }
      })
    )
  }

  const updateItemDiscount = (variantId, val) => {
    setCart((c) => c.map((i) => (i.variantId === variantId ? { ...i, itemDiscount: Number(val) || 0 } : i)))
  }

  const removeFromCart = (variantId) => setCart((c) => c.filter((i) => i.variantId !== variantId))

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity - i.itemDiscount, 0)
  const orderDiscount =
    orderDiscountType === 'percent'
      ? subtotal * ((Number(orderDiscountValue) || 0) / 100)
      : orderDiscountType === 'amount'
      ? Number(orderDiscountValue) || 0
      : 0
  const totalUsd = Math.max(0, subtotal - orderDiscount)
  const total = currency === 'KHR' ? totalUsd * exchangeRate : totalUsd

  const handleAmountPaidDefault = () => {
    if (paymentStatus === 'paid') return total
    return Number(amountPaid) || 0
  }

  const handleCheckout = async () => {
    setError('')
    if (cart.length === 0) { setError('Add at least one item to the cart.'); return }
    setSaving(true)
    try {
      const paid = paymentStatus === 'paid' ? total : paymentStatus === 'unpaid' ? 0 : Number(amountPaid) || 0

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: generateOrderNumber(),
          customer_name: customerName || null,
          currency,
          subtotal: currency === 'KHR' ? subtotal * exchangeRate : subtotal,
          discount_type: orderDiscountType || null,
          discount_value: Number(orderDiscountValue) || 0,
          total,
          payment_status: paymentStatus,
          amount_paid: paid,
        })
        .select()
        .single()
      if (orderErr) throw orderErr

      for (const item of cart) {
        const { error: itemErr } = await supabase.from('order_items').insert({
          order_id: order.id,
          variant_id: item.variantId,
          product_name: item.productName,
          variant_label: item.variantLabel,
          quantity: item.quantity,
          unit_price: item.price,
          discount: item.itemDiscount,
        })
        if (itemErr) throw itemErr

        const { data: v } = await supabase.from('product_variants').select('quantity').eq('id', item.variantId).single()
        await supabase.from('product_variants').update({ quantity: (v?.quantity || 0) - item.quantity }).eq('id', item.variantId)

        await supabase.from('stock_movements').insert({
          variant_id: item.variantId,
          product_name: item.productName,
          variant_label: item.variantLabel,
          change_type: 'sale',
          quantity_change: -item.quantity,
          note: `Order ${order.order_number}`,
        })
      }

      if (paid > 0) {
        await supabase.from('transactions').insert({
          type: 'income',
          amount: paid,
          currency,
          description: `Order ${order.order_number}${customerName ? ' — ' + customerName : ''}`,
          related_order_id: order.id,
        })
      }

      navigate(`/orders/${order.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3">
        <h1 className="font-display text-2xl font-semibold text-ink mb-6">Log a Sale</h1>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfade" size={18} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Scan barcode or search product name…"
            className="w-full rounded-lg border border-line bg-white pl-10 pr-3 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-berry"
          />
        </div>

        {results.length > 0 && (
          <div className="bg-white/80 border border-line rounded-xl divide-y divide-line mb-6">
            {results.map((v) => (
              <button
                key={v.id}
                onClick={() => addToCart(v)}
                disabled={v.quantity <= 0}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-sand disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded bg-sand overflow-hidden shrink-0 flex items-center justify-center">
                  {v.photo_url ? <img src={v.photo_url} className="w-full h-full object-cover" /> : <ScanBarcode size={16} className="text-inkfade" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{v.product?.name}</p>
                  <p className="text-xs text-inkfade">{variantLabel(v)} · {v.barcode}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-ink">{formatMoney(v.price_usd)}</p>
                  <p className="text-xs text-inkfade">{v.quantity} left</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="bg-white/60 border border-line rounded-2xl divide-y divide-line">
          {cart.length === 0 && <p className="p-4 text-sm text-inkfade">Cart is empty. Search above to add items.</p>}
          {cart.map((item) => (
            <div key={item.variantId} className="flex items-center gap-3 p-3">
              <div className="w-12 h-12 rounded bg-sand overflow-hidden shrink-0">
                {item.photo && <img src={item.photo} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{item.productName}</p>
                <p className="text-xs text-inkfade">{item.variantLabel}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateQty(item.variantId, -1)} className="p-1 rounded bg-sand text-ink"><Minus size={14} /></button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <button onClick={() => updateQty(item.variantId, 1)} className="p-1 rounded bg-sand text-ink"><Plus size={14} /></button>
              </div>
              <div className="text-sm text-ink w-16 text-right">{formatMoney(item.price * item.quantity - item.itemDiscount)}</div>
              <button onClick={() => removeFromCart(item.variantId)} className="text-inkfade hover:text-berryDark shrink-0"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white/60 border border-line rounded-2xl p-5 space-y-4 lg:sticky lg:top-8">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Customer name (optional)</label>
            <input
              value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-berry"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Currency</label>
            <div className="flex gap-2">
              {['USD', 'KHR'].map((c) => (
                <button
                  key={c} type="button" onClick={() => setCurrency(c)}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${currency === c ? 'bg-berry text-cream' : 'bg-sand text-inkfade'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Order discount</label>
            <div className="flex gap-2">
              <select
                value={orderDiscountType}
                onChange={(e) => setOrderDiscountType(e.target.value)}
                className="rounded-lg border border-line bg-white px-2 py-2 text-sm text-ink"
              >
                <option value="">None</option>
                <option value="percent">%</option>
                <option value="amount">$ off</option>
              </select>
              <input
                type="number" min="0" step="0.01"
                value={orderDiscountValue}
                onChange={(e) => setOrderDiscountValue(e.target.value)}
                disabled={!orderDiscountType}
                placeholder="0"
                className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Payment status</label>
            <div className="flex gap-2">
              {['paid', 'deposit', 'unpaid'].map((s) => (
                <button
                  key={s} type="button" onClick={() => setPaymentStatus(s)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize ${paymentStatus === s ? 'bg-berry text-cream' : 'bg-sand text-inkfade'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {paymentStatus === 'deposit' && (
              <input
                type="number" min="0" step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="Amount paid now"
                className="w-full mt-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              />
            )}
          </div>

          <div className="border-t border-line pt-3 space-y-1">
            <div className="flex justify-between text-sm text-inkfade">
              <span>Subtotal</span>
              <span>{formatMoney(currency === 'KHR' ? subtotal * exchangeRate : subtotal, currency)}</span>
            </div>
            {orderDiscount > 0 && (
              <div className="flex justify-between text-sm text-inkfade">
                <span>Discount</span>
                <span>-{formatMoney(currency === 'KHR' ? orderDiscount * exchangeRate : orderDiscount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-ink pt-1">
              <span>Total</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </div>

          {error && <p className="text-berryDark text-sm">{error}</p>}

          <button
            onClick={handleCheckout}
            disabled={saving || cart.length === 0}
            className="w-full bg-berry hover:bg-berryDark text-cream font-medium rounded-lg py-2.5 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  )
}
