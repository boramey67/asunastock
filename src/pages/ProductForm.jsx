import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { generateBarcode, variantLabel } from '../lib/helpers'
import { Plus, Trash2, ArrowLeft, ImagePlus, PackagePlus } from 'lucide-react'

const emptyVariant = () => ({
  id: crypto.randomUUID(),
  isNew: true,
  size: '',
  color: '',
  barcode: generateBarcode(),
  price_usd: '',
  cost_usd: '',
  quantity: '',
  photo_url: '',
  photoFile: null,
  photoPreview: '',
})

export default function ProductForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [variants, setVariants] = useState([emptyVariant()])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [restockTarget, setRestockTarget] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: cats } = await supabase.from('categories').select('*').order('name')
      setCategories(cats || [])

      if (isEdit) {
        const { data: product } = await supabase
          .from('products')
          .select('*, product_variants(*)')
          .eq('id', id)
          .single()
        if (product) {
          setName(product.name)
          setDescription(product.description || '')
          setCategoryId(product.category_id || '')
          const existing = (product.product_variants || [])
            .filter((v) => !v.is_deleted)
            .map((v) => ({
              id: v.id,
              isNew: false,
              size: v.size || '',
              color: v.color || '',
              barcode: v.barcode || generateBarcode(),
              price_usd: v.price_usd,
              cost_usd: v.cost_usd,
              quantity: v.quantity,
              photo_url: v.photo_url || '',
              photoFile: null,
              photoPreview: '',
            }))
          setVariants(existing.length ? existing : [emptyVariant()])
        }
        setLoading(false)
      }
    }
    load()
  }, [id, isEdit])

  const updateVariant = (vid, field, value) => {
    setVariants((vs) => vs.map((v) => (v.id === vid ? { ...v, [field]: value } : v)))
  }

  const handlePhotoChange = (vid, file) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    setVariants((vs) => vs.map((v) => (v.id === vid ? { ...v, photoFile: file, photoPreview: preview } : v)))
  }

  const addVariant = () => setVariants((vs) => [...vs, emptyVariant()])

  const removeVariant = async (vid) => {
    const variant = variants.find((v) => v.id === vid)
    if (variants.length === 1) return
    if (!variant.isNew) {
      if (!confirm('Remove this variant? Its sales history will be kept, but it will no longer be sellable.')) return
      await supabase.from('product_variants').update({ is_deleted: true }).eq('id', vid)
    }
    setVariants((vs) => vs.filter((v) => v.id !== vid))
  }

  const uploadPhoto = async (variantId, file) => {
    const ext = file.name.split('.').pop()
    const path = `${variantId}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('product-photos').upload(path, file, { upsert: true })
    if (upErr) throw upErr
    const { data } = supabase.storage.from('product-photos').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Product name is required.'); return }
    if (variants.some((v) => !v.price_usd || v.quantity === '')) {
      setError('Every variant needs at least a price and a quantity.')
      return
    }

    setSaving(true)
    try {
      let productId = id
      if (isEdit) {
        const { error } = await supabase
          .from('products')
          .update({ name: name.trim(), description, category_id: categoryId || null })
          .eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert({ name: name.trim(), description, category_id: categoryId || null })
          .select()
          .single()
        if (error) throw error
        productId = data.id
      }

      for (const v of variants) {
        let photoUrl = v.photo_url
        if (v.photoFile) {
          photoUrl = await uploadPhoto(v.id, v.photoFile)
        }

        const payload = {
          id: v.id,
          product_id: productId,
          size: v.size || null,
          color: v.color || null,
          barcode: v.barcode || null,
          price_usd: Number(v.price_usd),
          cost_usd: Number(v.cost_usd) || 0,
          quantity: Number(v.quantity),
          photo_url: photoUrl || null,
          is_deleted: false,
        }

        if (v.isNew) {
          const { error } = await supabase.from('product_variants').insert(payload)
          if (error) throw error
          if (Number(v.quantity) > 0) {
            await supabase.from('stock_movements').insert({
              variant_id: v.id,
              product_name: name.trim(),
              variant_label: variantLabel(v),
              change_type: 'adjustment',
              quantity_change: Number(v.quantity),
              note: 'Initial stock on product creation',
            })
          }
        } else {
          const { error } = await supabase.from('product_variants').update(payload).eq('id', v.id)
          if (error) throw error
        }
      }

      navigate(`/products/${productId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-inkfade text-sm">Loading…</p>

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-inkfade hover:text-ink text-sm mb-4">
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="font-display text-2xl font-semibold text-ink mb-6">
        {isEdit ? 'Edit Product' : 'Add Product'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white/60 border border-line rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Product name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-berry"
              placeholder="e.g. Linen Wrap Dress"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-berry"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-berry"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold text-ink">Variants</h2>
            <button type="button" onClick={addVariant} className="flex items-center gap-1.5 text-sm text-berry hover:text-berryDark font-medium">
              <Plus size={16} /> Add variant
            </button>
          </div>

          <div className="space-y-4">
            {variants.map((v) => (
              <div key={v.id} className="bg-white/60 border border-line rounded-2xl p-4">
                <div className="flex gap-4">
                  <label className="shrink-0 w-20 h-20 rounded-lg bg-sand border border-line flex items-center justify-center cursor-pointer overflow-hidden">
                    {(v.photoPreview || v.photo_url) ? (
                      <img src={v.photoPreview || v.photo_url} className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus className="text-inkfade" size={22} />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoChange(v.id, e.target.files?.[0])}
                    />
                  </label>

                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <input
                      value={v.size}
                      onChange={(e) => updateVariant(v.id, 'size', e.target.value)}
                      placeholder="Size"
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-berry"
                    />
                    <input
                      value={v.color}
                      onChange={(e) => updateVariant(v.id, 'color', e.target.value)}
                      placeholder="Color"
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-berry"
                    />
                    <div className="flex gap-1 col-span-2 sm:col-span-1">
                      <input
                        value={v.barcode}
                        onChange={(e) => updateVariant(v.id, 'barcode', e.target.value)}
                        placeholder="Barcode"
                        className="flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-berry"
                      />
                    </div>
                    <input
                      type="number" step="0.01" min="0"
                      value={v.price_usd}
                      onChange={(e) => updateVariant(v.id, 'price_usd', e.target.value)}
                      placeholder="Price (USD)"
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-berry"
                    />
                    <input
                      type="number" step="0.01" min="0"
                      value={v.cost_usd}
                      onChange={(e) => updateVariant(v.id, 'cost_usd', e.target.value)}
                      placeholder="Cost (USD)"
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-berry"
                    />
                    <input
                      type="number" min="0"
                      value={v.quantity}
                      onChange={(e) => updateVariant(v.id, 'quantity', e.target.value)}
                      placeholder="Quantity"
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-berry"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  {!v.isNew ? (
                    <button
                      type="button"
                      onClick={() => setRestockTarget(v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-sage hover:text-sage/80"
                    >
                      <PackagePlus size={14} /> Restock
                    </button>
                  ) : <span />}
                  <button type="button" onClick={() => removeVariant(v.id)} className="text-inkfade hover:text-berryDark">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-berryDark text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-berry hover:bg-berryDark text-cream font-medium rounded-lg px-6 py-2.5 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </form>

      {restockTarget && (
        <RestockModal
          variant={restockTarget}
          productName={name}
          onClose={() => setRestockTarget(null)}
          onDone={() => {
            setRestockTarget(null)
            navigate(0) // reload to reflect new quantity/cost
          }}
        />
      )}
    </div>
  )
}

function RestockModal({ variant, productName, onClose, onDone }) {
  const [qty, setQty] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const qtyNum = Number(qty) || 0
  const feePerUnit = qtyNum > 0 ? (Number(deliveryFee) || 0) / qtyNum : 0
  const totalUnitCost = (Number(unitCost) || 0) + feePerUnit

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (qtyNum <= 0) { setError('Enter a quantity greater than 0.'); return }
    setSaving(true)
    setError('')
    try {
      const { data: current } = await supabase
        .from('product_variants')
        .select('quantity, cost_usd')
        .eq('id', variant.id)
        .single()

      const newQuantity = (current?.quantity || 0) + qtyNum
      // Weighted average cost across old stock + new delivery
      const oldValue = (current?.quantity || 0) * (Number(current?.cost_usd) || 0)
      const newValue = qtyNum * totalUnitCost
      const newAvgCost = newQuantity > 0 ? (oldValue + newValue) / newQuantity : totalUnitCost

      const { error: updErr } = await supabase
        .from('product_variants')
        .update({ quantity: newQuantity, cost_usd: newAvgCost.toFixed(2) })
        .eq('id', variant.id)
      if (updErr) throw updErr

      await supabase.from('stock_movements').insert({
        variant_id: variant.id,
        product_name: productName,
        variant_label: variantLabel(variant),
        change_type: 'restock',
        quantity_change: qtyNum,
        note: `Restocked ${qtyNum} units at $${Number(unitCost || 0).toFixed(2)}/unit + $${Number(deliveryFee || 0).toFixed(2)} delivery`,
      })

      if (Number(deliveryFee) > 0 || Number(unitCost) > 0) {
        await supabase.from('transactions').insert({
          type: 'expense',
          amount: (qtyNum * (Number(unitCost) || 0)) + (Number(deliveryFee) || 0),
          currency: 'USD',
          description: `Restock: ${productName} (${variantLabel(variant)}) x${qtyNum}`,
        })
      }

      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <div className="bg-cream rounded-2xl p-6 w-full max-w-sm border border-line">
        <h3 className="font-display text-lg font-semibold text-ink mb-1">Restock</h3>
        <p className="text-sm text-inkfade mb-4">{productName} — {variantLabel(variant)}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Quantity received</label>
            <input
              type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-berry"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Cost per unit (USD)</label>
            <input
              type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-berry"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Batch delivery fee (USD, optional)</label>
            <input
              type="number" step="0.01" min="0" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-berry"
            />
            <p className="text-xs text-inkfade mt-1">
              Split across quantity, this adds {formatFee(feePerUnit)} per unit — new average cost: {formatFee(totalUnitCost)}/unit.
            </p>
          </div>

          {error && <p className="text-berryDark text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-line py-2 text-sm text-inkfade hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-berry hover:bg-berryDark text-cream py-2 text-sm font-medium disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Confirm restock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatFee(n) {
  return `$${(Number(n) || 0).toFixed(2)}`
}
