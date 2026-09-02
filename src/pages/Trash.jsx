import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Thumb } from '../components/Thumb'
import { formatMoney } from '../lib/helpers'
import { RotateCcw, Trash2, Package, ClipboardList, Tags, Receipt, ArrowUpDown } from 'lucide-react'

const TYPE_META = {
  products: { label: 'Products', icon: Package },
  variants: { label: 'Product variants', icon: Package },
  orders: { label: 'Orders', icon: ClipboardList },
  categories: { label: 'Categories', icon: Tags },
  transactions: { label: 'Transactions', icon: Receipt },
  movements: { label: 'Stock movements', icon: ArrowUpDown },
}

const PURGE_DAYS = 30

export default function Trash() {
  const { user, logActivity } = useAuth()
  const [data, setData] = useState({ products: [], variants: [], orders: [], categories: [], transactions: [], movements: [] })
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const cutoff = new Date(Date.now() - PURGE_DAYS * 86400000).toISOString()

    await Promise.all([
      supabase.from('products').delete().eq('is_deleted', true).lt('deleted_at', cutoff),
      supabase.from('orders').delete().eq('is_deleted', true).lt('deleted_at', cutoff),
      supabase.from('categories').delete().eq('is_deleted', true).lt('deleted_at', cutoff),
      supabase.from('transactions').delete().eq('is_deleted', true).lt('deleted_at', cutoff),
      supabase.from('stock_movements').delete().eq('is_deleted', true).lt('deleted_at', cutoff),
      supabase.from('product_variants').delete().eq('is_deleted', true).lt('deleted_at', cutoff),
    ])

    const [{ data: p }, { data: v }, { data: o }, { data: c }, { data: t }, { data: m }] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('is_deleted', true),
      supabase.from('product_variants').select('*, products(name)').eq('is_deleted', true),
      supabase.from('orders').select('*, order_items(*, product_variants(id, size, color, quantity))').eq('is_deleted', true),
      supabase.from('categories').select('*').eq('is_deleted', true),
      supabase.from('transactions').select('*').eq('is_deleted', true),
      supabase.from('stock_movements').select('*, product_variants(size, color, products(name))').eq('is_deleted', true),
    ])
    setData({ products: p || [], variants: v || [], orders: o || [], categories: c || [], transactions: t || [], movements: m || [] })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function restoreProduct(p) {
    await supabase.from('products').update({ is_deleted: false }).eq('id', p.id)
    logActivity('restored_product', 'product', p.id, { name: p.name })
    load()
  }

  async function restoreVariant(v) {
    await supabase.from('product_variants').update({ is_deleted: false }).eq('id', v.id)
    logActivity('restored_variant', 'product_variant', v.id, {})
    load()
  }

  async function restoreCategory(c) {
    await supabase.from('categories').update({ is_deleted: false }).eq('id', c.id)
    await supabase.from('products').update({ category_id: c.id, deleted_category_id: null }).eq('deleted_category_id', c.id)
    logActivity('restored_category', 'category', c.id, { name: c.name })
    load()
  }

  async function restoreTransaction(t) {
    await supabase.from('transactions').update({ is_deleted: false }).eq('id', t.id)
    logActivity('restored_transaction', 'transaction', t.id, {})
    load()
  }

  async function restoreMovement(m) {
    await supabase.from('stock_movements').update({ is_deleted: false }).eq('id', m.id)
    logActivity('restored_stock_movement', 'stock_movement', m.id, {})
    load()
  }

  async function restoreOrder(order) {
    for (const item of order.order_items) {
      const variant = item.product_variants
      if (!variant) continue
      if (item.quantity > variant.quantity) {
        alert(`Can't fully restore — not enough stock left for one of the items. Restoring anyway, but check stock afterward.`)
      }
      await supabase.from('product_variants').update({ quantity: Math.max(0, variant.quantity - item.quantity) }).eq('id', variant.id)
      await supabase.from('stock_movements').insert({
        variant_id: variant.id, change_qty: -item.quantity, reason: 'sale', related_order_id: order.id, created_by: user.id,
      })
    }
    const total = order.order_items.reduce((s, i) => s + Number(i.line_total || 0), 0)
    await supabase.from('transactions').insert({
      type: 'income', amount: total, currency: order.currency, category: 'Sale',
      related_order_id: order.id, note: order.customer_name ? `Sale to ${order.customer_name}` : 'Sale', created_by: user.id,
    })
    await supabase.from('orders').update({ is_deleted: false, status: 'active' }).eq('id', order.id)
    logActivity('restored_order', 'order', order.id, {})
    load()
  }

  async function permanentlyDelete(table, id) {
    if (!confirm('Permanently delete this — it cannot be undone. Continue?')) return
    await supabase.from(table).delete().eq('id', id)
    load()
  }

  async function emptyTrash() {
    if (!confirm('Permanently delete EVERYTHING in Trash? This cannot be undone.')) return
    await Promise.all([
      supabase.from('products').delete().eq('is_deleted', true),
      supabase.from('orders').delete().eq('is_deleted', true),
      supabase.from('categories').delete().eq('is_deleted', true),
      supabase.from('transactions').delete().eq('is_deleted', true),
      supabase.from('stock_movements').delete().eq('is_deleted', true),
      supabase.from('product_variants').delete().eq('is_deleted', true),
    ])
    logActivity('emptied_trash', 'trash', null, {})
    load()
  }

  const totalCount = Object.values(data).reduce((s, arr) => s + arr.length, 0)
  const visibleTypes = Object.keys(TYPE_META).filter(t => typeFilter === 'all' || typeFilter === t)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold">Trash</h1>
        {totalCount > 0 && (
          <button onClick={emptyTrash} className="text-berry text-sm font-medium flex items-center gap-1"><Trash2 size={14} /> Empty Trash</button>
        )}
      </div>
      <p className="text-inkfade text-sm mb-4">Deleted items — restore anytime. Auto-clears after {PURGE_DAYS} days.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setTypeFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${typeFilter === 'all' ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>All</button>
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <button key={key} onClick={() => setTypeFilter(key)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${typeFilter === key ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>
            {meta.label} ({data[key].length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-inkfade text-sm">Loading…</p>
      ) : (
        <div className="space-y-6">
          {visibleTypes.includes('products') && data.products.length > 0 && (
            <TypeSection title="Products" icon={Package}>
              {data.products.map(p => (
                <Row key={p.id} label={p.name} sub={p.categories?.name || 'Uncategorized'} onRestore={() => restoreProduct(p)} onForget={() => permanentlyDelete('products', p.id)} />
              ))}
            </TypeSection>
          )}

          {visibleTypes.includes('variants') && data.variants.length > 0 && (
            <TypeSection title="Product variants" icon={Package}>
              {data.variants.map(v => (
                <Row key={v.id} thumb={v.photo_url} label={`${v.products?.name} — ${v.size}/${v.color}`} sub={v.barcode} onRestore={() => restoreVariant(v)} onForget={() => permanentlyDelete('product_variants', v.id)} />
              ))}
            </TypeSection>
          )}

          {visibleTypes.includes('orders') && data.orders.length > 0 && (
            <TypeSection title="Orders" icon={ClipboardList}>
              {data.orders.map(o => {
                const total = o.order_items.reduce((s, i) => s + Number(i.line_total || 0), 0)
                return <Row key={o.id} label={o.customer_name || 'No name'} sub={`${o.order_date} · ${formatMoney(total, o.currency)}`} onRestore={() => restoreOrder(o)} onForget={() => permanentlyDelete('orders', o.id)} />
              })}
            </TypeSection>
          )}

          {visibleTypes.includes('categories') && data.categories.length > 0 && (
            <TypeSection title="Categories" icon={Tags}>
              {data.categories.map(c => (
                <Row key={c.id} label={c.name} onRestore={() => restoreCategory(c)} onForget={() => permanentlyDelete('categories', c.id)} />
              ))}
            </TypeSection>
          )}

          {visibleTypes.includes('transactions') && data.transactions.length > 0 && (
            <TypeSection title="Transactions" icon={Receipt}>
              {data.transactions.map(t => (
                <Row key={t.id} label={t.category || t.type} sub={formatMoney(t.amount, t.currency)} onRestore={() => restoreTransaction(t)} onForget={() => permanentlyDelete('transactions', t.id)} />
              ))}
            </TypeSection>
          )}

          {visibleTypes.includes('movements') && data.movements.length > 0 && (
            <TypeSection title="Stock movements" icon={ArrowUpDown}>
              {data.movements.map(m => (
                <Row key={m.id} label={`${m.product_variants?.products?.name} — ${m.product_variants?.size}/${m.product_variants?.color}`} sub={`${m.change_qty > 0 ? '+' : ''}${m.change_qty}`} onRestore={() => restoreMovement(m)} onForget={() => permanentlyDelete('stock_movements', m.id)} />
              ))}
            </TypeSection>
          )}

          {totalCount === 0 && <p className="text-center text-inkfade text-sm py-12">Trash is empty — nothing deleted right now.</p>}
        </div>
      )}
    </div>
  )
}

function TypeSection({ title, icon: Icon, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-inkfade mb-2 flex items-center gap-1.5"><Icon size={13} /> {title}</p>
      <div className="card divide-y divide-line">{children}</div>
    </div>
  )
}

function Row({ thumb, label, sub, onRestore, onForget }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {thumb !== undefined && <Thumb src={thumb} size={32} />}
        <div>
          <p className="text-sm font-medium">{label}</p>
          {sub && <p className="text-xs text-inkfade">{sub}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onRestore} className="text-sage text-sm font-medium flex items-center gap-1"><RotateCcw size={14} /> Restore</button>
        <button onClick={onForget} className="text-inkfade hover:text-berry"><Trash2 size={14} /></button>
      </div>
    </div>
  )
}
