import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMoney } from '../lib/helpers'
import { Plus, Trash2, Megaphone } from 'lucide-react'

export default function AdSpend() {
  const { user, logActivity } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ start_date: '', end_date: '', amount: '', note: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data: ads } = await supabase.from('ad_spend').select('*').eq('is_deleted', false).order('start_date', { ascending: false })
    const list = ads || []

    const enriched = await Promise.all(list.map(async (entry) => {
      const { data: orders } = await supabase
        .from('orders')
        .select('order_items(*)')
        .eq('is_deleted', false)
        .eq('status', 'active')
        .gte('order_date', entry.start_date)
        .lte('order_date', entry.end_date)
      let income = 0, cogs = 0
      ;(orders || []).forEach(o => (o.order_items || []).forEach(i => {
        income += Number(i.line_total || 0)
        cogs += Number(i.quantity || 0) * Number(i.cost_at_sale || 0)
      }))
      return { ...entry, income, cogs, trueProfit: income - cogs - Number(entry.amount) }
    }))

    setEntries(enriched)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addEntry(e) {
    e.preventDefault()
    if (!form.start_date || !form.end_date || !form.amount) { alert('Fill in the date range and amount'); return }
    if (form.end_date < form.start_date) { alert('End date must be after start date'); return }
    setSaving(true)
    const { data, error } = await supabase.from('ad_spend').insert({
      start_date: form.start_date, end_date: form.end_date,
      amount: Number(form.amount), note: form.note || null, created_by: user.id,
    }).select().single()
    setSaving(false)
    if (error) { alert(error.message); return }
    logActivity('added_ad_spend', 'ad_spend', data.id, { amount: form.amount })
    setForm({ start_date: '', end_date: '', amount: '', note: '' })
    load()
  }

  async function deleteEntry(entry) {
    if (!confirm('Delete this ad spend entry?')) return
    await supabase.from('ad_spend').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', entry.id)
    logActivity('deleted_ad_spend', 'ad_spend', entry.id, {})
    load()
  }

  const totalSpend = entries.reduce((s, e) => s + Number(e.amount), 0)
  const totalTrueProfit = entries.reduce((s, e) => s + e.trueProfit, 0)

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold mb-1 flex items-center gap-2">
        <Megaphone size={22} className="text-berry" /> Ad Spend
      </h1>
      <p className="text-inkfade text-sm mb-6">Track Facebook boost costs against the real sales they brought in — pull the amount straight from your Ads Manager billing for that date range.</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-inkfade mb-1">Total boost spent</p>
          <p className="font-display text-xl font-semibold text-berry">{formatMoney(totalSpend, 'USD')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-inkfade mb-1">Combined true profit</p>
          <p className={`font-display text-xl font-semibold ${totalTrueProfit >= 0 ? 'text-sage' : 'text-berry'}`}>{formatMoney(totalTrueProfit, 'USD')}</p>
          <p className="text-[11px] text-inkfade mt-0.5">Income − product cost − boost spend, across all entries below</p>
        </div>
      </div>

      <form onSubmit={addEntry} className="card p-5 space-y-3 mb-6">
        <h2 className="font-medium mb-1">Add a boost period</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start date</label>
            <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label className="label">End date</label>
            <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Amount spent ($, from Ads Manager billing)</label>
          <input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 25.00" />
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Jeans campaign" />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-1.5">
          <Plus size={16} /> {saving ? 'Saving…' : 'Add Boost Entry'}
        </button>
      </form>

      {loading ? (
        <p className="text-inkfade text-sm">Loading…</p>
      ) : (
        <div className="card divide-y divide-line">
          {entries.map((e) => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{e.start_date} → {e.end_date}</p>
                <button onClick={() => deleteEntry(e)} className="text-inkfade hover:text-berry"><Trash2 size={14} /></button>
              </div>
              {e.note && <p className="text-xs text-inkfade mb-2">{e.note}</p>}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><p className="text-inkfade">Boost spent</p><p className="font-medium text-berry">{formatMoney(e.amount, 'USD')}</p></div>
                <div><p className="text-inkfade">Income (period)</p><p className="font-medium text-sage">{formatMoney(e.income, 'USD')}</p></div>
                <div><p className="text-inkfade">Product cost</p><p className="font-medium">{formatMoney(e.cogs, 'USD')}</p></div>
                <div><p className="text-inkfade">True profit</p><p className={`font-medium ${e.trueProfit >= 0 ? 'text-sage' : 'text-berry'}`}>{formatMoney(e.trueProfit, 'USD')}</p></div>
              </div>
            </div>
          ))}
          {entries.length === 0 && <p className="text-center text-inkfade text-sm py-8">No boost spend logged yet — add your first one above.</p>}
        </div>
      )}
    </div>
  )
}
