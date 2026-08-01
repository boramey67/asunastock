import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatMoney } from '../lib/helpers'
import { Plus, Package as PackageIcon } from 'lucide-react'

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase
        .from('products')
        .select('*, category:categories(name), product_variants(*)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = products.filter((p) =>
    categoryFilter === 'all' ? true : p.category_id === categoryFilter
  )

  const totalStock = (p) =>
    (p.product_variants || []).filter((v) => !v.is_deleted).reduce((sum, v) => sum + v.quantity, 0)

  const priceRange = (p) => {
    const variants = (p.product_variants || []).filter((v) => !v.is_deleted)
    if (variants.length === 0) return null
    const prices = variants.map((v) => Number(v.price_usd))
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    return min === max ? formatMoney(min) : `${formatMoney(min)} – ${formatMoney(max)}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Products</h1>
        <Link
          to="/products/new"
          className="flex items-center gap-1.5 bg-berry hover:bg-berryDark text-cream font-medium rounded-lg px-4 py-2 transition-colors"
        >
          <Plus size={16} /> Add Product
        </Link>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            categoryFilter === 'all' ? 'bg-berry text-cream' : 'bg-sand text-inkfade hover:text-ink'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryFilter(c.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              categoryFilter === c.id ? 'bg-berry text-cream' : 'bg-sand text-inkfade hover:text-ink'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading && <p className="text-inkfade text-sm">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-inkfade">
          <PackageIcon className="mx-auto mb-3 opacity-40" size={40} />
          <p>No products yet. Add your first one.</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((p) => {
          const firstPhoto = (p.product_variants || []).find((v) => v.photo_url)?.photo_url
          return (
            <Link
              key={p.id}
              to={`/products/${p.id}`}
              className="bg-white/60 border border-line rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-sand flex items-center justify-center overflow-hidden">
                {firstPhoto ? (
                  <img src={firstPhoto} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <PackageIcon className="text-line" size={32} />
                )}
              </div>
              <div className="p-3">
                <p className="font-medium text-ink text-sm truncate">{p.name}</p>
                <p className="text-xs text-inkfade mb-1">{p.category?.name || 'Uncategorized'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink">{priceRange(p) || '—'}</span>
                  <span className={`text-xs ${totalStock(p) === 0 ? 'text-berryDark' : 'text-sage'}`}>
                    {totalStock(p)} in stock
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
