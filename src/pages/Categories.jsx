import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (error) setError(error.message)
    setCategories(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    const { error } = await supabase.from('categories').insert({ name: newName.trim() })
    if (error) { setError(error.message); return }
    setNewName('')
    setError('')
    load()
  }

  const startEdit = (cat) => {
    setEditingId(cat.id)
    setEditingName(cat.name)
  }

  const saveEdit = async (id) => {
    if (!editingName.trim()) return
    const { error } = await supabase.from('categories').update({ name: editingName.trim() }).eq('id', id)
    if (error) { setError(error.message); return }
    setEditingId(null)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this category? Products in it will become uncategorized.')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { setError(error.message); return }
    load()
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Categories</h1>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6 max-w-md">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-berry"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 bg-berry hover:bg-berryDark text-cream font-medium rounded-lg px-4 py-2 transition-colors"
        >
          <Plus size={16} /> Add
        </button>
      </form>

      {error && <p className="text-berryDark text-sm mb-4">{error}</p>}

      <div className="bg-white/60 border border-line rounded-2xl divide-y divide-line max-w-md">
        {loading && <p className="p-4 text-inkfade text-sm">Loading…</p>}
        {!loading && categories.length === 0 && (
          <p className="p-4 text-inkfade text-sm">No categories yet.</p>
        )}
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between px-4 py-3">
            {editingId === cat.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="flex-1 rounded-lg border border-line bg-white px-2 py-1 mr-2 text-ink"
              />
            ) : (
              <span className="text-ink">{cat.name}</span>
            )}
            <div className="flex items-center gap-2 shrink-0">
              {editingId === cat.id ? (
                <>
                  <button onClick={() => saveEdit(cat.id)} className="text-sage hover:text-sage/80">
                    <Check size={18} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-inkfade hover:text-ink">
                    <X size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(cat)} className="text-inkfade hover:text-ink">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="text-inkfade hover:text-berryDark">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
