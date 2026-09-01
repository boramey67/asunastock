import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMoney, dayKey, monthKey } from '../lib/helpers'
import { Thumb } from '../components/Thumb'
import { Trash2 } from 'lucide-react'

export default function Transactions() {
  const navigate = useNavigate()
  const { logActivity } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [orderPhotos, setOrderPhotos] = useState({})
  const [filter, setFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('today')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('transactions').select('*, profiles(name)').eq('is_deleted', false).order('created_at', { ascending: false }).limit(500)
      setTransactions(data || [])

      const orderIds = [...new Set((data || []).filter(t => t.related_order_id).map(t => t.related_order_id))]
      if (orderIds.length > 0) {
        const { data: items } = await supabase.from('order_items').select('order_id, product_variants(photo_url)').in('order_id', orderIds)
        const map = {}
        ;(items || []).forEach(i => { if (!map[i.order_id]) map[i.order_id] = i.product_variants?.photo_url })
        setOrderPhotos(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const today = new Date()
    if (datePreset === 'today') {
      const t = today.toISOString().slice(0, 10)
      setDateFrom(t); setDateTo(t)
    } else if (datePreset === 'week') {
      const d = new Date(today); d.setDate(d.getDate() - 7)
      setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today.toISOString().slice(0, 10))
    } else if (datePreset === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today.toISOString().slice(0, 10))
    } else if (datePreset === 'lastmonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      setDateFrom(start.toISOString().slice(0, 10)); setDateTo(end.toISOString().slice(0, 10))
    } else if (datePreset === 'all') {
      setDateFrom(''); setDateTo('')
    }
  }, [datePreset])

  const categories = [...new Set(transactions.map(t => t.category).filter(Boolean))]

  const filtered = transactions.filter(t => {
    const matchesType = filter === 'all' || t.type === filter
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter
    const day = dayKey(t.created_at)
    const matchesFrom = !dateFrom || day >= dateFrom
    const matchesTo = !dateTo || day <= dateTo
    return matchesType && matchesCategory && matchesFrom && matchesTo
  })

  const totals = useMemo(() => {
    const t = { USD: { income: 0, expense: 0 }, KHR: { income: 0, expense: 0 } }
    filtered.forEach(tx => { if (t[tx.currency]) t[tx.currency][tx.type] += Number(tx.amount || 0) })
    return t
  }, [filtered])

  const categoryBreakdown = useMemo(() => {
    const map = {}
    let total = 0
    filtered.forEach(t => { map[t.category || 'Other'] = (map[t.category || 'Other'] || 0) + Number(t.amount || 0); total += Number(t.amount || 0) })
    return Object.entries(map).map(([name, amt]) => ({ name, amt, pct: total ? (amt / total * 100) : 0 })).sort((a, b) => b.amt - a.amt)
  }, [filtered])

  const expenseComparison = useMemo(() => {
    const today = new Date()
    const thisMonthKey = monthKey(today.toISOString())
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthKeyStr = monthKey(lastMonthDate.toISOString())
    let thisMonth = 0, lastMonth = 0
    transactions.forEach(t => {
      if (t.type !== 'expense') return
      const k = monthKey(t.created_at)
      if (k === thisMonthKey) thisMonth += Number(t.amount || 0)
      if (k === lastMonthKeyStr) lastMonth += Number(t.amount || 0)
    })
    return { thisMonth, lastMonth, pct: lastMonth ? ((thisMonth - lastMonth) / lastMonth * 100) : null }
  }, [transactions])

  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(t => {
      const key = dayKey(t.created_at)
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  async function deleteTransaction(t, e) {
    e.stopPropagation()
    if (!confirm('Delete this transaction? It moves to Trash and can be restored.')) return
    await supabase.from('transactions').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', t.id)
    logActivity('deleted_transaction', 'transaction', t.id, {})
    setTransactions(transactions.filter(x => x.id !== t.id))
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-1">Transactions</h1>
      <p className="text-inkfade text-sm mb-4">Income from sales and expenses from restocking / returns.</p>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {['all', 'income', 'expense'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filter === f ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>{f}</button>
        ))}
        <select className="input py-1.5 text-xs w-40" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {['today', 'all', 'week', 'month', 'lastmonth'].map(p => (
          <button key={p} onClick={() => setDatePreset(p)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${datePreset === p ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>
            {p === 'all' ? 'All time' : p === 'today' ? 'Today' : p === 'week' ? 'This week' : p === 'month' ? 'This month' : 'Last month'}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6 mt-4">
        <div className="card p-4">
          <p className="text-xs text-inkfade mb-2">Totals (filtered)</p>
          <div className="flex justify-between text-sm"><span>Income USD</span><span className="text-sage font-medium">{formatMoney(totals.USD.income, 'USD')}</span></div>
          <div className="flex justify-between text-sm"><span>Expense USD</span><span className="text-berry font-medium">{formatMoney(totals.USD.expense, 'USD')}</span></div>
          {(totals.KHR.income > 0 || totals.KHR.expense > 0) && (
            <>
              <div className="flex justify-between text-sm mt-2 pt-2 border-t border-line"><span>Income KHR</span><span className="text-sage font-medium">{formatMoney(totals.KHR.income, 'KHR')}</span></div>
              <div className="flex justify-between text-sm"><span>Expense KHR</span><span className="text-berry font-medium">{formatMoney(totals.KHR.expense, 'KHR')}</span></div>
            </>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs text-inkfade mb-2">Category breakdown</p>
          {categoryBreakdown.slice(0, 5).map(c => (
            <div key={c.name} className="flex items-center gap-2 text-xs mb-1.5">
              <span className="w-24 truncate">{c.name}</span>
              <div className="flex-1 bg-sand rounded-full h-2 overflow-hidden"><div className="bg-berry h-2" style={{ width: `${c.pct}%` }} /></div>
              <span className="w-10 text-right text-inkfade">{c.pct.toFixed(0)}%</span>
            </div>
          ))}
          {categoryBreakdown.length === 0 && <p className="text-xs text-inkfade">Nothing to show yet.</p>}
        </div>
      </div>

      {expenseComparison.pct !== null && (
        <p className="text-xs text-inkfade mb-4">
          Expenses this month: {formatMoney(expenseComparison.thisMonth)} — {expenseComparison.pct >= 0 ? '+' : ''}{expenseComparison.pct.toFixed(0)}% vs last month ({formatMoney(expenseComparison.lastMonth)})
        </p>
      )}

      {loading ? (
        <p className="text-inkfade text-sm">Loading…</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <p className="text-xs font-medium text-inkfade mb-2">{day}</p>
              <div className="card divide-y divide-line">
                {items.map((t) => (
                  <div key={t.id} onClick={() => t.related_order_id && navigate('/orders')} className={`flex items-center justify-between px-4 py-3 ${t.related_order_id ? 'cursor-pointer hover:bg-cream/60' : ''}`}>
                    <div className="flex items-center gap-3">
                      {t.category === 'Sale' && <Thumb src={orderPhotos[t.related_order_id]} size={32} />}
                      <div>
                        <p className="text-sm font-medium">{t.category || (t.type === 'income' ? 'Sale' : 'Expense')}</p>
                        <p className="text-xs text-inkfade">{t.note || '—'} · {t.profiles?.name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium text-sm ${t.type === 'income' ? 'text-sage' : 'text-berry'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount, t.currency)}
                      </span>
                      <button onClick={(e) => deleteTransaction(t, e)} className="text-inkfade hover:text-berry"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && <p className="text-center text-inkfade text-sm py-8">No transactions match.</p>}
        </div>
      )}
    </div>
  )
}
