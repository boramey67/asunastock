import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isSimilarCategoryName } from '../lib/helpers'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Merge, Tag, Trophy } from 'lucide-react'
import Modal from '../components/Modal'
import { Thumb } from '../components/Thumb'

const COLORS = ['#9B4A5C', '#7A8B6F', '#C97C6D', '#6B7FA8', '#B8935A', '#8A6BA8']

export default function Categories() {
  const navigate = useNavigate()
  const { logActivity } = useAuth()
  const [categories, setCategories] = useState([])
  const [counts, setCounts] = useState({})
  const [topCategory, setTopCategory] = useState(null)
  const [newName, setNewName] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', color: COLORS[0], notes: '', cover_photo_url: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeFrom, setMergeFrom] = useState('')
  const [mergeTo, setMergeTo] = useState('')

  async function load() {
    const { data: cats } = await supabase.from('categories').select('*').eq('is_deleted', false).order('sort_order').order('name')
    setCategories(cats || [])

    const { data: prods } = await supabase.from('products').select('id, category_id').eq('is_deleted', false)
    const countMap = {}
    ;(prods || []).forEach(p => { if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] || 0) + 1 })
    setCounts(countMap)

    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, line_total, cost_at_sale, product_variants(products(category_id)), orders!inner(status)')
      .eq('orders.status', 'active')
    const profitMap = {}
    ;(items || []).forEach(i => {
      const catId = i.product_variants?.products?.category_id
      if (!catId) return
      const profit = Number(i.line_total || 0) - i.quantity * Number(i.cost_at_sale || 0)
      profitMap[catId] = (profitMap[catId] || 0) + profit
    })
    const top = Object.entries(profitMap).sort((a, b) => b[1] - a[1])[0]
    setTopCategory(top ? top[0] : null)
  }

  useEffect(() => { load() }, [])

  async function addCategory(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const dup = isSimilarCategoryName(newName, categories.map(c => c.name))
    if (dup && !confirm(`This looks similar to an existing category "${dup}". Add it anyway?`)) return

    const { data, error } = await supabase.from('categories').insert({ name: newName.trim(), sort_order: categories.length }).select().single()
    if (!error) {
      setNewName('')
      logActivity('created_category', 'category', data.id, { name: data.name })
      load()
    }
  }

  function openEdit(c) {
    setEditForm({ name: c.name, color: c.color || COLORS[0], notes: c.notes || '', cover_photo_url: c.cover_photo_url || '' })
    setEditTarget(c)
  }

  async function saveEdit() {
    await supabase.from('categories').update({
      name: editForm.name.trim(), color: editForm.color, notes: editForm.notes || null, cover_photo_url: editForm.cover_photo_url || null,
    }).eq('id', editTarget.id)
    logActivity('edited_category', 'category', editTarget.id, { name: editForm.name })
    setEditTarget(null)
    load()
  }

  async function uploadCover(file) {
    const path = `category-${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('product-photos').upload(path, file)
    if (error) { alert('Upload failed: ' + error.message); return }
    const { data } = supabase.storage.from('product-photos').getPublicUrl(path)
    setEditForm({ ...editForm, cover_photo_url: data.publicUrl })
  }

  function confirmDelete(c) {
    setDeleteTarget(c)
  }

  async function doDelete(moveToUncategorized) {
    const c = deleteTarget
    if (moveToUncategorized) {
      await supabase.from('products').update({ category_id: null, deleted_category_id: c.id }).eq('category_id', c.id)
    }
    await supabase.from('categories').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', c.id)
    logActivity('deleted_category', 'category', c.id, { name: c.name })
    setDeleteTarget(null)
    load()
  }

  async function move(idx, direction) {
    const copy = [...categories]
    const target = idx + direction
    if (target < 0 || target >= copy.length) return
    ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
    setCategories(copy)
    for (let i = 0; i < copy.length; i++) {
      await supabase.from('categories').update({ sort_order: i }).eq('id', copy[i].id)
    }
  }

  async function doMerge() {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return
    await supabase.from('products').update({ category_id: mergeTo }).eq('category_id', mergeFrom)
    await supabase.from('categories').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', mergeFrom)
    logActivity('merged_categories', 'category', mergeTo, { from: mergeFrom })
    setMergeOpen(false)
    setMergeFrom(''); setMergeTo('')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold">Categories</h1>
        <button onClick={() => setMergeOpen(true)} className="btn-secondary flex items-center gap-1.5 text-sm"><Merge size={14} /> Merge</button>
      </div>
      <p className="text-inkfade text-sm mb-6">Organize products into groups you use every day.</p>

      <form onSubmit={addCategory} className="flex gap-2 mb-6 max-w-lg">
        <input className="input" placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn-primary flex items-center gap-1 whitespace-nowrap"><Plus size={16} /> Add</button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {categories.map((c, idx) => (
          <div key={c.id} className="card overflow-hidden">
            <div onClick={() => navigate(`/categories/${c.id}`)} className="cursor-pointer">
              <div className="aspect-[3/2] bg-sand flex items-center justify-center relative">
                {c.cover_photo_url ? (
                  <img src={c.cover_photo_url} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <Tag size={28} style={{ color: c.color || '#9B4A5C' }} />
                )}
                {topCategory === c.id && (
                  <span className="absolute top-2 left-2 bg-white/90 text-amber-600 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Trophy size={10} /> Top category
                  </span>
                )}
                <span className="absolute bottom-2 right-2 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: c.color || '#9B4A5C' }} />
              </div>
              <div className="p-3">
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-inkfade">{counts[c.id] || 0} product{(counts[c.id] || 0) !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-3 pb-3 text-inkfade">
              <div className="flex items-center gap-1">
                <button onClick={() => move(idx, -1)} disabled={idx === 0}><ArrowUp size={14} className="disabled:opacity-20" /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === categories.length - 1}><ArrowDown size={14} className="disabled:opacity-20" /></button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(c)} className="hover:text-ink"><Pencil size={14} /></button>
                <button onClick={() => confirmDelete(c)} className="hover:text-berry"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-center text-inkfade text-sm py-6 col-span-full">No categories yet — add your first one above.</p>
        )}
      </div>

      {editTarget && (
        <Modal title="Edit category" onClose={() => setEditTarget(null)}>
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Cover photo</label>
              <div className="flex items-center gap-2">
                <Thumb src={editForm.cover_photo_url} size={40} />
                <label className="btn-secondary text-xs cursor-pointer">
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadCover(e.target.files[0])} />
                </label>
              </div>
            </div>
            <div>
              <label className="label">Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setEditForm({ ...editForm, color: c })}
                    className={`w-7 h-7 rounded-full ${editForm.color === c ? 'ring-2 ring-offset-2 ring-ink' : ''}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <label className="label">Notes (e.g. sizing tips)</label>
              <textarea className="input" rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <button onClick={saveEdit} className="btn-primary w-full">Save</button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title={`Delete "${deleteTarget.name}"?`} onClose={() => setDeleteTarget(null)}>
          {counts[deleteTarget.id] > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-inkfade">{counts[deleteTarget.id]} product(s) are still in this category. What should happen to them?</p>
              <button onClick={() => doDelete(true)} className="btn-primary w-full">Move them to Uncategorized, then delete</button>
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary w-full">Cancel</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-inkfade">This category has no products. Safe to delete.</p>
              <button onClick={() => doDelete(false)} className="btn-primary w-full">Delete</button>
            </div>
          )}
        </Modal>
      )}

      {mergeOpen && (
        <Modal title="Merge two categories" onClose={() => setMergeOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="label">Merge this category…</label>
              <select className="input" value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)}>
                <option value="">Select…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">…into this one</label>
              <select className="input" value={mergeTo} onChange={(e) => setMergeTo(e.target.value)}>
                <option value="">Select…</option>
                {categories.filter(c => c.id !== mergeFrom).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-inkfade">All products move to the target category, and the source category is deleted.</p>
            <button onClick={doMerge} disabled={!mergeFrom || !mergeTo} className="btn-primary w-full">Merge</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
