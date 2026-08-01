import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, formatDateTime } from '../lib/helpers'
import { Wallet, Plus } from 'lucide-react'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)

  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(300)
    setTransactions(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = transactions.filter((t) => filter === 'all' || t.type === filter)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) { setError('Enter an amount greater than 0.'); return }
    setSaving(true)
    setError('')
    const { error } = await supabase.from('transactions').insert({
      type, amount: Number(amount), currency, description: description || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setAmount(''); setDescription(''); setShowForm(false)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Transactions</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 bg-berry hover:bg-berryDark text-cream font-medium rounded-lg px-4 py-2 transition-colors"
        >
          <Plus size={16} /> Add entry
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white/60 border border-line rounded-2xl p-4 mb-6 space-y-3 max-w-md">
          <div className="flex gap-2">
            {['expense', 'income'].map((t) => (
              <button
                key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium capitalize ${type === t ? 'bg-berry text-cream' : 'bg-sand text-inkfade'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount" className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-2 text-sm text-ink">
              <option value="USD">USD</option>
              <option value="KHR">KHR</option>
            </select>
          </div>
          <input
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          />
          {error && <p className="text-berryDark text-sm">{error}</p>}
          <button type="submit" disabled={saving} className="w-full bg-berry hover:bg-berryDark text-cream font-medium rounded-lg py-2 text-sm disabled:opacity-60">
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </form>
      )}

      <div className="flex gap-2 mb-6">
        {['all', 'income', 'expense'].map((f) => (
          <button
            key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${filter === f ? 'bg-berry text-cream' : 'bg-sand text-inkfade hover:text-ink'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-inkfade text-sm">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-inkfade">
          <Wallet className="mx-auto mb-3 opacity-40" size={40} />
          <p>No transactions yet.</p>
        </div>
      )}

      <div className="bg-white/60 border border-line rounded-2xl divide-y divide-line">
        {filtered.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-ink truncate">{t.description || '—'}</p>
              <p className="text-xs text-inkfade">{formatDateTime(t.created_at)}</p>
            </div>
            <span className={`text-sm font-medium shrink-0 ${t.type === 'income' ? 'text-sage' : 'text-berryDark'}`}>
              {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount, t.currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
