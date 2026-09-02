import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/helpers'
import { ArrowLeft } from 'lucide-react'
import { Thumb } from '../components/Thumb'

export default function CategoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('*').eq('id', id).single()
      setCategory(cat)
      const { data: prods } = await supabase.from('products').select('*, product_variants(*)').eq('category_id', id).eq('is_deleted', false)
      const flattened = []
      ;(prods || []).forEach(p => (p.product_variants || []).filter(v => !v.is_deleted).forEach(v => flattened.push({ product: p, variant: v })))
      setRows(flattened)
      setLoading(false)
    }
    load()
  }, [id])

  const totalStock = rows.reduce((s, r) => s + (r.variant.quantity || 0), 0)
  const totalValue = rows.reduce((s, r) => s + (r.variant.quantity || 0) * (r.variant.original_price || 0), 0)

  if (loading) return <p className="text-inkfade text-sm">Loading…</p>
  if (!category) return <p className="text-inkfade text-sm">Category not found.</p>

  return (
    <div>
      <button onClick={() => navigate('/categories')} className="flex items-center gap-1 text-inkfade text-sm mb-4 hover:text-ink">
        <ArrowLeft size={16} /> Back to categories
      </button>
      <div className="flex items-center gap-3 mb-2">
        <span className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color || '#9B4A5C' }} />
        <h1 className="font-display text-2xl font-semibold">{category.name}</h1>
      </div>
      {category.notes && <p className="text-inkfade text-sm mb-4">{category.notes}</p>}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4"><p className="text-xs text-inkfade mb-1">Total stock</p><p className="font-display text-xl font-semibold">{totalStock}</p></div>
        <div className="card p-4"><p className="text-xs text-inkfade mb-1">Inventory value</p><p className="font-display text-xl font-semibold">{formatMoney(totalValue)}</p></div>
      </div>

      <div className="card divide-y divide-line">
        {rows.map(({ product, variant }) => (
          <Link key={variant.id} to={`/products/${product.id}/edit`} className="flex items-center gap-3 px-4 py-3 hover:bg-cream/60">
            <Thumb src={variant.photo_url} size={36} />
            <div className="flex-1">
              <p className="text-sm font-medium">{product.name} — {variant.size}/{variant.color}</p>
              <p className="text-xs text-inkfade">{variant.quantity} in stock</p>
            </div>
            <span className="text-sm font-medium">${Number(variant.selling_price).toFixed(2)}</span>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-center text-inkfade text-sm py-8">No products in this category yet.</p>}
      </div>
    </div>
  )
}
