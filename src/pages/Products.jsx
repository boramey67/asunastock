import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { daysSince } from '../lib/helpers'
import { Plus, ShoppingCart, MinusCircle, Pencil, Search, Star, AlertTriangle, Trash2, Share2, ArrowUpDown } from 'lucide-react'
import Modal from '../components/Modal'
import { Thumb } from '../components/Thumb'

const ADJUST_REASONS = ['Damaged', 'Lost', 'Miscount / correction', 'Other']
const SORT_OPTIONS = [
  { value: 'category', label: 'Category → Name' },
  { value: 'stock_asc', label: 'Stock (lowest first)' },
  { value: 'price_asc', label: 'Price (low → high)' },
  { value: 'price_desc', label: 'Price (high → low)' },
]

export default function Products() {
  const navigate = useNavigate()
  const { user, logActivity } = useAuth()
  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('category')
  const [loading, setLoading] = useState(true)
  const [adjustTarget, setAdjustTarget] = useState(null)
  const [adjustForm, setAdjustForm] = useState({ diff: '', reason: ADJUST_REASONS[0] })
  const [adjustSaving, setAdjustSaving] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const searchRef = useRef(null)

  async function load() {
    setLoading(true)
    const { data: cats } = await supabase.from('categories').select('*').eq('is_deleted', false).order('name')
    setCategories(cats || [])

    const { data: prods } = await supabase
      .from('products')
      .select('*, categories(id, name), product_variants(*)')
      .eq('is_deleted', false)

    const flattened = []
    ;(prods || []).forEach((p) => {
      const variants = (p.product_variants || []).filter((v) => !v.is_deleted)
      if (variants.length === 0) flattened.push({ product: p, variant: null })
      else variants.forEach((v) => flattened.push({ product: p, variant: v }))
    })
    setRows(flattened)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  let filtered = rows.filter((r) => {
    const matchesCategory = activeCategory === 'all' || r.product.category_id === activeCategory
    const matchesSearch = !search.trim() || r.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.variant?.barcode || '').toLowerCase().includes(search.toLowerCase())
    const price = r.variant?.selling_price ?? null
    const matchesMin = !minPrice || (price !== null && price >= Number(minPrice))
    const matchesMax = !maxPrice || (price !== null && price <= Number(maxPrice))
    return matchesCategory && matchesSearch && matchesMin && matchesMax
  })

  filtered.sort((a, b) => {
    if (sortBy === 'stock_asc') return (a.variant?.quantity ?? 999) - (b.variant?.quantity ?? 999)
    if (sortBy === 'price_asc') return (a.variant?.selling_price ?? 0) - (b.variant?.selling_price ?? 0)
    if (sortBy === 'price_desc') return (b.variant?.selling_price ?? 0) - (a.variant?.selling_price ?? 0)
    const catA = a.product.categories?.name || 'zzz'
    const catB = b.product.categories?.name || 'zzz'
    return catA.localeCompare(catB) || a.product.name.localeCompare(b.product.name)
  })
  filtered.sort((a, b) => (b.variant?.is_pinned ? 1 : 0) - (a.variant?.is_pinned ? 1 : 0))

  function goToSell(variant, productName) {
    navigate('/log-sale', { state: { preselect: { ...variant, products: { name: productName } } } })
  }

  function openAdjustModal(row) {
    setAdjustForm({ diff: '', reason: ADJUST_REASONS[0] })
    setAdjustTarget(row)
  }

  async function confirmAdjust() {
    const { variant } = adjustTarget
    const diff = Number(adjustForm.diff)
    if (isNaN(diff) || diff === 0) { alert('Enter a non-zero number like -1 or 2'); return }
    const newQty = variant.quantity + diff
    if (newQty < 0) { alert('That would make stock negative.'); return }

    setAdjustSaving(true)
    await supabase.from('product_variants').update({ quantity: newQty }).eq('id', variant.id)
    await supabase.from('stock_movements').insert({
      variant_id: variant.id, change_qty: diff, reason: 'adjustment', created_by: user.id,
    })
    logActivity('adjusted_stock', 'product_variant', variant.id, { diff, newQty, reason: adjustForm.reason })
    setAdjustSaving(false)
    setAdjustTarget(null)
    load()
  }

  async function togglePin(variant) {
    await supabase.from('product_variants').update({ is_pinned: !variant.is_pinned }).eq('id', variant.id)
    load()
  }

  function toggleSelect(id) {
    const copy = new Set(selected)
    copy.has(id) ? copy.delete(id) : copy.add(id)
    setSelected(copy)
  }

  async function bulkDelete() {
    if (!confirm(`Remove ${selected.size} selected product(s)? They'll move to Trash and can be restored.`)) return
    for (const id of selected) {
      await supabase.from('products').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id)
      await supabase.from('product_variants').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('product_id', id)
    }
    logActivity('bulk_deleted_products', 'product', null, { count: selected.size })
    setSelected(new Set())
    load()
  }

  async function bulkChangeCategory() {
    if (!bulkCategory) return
    for (const id of selected) {
      await supabase.from('products').update({ category_id: bulkCategory }).eq('id', id)
    }
    logActivity('bulk_recategorized_products', 'product', null, { count: selected.size, category: bulkCategory })
    setSelected(new Set())
    setBulkCategory('')
    load()
  }

  function shareItem(variant, product) {
    const text = `${product.name} — ${variant.size}/${variant.color}\nPrice: $${Number(variant.selling_price).toFixed(2)}\nStock: ${variant.quantity}\nBarcode: ${variant.barcode}`
    navigator.clipboard?.writeText(text)
    alert('Copied — paste it into Messenger or wherever you need it.')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Products</h1>
          <p className="text-inkfade text-sm">{filtered.length} variant{filtered.length !== 1 ? 's' : ''} shown</p>
        </div>
        <Link to="/products/new" className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setActiveCategory('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${activeCategory === 'all' ? 'bg-berry text-white' : 'bg-sand text-inkfade hover:bg-line'}`}>
          All
        </button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setActiveCategory(c.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${activeCategory === c.id ? 'bg-berry text-white' : 'bg-sand text-inkfade hover:bg-line'}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border border-line rounded-xl px-3 py-2 bg-white flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="text-inkfade" />
          <input ref={searchRef} className="flex-1 outline-none text-sm bg-transparent"
            placeholder="Search by name or barcode… (press /)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input type="number" placeholder="Min $" className="input w-24 py-2" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        <input type="number" placeholder="Max $" className="input w-24 py-2" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <div className="flex items-center gap-1.5 text-sm text-inkfade">
          <ArrowUpDown size={14} />
          <select className="input py-2" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-sand rounded-xl px-4 py-2 mb-4 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <select className="input py-1.5 w-40" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
            <option value="">Move to category…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={bulkChangeCategory} className="btn-secondary py-1.5 text-xs">Apply</button>
          <button onClick={bulkDelete} className="text-berry font-medium flex items-center gap-1 ml-auto"><Trash2 size={14} /> Delete selected</button>
        </div>
      )}

      {loading ? (
        <p className="text-inkfade text-sm">Loading…</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[24px_40px_1.3fr_0.9fr_0.5fr_0.5fr_0.5fr_0.6fr_0.6fr_0.9fr_auto] gap-2 px-4 py-2 text-xs font-medium text-inkfade border-b border-line bg-sand/60">
            <span></span><span></span><span>Product</span><span>Category</span><span>Size</span><span>Color</span><span>Qty</span><span>Price</span><span>Profit</span><span>Notes</span><span></span>
          </div>
          <div className="divide-y divide-line">
            {filtered.map(({ product, variant }) => {
              const isNewRow = daysSince(product.created_at) < 1
              const profit = variant ? (Number(variant.selling_price) - Number(variant.original_price)) : null
              const belowCost = variant && Number(variant.selling_price) < Number(variant.original_price)
              return (
                <div key={variant ? variant.id : product.id}
                  onClick={() => navigate(`/products/${product.id}/edit`)}
                  className={`grid grid-cols-2 md:grid-cols-[24px_40px_1.3fr_0.9fr_0.5fr_0.5fr_0.5fr_0.6fr_0.6fr_0.9fr_auto] gap-2 px-4 py-3 items-center text-sm cursor-pointer hover:bg-cream/60 ${isNewRow ? 'bg-sage/5' : ''}`}
                >
                  <div onClick={(e) => e.stopPropagation()} className="hidden md:flex items-center">
                    {variant && (
                      <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleSelect(product.id)} />
                    )}
                  </div>
                  <div className="hidden md:block"><Thumb src={variant?.photo_url || variant?.photo_urls?.[0]} size={36} /></div>
                  <div className="col-span-2 md:col-span-1">
                    <p className="font-medium flex items-center gap-1.5">
                      {product.name}
                      {variant?.is_pinned && <Star size={12} className="text-amber-500 fill-amber-500" />}
                      {variant?.is_best_color && <span className="text-[10px] bg-sage/15 text-sage px-1.5 py-0.5 rounded-full">best color</span>}
                    </p>
                    <p className="text-xs text-inkfade md:hidden">{product.categories?.name || '—'}</p>
                  </div>
                  <span className="hidden md:block text-inkfade">{product.categories?.name || '—'}</span>
                  <span>{variant?.size || '—'}</span>
                  <span>{variant?.color || '—'}</span>
                  <span className={variant?.quantity === 0 ? 'text-berry font-medium' : ''}>{variant ? variant.quantity : '—'}</span>
                  <span className="flex items-center gap-1">
                    {variant ? `$${Number(variant.selling_price).toFixed(2)}` : '—'}
                    {belowCost && <AlertTriangle size={12} className="text-berry" title="Selling below cost!" />}
                  </span>
                  <span className={profit !== null && profit < 0 ? 'text-berry' : 'text-sage'}>
                    {profit !== null ? `$${profit.toFixed(2)}` : '—'}
                  </span>
                  <span className="text-xs text-inkfade truncate hidden md:block">
                    {variant ? `Restocked ${daysSince(variant.last_restocked_at)}d ago` : ''}
                  </span>
                  <div className="flex items-center gap-2 justify-end col-span-2 md:col-span-1" onClick={(e) => e.stopPropagation()}>
                    {variant && (
                      <>
                        <button title="Log a sale" onClick={() => goToSell(variant, product.name)} disabled={variant.quantity === 0} className="text-sage disabled:opacity-30"><ShoppingCart size={16} /></button>
                        <button title="Adjust stock" onClick={() => openAdjustModal({ variant, product })} className="text-inkfade hover:text-berry"><MinusCircle size={16} /></button>
                        <button title="Pin as favorite" onClick={() => togglePin(variant)} className={variant.is_pinned ? 'text-amber-500' : 'text-inkfade hover:text-amber-500'}><Star size={16} /></button>
                        <button title="Share item details" onClick={() => shareItem(variant, product)} className="text-inkfade hover:text-ink"><Share2 size={16} /></button>
                      </>
                    )}
                    <Link to={`/products/${product.id}/edit`} title="Edit product" className="text-inkfade hover:text-ink"><Pencil size={16} /></Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-inkfade">
          <p className="mb-3">No products here yet.</p>
          <Link to="/products/new" className="text-berry font-medium">Add your first product →</Link>
        </div>
      )}

      {adjustTarget && (
        <Modal title={`Adjust stock — ${adjustTarget.product.name} (${adjustTarget.variant.size}/${adjustTarget.variant.color})`} onClose={() => setAdjustTarget(null)}>
          <div className="space-y-3">
            <p className="text-sm text-inkfade">Currently {adjustTarget.variant.quantity} in stock.</p>
            <div>
              <label className="label">Change (e.g. -1 for lost/damaged, +2 to correct a count)</label>
              <input type="number" className="input" autoFocus value={adjustForm.diff} onChange={(e) => setAdjustForm({ ...adjustForm, diff: e.target.value })} placeholder="-1" />
            </div>
            <div>
              <label className="label">Reason</label>
              <select className="input" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}>
                {ADJUST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <button onClick={confirmAdjust} disabled={adjustSaving} className="btn-primary w-full mt-2">{adjustSaving ? 'Saving…' : 'Save Adjustment'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
