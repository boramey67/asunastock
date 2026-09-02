import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMoney } from '../lib/helpers'
import { Search, Trash2, Check, Plus, Minus, Users } from 'lucide-react'
import { Thumb } from '../components/Thumb'

export default function LogSale() {
  const { user, logActivity } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [recentItems, setRecentItems] = useState([])
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [customerOrderCount, setCustomerOrderCount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState(() => localStorage.getItem('lastPaymentMethod') || 'Cash')
  const [currency, setCurrency] = useState('USD')
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [amountPaid, setAmountPaid] = useState('')
  const [discountScope, setDiscountScope] = useState('none')
  const [orderDiscount, setOrderDiscount] = useState(0)
  const [note, setNote] = useState('')
  const [noteTemplates, setNoteTemplates] = useState([])
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [stockWarning, setStockWarning] = useState({})

  useEffect(() => {
    supabase.from('note_templates').select('*').then(({ data }) => setNoteTemplates(data || []))
    supabase.from('order_items').select('variant_id, product_variants(id, size, color, selling_price, quantity, barcode, photo_url, products(name))')
      .order('id', { ascending: false }).limit(30).then(({ data }) => {
        const seen = new Map()
        ;(data || []).forEach(item => {
          if (item.product_variants && !seen.has(item.variant_id)) seen.set(item.variant_id, item.product_variants)
        })
        setRecentItems([...seen.values()].slice(0, 6))
      })
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('product_variants')
        .select('id, size, color, barcode, quantity, selling_price, original_price, photo_url, products!inner(name, is_deleted)')
        .eq('is_deleted', false)
        .eq('products.is_deleted', false)
        .gt('quantity', 0)
        .or(`barcode.ilike.%${query}%`)
        .limit(6)
      setResults(data || [])
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!customerName.trim()) { setCustomerOrderCount(0); return }
    const t = setTimeout(async () => {
      const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true })
        .ilike('customer_name', customerName.trim())
      setCustomerOrderCount(count || 0)
    }, 300)
    return () => clearTimeout(t)
  }, [customerName])

  useEffect(() => {
    function handler(e) {
      if (cart.length > 0) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [cart])

  function addToCart(variant) {
    if (cart.find(c => c.variant.id === variant.id)) return
    setCart([...cart, { variant, quantity: 1, unit_price: variant.selling_price, discount_percent: 0 }])
    setQuery('')
    setResults([])
  }

  useEffect(() => {
    const preselect = location.state?.preselect
    if (preselect) {
      addToCart(preselect)
      window.history.replaceState({}, document.title)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateCartItem(idx, field, value) {
    const copy = [...cart]
    copy[idx] = { ...copy[idx], [field]: value }
    setCart(copy)
  }

  async function recheckStock(idx) {
    const item = cart[idx]
    const { data } = await supabase.from('product_variants').select('quantity').eq('id', item.variant.id).single()
    setStockWarning({ ...stockWarning, [item.variant.id]: data?.quantity ?? item.variant.quantity })
  }

  function removeFromCart(idx) {
    setCart(cart.filter((_, i) => i !== idx))
  }

  function lineTotal(item) {
    const base = item.quantity * item.unit_price
    const discountPct = discountScope === 'item' ? item.discount_percent : (discountScope === 'order' ? orderDiscount : 0)
    return base * (1 - (Number(discountPct) || 0) / 100)
  }

  function lineDiscountPct(item) {
    return discountScope === 'item' ? item.discount_percent : (discountScope === 'order' ? orderDiscount : 0)
  }

  const orderTotal = cart.reduce((sum, item) => sum + lineTotal(item), 0)
  const orderCost = cart.reduce((sum, item) => sum + item.quantity * Number(item.variant.original_price || 0), 0)
  const orderProfit = orderTotal - orderCost

  function openConfirm() {
    if (cart.length === 0) { alert('Add at least one item to the order'); return }
    for (const item of cart) {
      if (item.quantity > item.variant.quantity) {
        alert(`Only ${item.variant.quantity} left of ${item.variant.products?.name} (${item.variant.size}/${item.variant.color}) — reduce the quantity.`)
        return
      }
    }
    setConfirmOpen(true)
  }

  async function saveDraft() {
    if (cart.length === 0) { alert('Add at least one item first'); return }
    setSaving(true)
    const { data: order, error } = await supabase.from('orders').insert({
      customer_name: customerName || null,
      customer_contact: customerContact || null,
      order_date: orderDate,
      payment_method: paymentMethod,
      currency,
      payment_status: paymentStatus,
      amount_paid: 0,
      discount_scope: discountScope,
      discount_percent: discountScope === 'order' ? orderDiscount : 0,
      note: note || null,
      status: 'draft',
      created_by: user.id,
    }).select().single()

    if (error) { alert(error.message); setSaving(false); return }

    for (const item of cart) {
      await supabase.from('order_items').insert({
        order_id: order.id, variant_id: item.variant.id, quantity: item.quantity,
        unit_price: item.unit_price, discount_percent: lineDiscountPct(item),
        cost_at_sale: item.variant.original_price, line_total: lineTotal(item),
      })
    }
    logActivity('saved_draft', 'order', order.id, { customer: customerName })
    setSaving(false)
    setCart([])
    setCustomerName('')
    setCustomerContact('')
    setNote('')
    navigate('/orders')
  }

  async function handleSubmit() {
    setSaving(true)
    localStorage.setItem('lastPaymentMethod', paymentMethod)
    const paidAmount = paymentStatus === 'paid' ? orderTotal : (paymentStatus === 'unpaid' ? 0 : Number(amountPaid) || 0)

    const { data: order, error } = await supabase.from('orders').insert({
      customer_name: customerName || null,
      customer_contact: customerContact || null,
      order_date: orderDate,
      payment_method: paymentMethod,
      currency,
      payment_status: paymentStatus,
      amount_paid: paidAmount,
      discount_scope: discountScope,
      discount_percent: discountScope === 'order' ? orderDiscount : 0,
      note: note || null,
      status: 'active',
      created_by: user.id,
    }).select().single()

    if (error) { alert(error.message); setSaving(false); return }

    for (const item of cart) {
      const discountPct = lineDiscountPct(item)
      await supabase.from('order_items').insert({
        order_id: order.id, variant_id: item.variant.id, quantity: item.quantity,
        unit_price: item.unit_price, discount_percent: discountPct,
        cost_at_sale: item.variant.original_price, line_total: lineTotal(item),
      })
      const newQty = item.variant.quantity - item.quantity
      await supabase.from('product_variants').update({ quantity: newQty }).eq('id', item.variant.id)
      await supabase.from('stock_movements').insert({
        variant_id: item.variant.id, change_qty: -item.quantity, reason: 'sale',
        related_order_id: order.id, created_by: user.id,
      })
    }

    await supabase.from('transactions').insert({
      type: 'income', amount: orderTotal, currency, category: 'Sale',
      related_order_id: order.id, note: customerName ? `Sale to ${customerName}` : 'Sale', created_by: user.id,
    })

    logActivity('logged_sale', 'order', order.id, { customer: customerName, total: orderTotal })

    setSaving(false)
    setConfirmOpen(false)
    setSuccess(true)
    setCart([])
    setCustomerName('')
    setCustomerContact('')
    setNote('')
    setAmountPaid('')
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-14 h-14 rounded-full bg-sage/15 flex items-center justify-center mx-auto mb-4">
          <Check className="text-sage" size={28} />
        </div>
        <h1 className="font-display text-xl font-semibold mb-2">Order saved!</h1>
        <p className="text-inkfade text-sm mb-6">Stock and transactions have been updated automatically.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => setSuccess(false)} className="btn-primary">Log another sale</button>
          <button onClick={() => navigate('/orders')} className="btn-secondary">View orders</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl pb-24">
      <h1 className="font-display text-2xl font-semibold mb-1">Log a Sale</h1>
      <p className="text-inkfade text-sm mb-6">Search by barcode or product name to add items to this order.</p>

      {recentItems.length > 0 && cart.length === 0 && !query && (
        <div className="mb-4">
          <p className="text-xs text-inkfade mb-2">Recently sold — tap to add</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentItems.map(v => (
              <button key={v.id} onClick={() => addToCart(v)} className="card p-2 flex items-center gap-2 whitespace-nowrap text-xs hover:bg-sand shrink-0">
                <Thumb src={v.photo_url} size={28} />
                <span>{v.products?.name} {v.size}/{v.color}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <div className="flex items-center gap-2 border border-line rounded-xl px-3 py-2 bg-white">
          <Search size={16} className="text-inkfade" />
          <input className="flex-1 outline-none" placeholder="Barcode or product name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {results.length > 0 && (
          <div className="absolute z-10 w-full card mt-1 max-h-64 overflow-y-auto">
            {results.map((v) => (
              <button key={v.id} onClick={() => addToCart(v)} className="w-full text-left px-3 py-2 hover:bg-sand flex justify-between items-center gap-2">
                <Thumb src={v.photo_url} size={28} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{v.products?.name} — {v.size}/{v.color}</p>
                  <p className="text-xs text-inkfade">{v.barcode} · {v.quantity} in stock</p>
                </div>
                <span className="text-sm font-medium">{formatMoney(v.selling_price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="card divide-y divide-line mb-6">
          {cart.map((item, idx) => (
            <div key={item.variant.id} className="p-4 flex flex-col gap-2">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2">
                  <Thumb src={item.variant.photo_url} size={36} />
                  <div>
                    <p className="font-medium text-sm">{item.variant.products?.name} — {item.variant.size}/{item.variant.color}</p>
                    <p className="text-xs text-inkfade">{item.variant.quantity} available</p>
                  </div>
                </div>
                <button onClick={() => removeFromCart(idx)} className="text-inkfade hover:text-berry"><Trash2 size={16} /></button>
              </div>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="label">Qty</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { updateCartItem(idx, 'quantity', Math.max(1, item.quantity - 1)); recheckStock(idx) }} className="w-7 h-7 rounded-lg bg-sand flex items-center justify-center"><Minus size={12} /></button>
                    <input type="number" min="1" className="input w-14 text-center" value={item.quantity}
                      onChange={(e) => { updateCartItem(idx, 'quantity', Number(e.target.value)); recheckStock(idx) }} />
                    <button onClick={() => { updateCartItem(idx, 'quantity', item.quantity + 1); recheckStock(idx) }} className="w-7 h-7 rounded-lg bg-sand flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                  {stockWarning[item.variant.id] !== undefined && stockWarning[item.variant.id] < item.quantity && (
                    <p className="text-[11px] text-berry mt-1">Only {stockWarning[item.variant.id]} left now — someone else may have sold it</p>
                  )}
                </div>
                <div>
                  <label className="label">Price/unit</label>
                  <input type="number" step="0.01" className="input w-28" value={item.unit_price} onChange={(e) => updateCartItem(idx, 'unit_price', Number(e.target.value))} />
                </div>
                {discountScope === 'item' && (
                  <div>
                    <label className="label">Discount %</label>
                    <input type="number" className="input w-24" value={item.discount_percent} onChange={(e) => updateCartItem(idx, 'discount_percent', Number(e.target.value))} />
                  </div>
                )}
                <div className="ml-auto text-sm font-medium text-right">
                  {lineDiscountPct(item) > 0 && (
                    <div className="text-xs text-inkfade line-through">{formatMoney(item.quantity * item.unit_price, currency)}</div>
                  )}
                  {formatMoney(lineTotal(item), currency)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              Customer name
              {customerOrderCount > 0 && (
                <span className="text-[10px] bg-sage/15 text-sage px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Users size={10} /> {customerOrderCount + 1}{customerOrderCount === 0 ? 'st' : 'th'} order
                </span>
              )}
            </label>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className="label">Contact (optional)</label>
            <input className="input" value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} placeholder="Phone or Messenger name" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Payment method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option>Cash</option><option>ABA KHQR (Bakong)</option><option>Bank Transfer</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">USD</option><option value="KHR">KHR</option>
            </select>
          </div>
          <div>
            <label className="label">Payment status</label>
            <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="paid">Paid in full</option><option value="deposit">Deposit</option><option value="unpaid">Unpaid</option>
            </select>
          </div>
          {paymentStatus === 'deposit' && (
            <div>
              <label className="label">Amount paid now</label>
              <input type="number" step="0.01" className="input" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">Discount</label>
            <select className="input" value={discountScope} onChange={(e) => setDiscountScope(e.target.value)}>
              <option value="none">No discount</option><option value="order">Whole order %</option><option value="item">Per item %</option>
            </select>
          </div>
          {discountScope === 'order' && (
            <div>
              <label className="label">Discount %</label>
              <input type="number" className="input" value={orderDiscount} onChange={(e) => setOrderDiscount(Number(e.target.value))} />
            </div>
          )}
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input className="input mb-2" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-1.5 flex-wrap">
            {noteTemplates.map(t => (
              <button key={t.id} onClick={() => setNote(note ? `${note}, ${t.text}` : t.text)} className="text-xs bg-sand px-2 py-1 rounded-full text-inkfade hover:bg-line">
                {t.text}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4 text-sm text-inkfade">
          <span>Profit on this order</span>
          <span className="font-medium text-sage">{formatMoney(orderProfit, currency)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Order total</span>
          <span className="font-display text-xl font-semibold">{formatMoney(orderTotal, currency)}</span>
        </div>

        <div className="flex gap-2">
          <button onClick={saveDraft} disabled={saving || cart.length === 0} className="btn-secondary flex-1">Save as Draft</button>
          <button onClick={openConfirm} disabled={saving || cart.length === 0} className="btn-primary flex-1">Review &amp; Save Order</button>
        </div>
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-white border-t border-line px-4 py-3 flex items-center justify-between z-30">
          <span className="text-sm text-inkfade">{cart.length} item{cart.length !== 1 ? 's' : ''} in cart</span>
          <span className="font-display font-semibold">{formatMoney(orderTotal, currency)}</span>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center px-4" onClick={() => setConfirmOpen(false)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium mb-3">Confirm this order</h3>
            <div className="space-y-1.5 text-sm mb-4 max-h-52 overflow-y-auto">
              {cart.map(item => (
                <div key={item.variant.id} className="flex justify-between">
                  <span>{item.variant.products?.name} ({item.variant.size}/{item.variant.color}) × {item.quantity}</span>
                  <span className="font-medium">{formatMoney(lineTotal(item), currency)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm border-t border-line pt-3 mb-1">
              <span className="text-inkfade">Customer</span><span>{customerName || 'No name'}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-inkfade">Payment</span><span>{paymentMethod} · {paymentStatus}</span>
            </div>
            <div className="flex justify-between font-medium mb-4">
              <span>Total</span><span>{formatMoney(orderTotal, currency)}</span>
            </div>
            <p className="text-[11px] text-inkfade mb-4">Double check size and color before saving — a common mix-up when moving quickly.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="btn-secondary flex-1">Back</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Confirm & Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
