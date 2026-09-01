import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateBarcode, trueCostPerItem, daysSince, suggestUniqueBarcode, compressImage } from '../lib/helpers'
import { Plus, Trash2, Upload, ArrowLeft, Star, BarChart3, X } from 'lucide-react'
import Modal from '../components/Modal'
import { Thumb } from '../components/Thumb'

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size']

export default function ProductForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user, logActivity } = useAuth()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [categories, setCategories] = useState([])
  const [variants, setVariants] = useState([])
  const [saving, setSaving] = useState(false)
  const [restockTarget, setRestockTarget] = useState(null)
  const [restockForm, setRestockForm] = useState({ quantity: '', price: '', fee: '' })
  const [restockSaving, setRestockSaving] = useState(false)
  const [bulkSizes, setBulkSizes] = useState('')
  const [historyTarget, setHistoryTarget] = useState(null)
  const [historyData, setHistoryData] = useState(null)
  const [barcodeWarnings, setBarcodeWarnings] = useState({})
  const [allBarcodes, setAllBarcodes] = useState([])
  const [uploadingIdx, setUploadingIdx] = useState(null)

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_deleted', false).order('name').then(({ data }) => setCategories(data || []))
    supabase.from('product_variants').select('id, barcode').then(({ data }) => setAllBarcodes(data || []))
    if (isEdit) {
      supabase.from('products').select('*, product_variants(*)').eq('id', id).single().then(({ data }) => {
        if (!data) return
        setName(data.name)
        setCategoryId(data.category_id || '')
        setNotes(data.notes || '')
        setVariants((data.product_variants || []).filter(v => !v.is_deleted))
      })
    } else {
      const last = localStorage.getItem('lastUsedCategoryId')
      if (last) setCategoryId(last)
    }
  }, [id])

  function checkBarcode(idx, value) {
    updateVariant(idx, 'barcode', value)
    const v = variants[idx]
    const isDup = allBarcodes.some(b => b.barcode === value && b.id !== v.id)
    setBarcodeWarnings({ ...barcodeWarnings, [idx]: isDup })
  }

  function autoFixBarcode(idx) {
    const current = variants[idx].barcode
    const fixed = suggestUniqueBarcode(current, allBarcodes.map(b => b.barcode))
    updateVariant(idx, 'barcode', fixed)
    setBarcodeWarnings({ ...barcodeWarnings, [idx]: false })
  }

  function addVariantRow() {
    setVariants([...variants, {
      _new: true,
      size: '', color: '', quantity: 0, original_price: 0,
      delivery_fee: 0, selling_price: 0, photo_url: '', photo_urls: [], barcode: ''
    }])
  }

  function addBulkSizeRows() {
    const sizes = bulkSizes.split(',').map(s => s.trim()).filter(Boolean)
    if (sizes.length === 0) return
    const newRows = sizes.map(size => ({
      _new: true, size, color: '', quantity: 0, original_price: 0,
      delivery_fee: 0, selling_price: 0, photo_url: '', photo_urls: [], barcode: ''
    }))
    setVariants([...variants, ...newRows])
    setBulkSizes('')
  }

  function duplicateVariant(idx) {
    const v = variants[idx]
    setVariants([...variants, { ...v, _new: true, id: undefined, size: '', color: '' }])
  }

  function updateVariant(idx, field, value) {
    const copy = [...variants]
    copy[idx] = { ...copy[idx], [field]: value }
    setVariants(copy)
  }

  async function uploadPhoto(idx, file, isGallery = false) {
    setUploadingIdx(idx)
    try {
      const compressed = await compressImage(file)
      const path = `${Date.now()}-${compressed.name}`
      const { error } = await supabase.storage.from('product-photos').upload(path, compressed)
      if (error) { alert('Photo upload failed: ' + error.message); return }
      const { data } = supabase.storage.from('product-photos').getPublicUrl(path)
      if (isGallery) {
        const current = variants[idx].photo_urls || []
        updateVariant(idx, 'photo_urls', [...current, data.publicUrl])
      } else {
        updateVariant(idx, 'photo_url', data.publicUrl)
      }
    } catch (err) {
      alert('Photo processing failed: ' + err.message)
    } finally {
      setUploadingIdx(null)
    }
  }

  function removeGalleryPhoto(idx, photoUrl) {
    const current = variants[idx].photo_urls || []
    updateVariant(idx, 'photo_urls', current.filter(p => p !== photoUrl))
  }

  async function openSalesHistory(variant) {
    setHistoryTarget(variant)
    const { data } = await supabase
      .from('order_items')
      .select('quantity, line_total, cost_at_sale, orders!inner(status, order_date)')
      .eq('variant_id', variant.id)
      .eq('orders.status', 'active')
    const totalSold = (data || []).reduce((s, i) => s + i.quantity, 0)
    const totalRevenue = (data || []).reduce((s, i) => s + Number(i.line_total || 0), 0)
    const totalProfit = (data || []).reduce((s, i) => s + (Number(i.line_total || 0) - i.quantity * Number(i.cost_at_sale || 0)), 0)
    setHistoryData({ totalSold, totalRevenue, totalProfit, orderCount: (data || []).length })
  }

  async function handleSave() {
    if (!name.trim()) { alert('Product name is required'); return }
    if (Object.values(barcodeWarnings).some(Boolean)) { alert('Fix the duplicate barcode warning before saving.'); return }
    setSaving(true)
    if (categoryId) localStorage.setItem('lastUsedCategoryId', categoryId)

    let productId = id
    if (isEdit) {
      await supabase.from('products').update({ name, category_id: categoryId || null, notes: notes || null }).eq('id', id)
      logActivity('edited_product', 'product', id, { name })
    } else {
      const { data, error } = await supabase.from('products')
        .insert({ name, category_id: categoryId || null, notes: notes || null, created_by: user.id })
        .select().single()
      if (error) { alert(error.message); setSaving(false); return }
      productId = data.id
      logActivity('created_product', 'product', productId, { name })
    }

    for (const v of variants) {
      if (v._new) {
        const barcode = v.barcode || generateBarcode(name, v.size, v.color)
        const { data: variant, error } = await supabase.from('product_variants').insert({
          product_id: productId,
          size: v.size, color: v.color,
          barcode,
          photo_url: v.photo_url || null,
          photo_urls: v.photo_urls || [],
          quantity: Number(v.quantity) || 0,
          original_price: Number(v.original_price) || 0,
          selling_price: Number(v.selling_price) || 0,
          last_restocked_at: new Date().toISOString(),
        }).select().single()
        if (error) { console.error(error); continue }

        if (Number(v.quantity) > 0) {
          const costPerItem = trueCostPerItem(v.original_price, v.delivery_fee, v.quantity)
          const { data: restock } = await supabase.from('restocks').insert({
            variant_id: variant.id, quantity: Number(v.quantity),
            unit_cost: Number(v.original_price) || 0, delivery_fee: Number(v.delivery_fee) || 0,
            cost_per_item: costPerItem, created_by: user.id,
          }).select().single()

          await supabase.from('stock_movements').insert({
            variant_id: variant.id, change_qty: Number(v.quantity), reason: 'restock',
            related_restock_id: restock?.id, created_by: user.id,
          })

          if (Number(v.delivery_fee) > 0) {
            await supabase.from('transactions').insert({
              type: 'expense', amount: Number(v.delivery_fee), currency: 'USD',
              category: 'Delivery / Restock Fee', related_restock_id: restock?.id,
              note: `Restock delivery fee for ${name} (${v.size}/${v.color})`, created_by: user.id,
            })
          }
        }
        logActivity('added_variant', 'product_variant', variant.id, { size: v.size, color: v.color })
      } else {
        const original = (await supabase.from('product_variants').select('selling_price, original_price').eq('id', v.id).single()).data
        await supabase.from('product_variants').update({
          size: v.size, color: v.color,
          selling_price: Number(v.selling_price) || 0,
          photo_url: v.photo_url || null,
          photo_urls: v.photo_urls || [],
          barcode: v.barcode,
          quantity: Number(v.quantity) || 0,
          original_price: Number(v.original_price) || 0,
        }).eq('id', v.id)

        if (original && Number(original.selling_price) !== Number(v.selling_price)) {
          await supabase.from('price_history').insert({
            variant_id: v.id, old_price: original.selling_price, new_price: Number(v.selling_price), changed_by: user.id,
          })
        }
      }
    }

    setSaving(false)
    navigate('/products')
  }

  async function removeVariant(idx) {
    const v = variants[idx]
    if (!v._new) {
      if (!confirm('Remove this variant? It will be hidden but its sales history stays intact.')) return
      await supabase.from('product_variants').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', v.id)
    }
    setVariants(variants.filter((_, i) => i !== idx))
  }

  function openRestockModal(idx) {
    const v = variants[idx]
    setRestockForm({ quantity: '', price: v.original_price || '', fee: '' })
    setRestockTarget(idx)
  }

  async function confirmRestock() {
    const idx = restockTarget
    const v = variants[idx]
    const qty = Number(restockForm.quantity)
    const price = Number(restockForm.price)
    const fee = Number(restockForm.fee) || 0
    if (!qty || qty <= 0) { alert('Enter a valid quantity'); return }
    if (isNaN(price) || price < 0) { alert('Enter a valid price'); return }

    setRestockSaving(true)
    const costPerItem = trueCostPerItem(price, fee, qty)
    const { data: restock } = await supabase.from('restocks').insert({
      variant_id: v.id, quantity: qty, unit_cost: price, delivery_fee: fee,
      cost_per_item: costPerItem, created_by: user.id,
    }).select().single()

    const newQty = Number(v.quantity) + qty
    await supabase.from('product_variants').update({
      quantity: newQty, original_price: price, last_restocked_at: new Date().toISOString(),
    }).eq('id', v.id)

    await supabase.from('stock_movements').insert({
      variant_id: v.id, change_qty: qty, reason: 'restock',
      related_restock_id: restock?.id, created_by: user.id,
    })

    if (fee > 0) {
      await supabase.from('transactions').insert({
        type: 'expense', amount: fee, currency: 'USD', category: 'Delivery / Restock Fee',
        related_restock_id: restock?.id, note: `Restock delivery fee for ${name} (${v.size}/${v.color})`, created_by: user.id,
      })
    }

    logActivity('restocked_variant', 'product_variant', v.id, { quantity: qty })
    updateVariant(idx, 'quantity', newQty)
    updateVariant(idx, 'original_price', price)
    setRestockSaving(false)
    setRestockTarget(null)
  }

  async function toggleBestColor(idx) {
    const v = variants[idx]
    if (v._new) { updateVariant(idx, 'is_best_color', !v.is_best_color); return }
    await supabase.from('product_variants').update({ is_best_color: !v.is_best_color }).eq('id', v.id)
    updateVariant(idx, 'is_best_color', !v.is_best_color)
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/products')} className="flex items-center gap-1 text-inkfade text-sm mb-4 hover:text-ink">
        <ArrowLeft size={16} /> Back to products
      </button>

      <h1 className="font-display text-2xl font-semibold mb-6">{isEdit ? 'Edit Product' : 'Add Product'}</h1>

      <div className="card p-5 space-y-4 mb-6">
        <div>
          <label className="label">Product name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ribbed Knit Polo" />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Notes (fabric, care instructions, anything extra)</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Runs small, hand wash only" />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">Variants (size / color)</h2>
        <div className="flex items-center gap-2">
          <input className="input py-1.5 text-sm w-40" placeholder="S,M,L then Quick Add" value={bulkSizes} onChange={(e) => setBulkSizes(e.target.value)} />
          <button onClick={addBulkSizeRows} className="btn-secondary text-xs py-1.5">Quick Add</button>
          <button onClick={addVariantRow} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Add Variant
          </button>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {variants.map((v, idx) => (
          <div key={v.id || idx} className="card p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Size</label>
                <input list="sizes" className="input" value={v.size} onChange={(e) => updateVariant(idx, 'size', e.target.value)} placeholder="M" />
                <datalist id="sizes">{STANDARD_SIZES.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div>
                <label className="label">Color</label>
                <input className="input" value={v.color} onChange={(e) => updateVariant(idx, 'color', e.target.value)} placeholder="Black" />
              </div>
              <div>
                <label className="label">Selling price ($)</label>
                <input type="number" step="0.01" className="input" value={v.selling_price} onChange={(e) => updateVariant(idx, 'selling_price', e.target.value)} />
                {Number(v.selling_price) < Number(v.original_price) && (
                  <p className="text-[11px] text-berry mt-1">⚠ Below cost (${Number(v.original_price).toFixed(2)}) — you'd lose money</p>
                )}
              </div>
              <div>
                <label className="label">Cover photo (shows in lists)</label>
                <label className="input flex items-center gap-2 cursor-pointer text-inkfade">
                  <Upload size={14} />
                  <span className="text-xs truncate">{uploadingIdx === idx ? 'Compressing…' : v.photo_url ? 'Change photo' : 'Upload'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadPhoto(idx, e.target.files[0])} />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Thumb src={v.photo_url} size={44} />
              {(v.photo_urls || []).map((p) => (
                <div key={p} className="relative">
                  <Thumb src={p} size={44} />
                  <button onClick={() => removeGalleryPhoto(idx, p)} className="absolute -top-1.5 -right-1.5 bg-berry text-white rounded-full w-4 h-4 flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              ))}
              <label className="w-11 h-11 rounded-lg border border-dashed border-line flex items-center justify-center cursor-pointer text-inkfade">
                <Plus size={16} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadPhoto(idx, e.target.files[0], true)} />
              </label>
              <span className="text-[11px] text-inkfade">extra photos — front/back etc. (these don't show as the main thumbnail)</span>
            </div>

            {v._new ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-line pt-3">
                <div>
                  <label className="label">Initial quantity</label>
                  <input type="number" className="input" value={v.quantity} onChange={(e) => updateVariant(idx, 'quantity', e.target.value)} />
                </div>
                <div>
                  <label className="label">Original price ($/unit)</label>
                  <input type="number" step="0.01" className="input" value={v.original_price} onChange={(e) => updateVariant(idx, 'original_price', e.target.value)} />
                </div>
                <div>
                  <label className="label">Batch delivery fee ($, optional)</label>
                  <input type="number" step="0.01" className="input" value={v.delivery_fee} onChange={(e) => updateVariant(idx, 'delivery_fee', e.target.value)} />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="label">Barcode (leave blank to auto-generate)</label>
                  <input className="input" value={v.barcode} onChange={(e) => checkBarcode(idx, e.target.value)} placeholder="Auto-generated if left blank" />
                  {barcodeWarnings[idx] && (
                    <p className="text-[11px] text-berry mt-1 flex items-center gap-2">
                      ⚠ That barcode is already used by another item.
                      <button onClick={() => autoFixBarcode(idx)} className="underline">Auto-fix it</button>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-line pt-3 mb-2">
                <div>
                  <label className="label">Quantity (direct fix)</label>
                  <input type="number" className="input" value={v.quantity} onChange={(e) => updateVariant(idx, 'quantity', Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Original price ($/unit)</label>
                  <input type="number" step="0.01" className="input" value={v.original_price} onChange={(e) => updateVariant(idx, 'original_price', Number(e.target.value))} />
                </div>
                <div className="col-span-2 flex items-end">
                  <p className="text-[11px] text-inkfade">Use these to correct a mistake directly. For real new stock arriving, use "+ Add stock" instead so cost history stays accurate.</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3 text-sm flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-inkfade">{v.quantity} in stock ·</span>
                  <input className="input py-1 w-40 font-mono text-xs" value={v.barcode} onChange={(e) => checkBarcode(idx, e.target.value)} />
                  <span className="text-inkfade">· restocked {daysSince(v.last_restocked_at)}d ago</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => openSalesHistory(v)} className="text-inkfade hover:text-ink flex items-center gap-1 text-xs"><BarChart3 size={13} /> Sales history</button>
                  <button onClick={() => openRestockModal(idx)} className="text-berry font-medium">+ Add stock</button>
                </div>
              </div>
              {barcodeWarnings[idx] && (
                <p className="text-[11px] text-berry mt-2 flex items-center gap-2">
                  ⚠ That barcode is already used by another item.
                  <button onClick={() => autoFixBarcode(idx)} className="underline">Auto-fix it</button>
                </p>
              )}
              </>
            )}

            <div className="flex items-center justify-between mt-3">
              <button onClick={() => toggleBestColor(idx)} className={`text-xs flex items-center gap-1 ${v.is_best_color ? 'text-sage' : 'text-inkfade hover:text-sage'}`}>
                <Star size={12} className={v.is_best_color ? 'fill-sage' : ''} /> {v.is_best_color ? 'Marked as best color' : 'Mark as best-selling color'}
              </button>
              <div className="flex items-center gap-3">
                {!v._new && (
                  <button onClick={() => duplicateVariant(idx)} className="text-inkfade hover:text-ink text-xs">Duplicate</button>
                )}
                <button onClick={() => removeVariant(idx)} className="text-inkfade hover:text-berry text-xs flex items-center gap-1">
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        {variants.length === 0 && (
          <p className="text-inkfade text-sm text-center py-6 card">No variants yet — add a size/color combo above.</p>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
        {saving ? 'Saving…' : 'Save Product'}
      </button>

      {restockTarget !== null && (
        <Modal title={`Add stock — ${variants[restockTarget]?.size}/${variants[restockTarget]?.color}`} onClose={() => setRestockTarget(null)}>
          <div className="space-y-3">
            <div>
              <label className="label">How many units are you adding?</label>
              <input type="number" className="input" autoFocus value={restockForm.quantity} onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })} placeholder="e.g. 10" />
            </div>
            <div>
              <label className="label">Original price per unit ($)</label>
              <input type="number" step="0.01" className="input" value={restockForm.price} onChange={(e) => setRestockForm({ ...restockForm, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Total delivery fee for this batch ($, optional)</label>
              <input type="number" step="0.01" className="input" value={restockForm.fee} onChange={(e) => setRestockForm({ ...restockForm, fee: e.target.value })} placeholder="0" />
            </div>
            <button onClick={confirmRestock} disabled={restockSaving} className="btn-primary w-full mt-2">{restockSaving ? 'Adding…' : 'Add Stock'}</button>
          </div>
        </Modal>
      )}

      {historyTarget && (
        <Modal title={`Sales history — ${historyTarget.size}/${historyTarget.color}`} onClose={() => { setHistoryTarget(null); setHistoryData(null) }}>
          {!historyData ? (
            <p className="text-sm text-inkfade">Loading…</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-inkfade">Total sold</span><span className="font-medium">{historyData.totalSold} units</span></div>
              <div className="flex justify-between"><span className="text-inkfade">Across orders</span><span className="font-medium">{historyData.orderCount}</span></div>
              <div className="flex justify-between"><span className="text-inkfade">Total revenue</span><span className="font-medium">${historyData.totalRevenue.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-inkfade">Total profit</span><span className="font-medium text-sage">${historyData.totalProfit.toFixed(2)}</span></div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
