import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, startOfDay, startOfWeek, startOfMonth } from '../lib/helpers'
import { Package, AlertTriangle, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function Dashboard() {
  const [variants, setVariants] = useState([])
  const [products, setProducts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [orders, setOrders] = useState([])
  const [movements, setMovements] = useState([])
  const [range, setRange] = useState('day') // day | week | month
  const [exchangeRate, setExchangeRate] = useState(4100)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: v }, { data: p }, { data: t }, { data: o }, { data: m }, { data: s }] = await Promise.all([
        supabase.from('product_variants').select('*').eq('is_deleted', false),
        supabase.from('products').select('*').eq('is_deleted', false),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('settings').select('*').eq('key', 'exchange_rate_khr_per_usd').single(),
      ])
      setVariants(v || [])
      setProducts(p || [])
      setTransactions(t || [])
      setOrders(o || [])
      setMovements(m || [])
      if (s) setExchangeRate(Number(s.value))
      setLoading(false)
    }
    load()
  }, [])

  const toUsd = (amount, currency) => (currency === 'KHR' ? Number(amount) / exchangeRate : Number(amount))

  const stockOnHand = variants.reduce((sum, v) => sum + v.quantity, 0)
  const inventoryValue = variants.reduce((sum, v) => sum + v.quantity * Number(v.cost_usd || 0), 0)
  const outOfStock = variants.filter((v) => v.quantity === 0)

  const totals = useMemo(() => {
    let income = 0, expense = 0
    for (const t of transactions) {
      const usd = toUsd(t.amount, t.currency)
      if (t.type === 'income') income += usd
      else expense += usd
    }
    return { income, expense, net: income - expense }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, exchangeRate])

  const chartData = useMemo(() => {
    const buckets = {}
    const bucketStart = range === 'day' ? startOfDay : range === 'week' ? startOfWeek : startOfMonth
    const now = new Date()
    const numBuckets = range === 'day' ? 14 : range === 'week' ? 8 : 6

    // seed buckets so empty periods still show
    for (let i = numBuckets - 1; i >= 0; i--) {
      const d = new Date(now)
      if (range === 'day') d.setDate(d.getDate() - i)
      if (range === 'week') d.setDate(d.getDate() - i * 7)
      if (range === 'month') d.setMonth(d.getMonth() - i)
      const key = bucketStart(d).getTime()
      buckets[key] = 0
    }

    for (const o of orders) {
      if (o.is_returned) continue
      const key = bucketStart(new Date(o.created_at)).getTime()
      if (key in buckets) buckets[key] += toUsd(o.total, o.currency)
    }

    return Object.entries(buckets)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([key, value]) => ({
        label: new Date(Number(key)).toLocaleDateString('en-US', range === 'month' ? { month: 'short' } : { month: 'short', day: 'numeric' }),
        value: Math.round(value * 100) / 100,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, range, exchangeRate])

  if (loading) return <p className="text-inkfade text-sm">Loading…</p>

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Package} label="Stock on hand" value={stockOnHand.toLocaleString()} />
        <StatCard icon={Wallet} label="Inventory value" value={formatMoney(inventoryValue)} />
        <StatCard icon={TrendingUp} label="Total income" value={formatMoney(totals.income)} tone="sage" />
        <StatCard icon={TrendingDown} label="Total expenses" value={formatMoney(totals.expense)} tone="berry" />
      </div>

      <div className="bg-white/60 border border-line rounded-2xl p-4 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-inkfade">Net income</p>
            <p className={`font-display text-2xl font-semibold ${totals.net >= 0 ? 'text-sage' : 'text-berryDark'}`}>
              {formatMoney(totals.net)}
              <span className="text-sm text-inkfade font-body ml-2">
                ≈ {formatMoney(totals.net * exchangeRate, 'KHR')}
              </span>
            </p>
          </div>
          <div className="flex gap-1">
            {['day', 'week', 'month'].map((r) => (
              <button
                key={r} onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${range === r ? 'bg-berry text-cream' : 'bg-sand text-inkfade'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3D9C9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B615C' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6B615C' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(v) => formatMoney(v)}
                contentStyle={{ background: '#FAF7F2', border: '1px solid #E3D9C9', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="value" fill="#9B4A5C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-berryDark" /> Out of stock
          </h2>
          <div className="bg-white/60 border border-line rounded-2xl divide-y divide-line">
            {outOfStock.length === 0 && <p className="p-4 text-sm text-inkfade">Nothing out of stock. 🎉</p>}
            {outOfStock.slice(0, 8).map((v) => {
              const product = products.find((p) => p.id === v.product_id)
              return (
                <Link key={v.id} to={`/products/${v.product_id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-sand/50">
                  <span className="text-sm text-ink">{product?.name || 'Product'}</span>
                  <span className="text-xs text-inkfade">{[v.size, v.color].filter(Boolean).join(' / ')}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink mb-3">Recent activity</h2>
          <div className="bg-white/60 border border-line rounded-2xl divide-y divide-line">
            {movements.length === 0 && <p className="p-4 text-sm text-inkfade">No activity yet.</p>}
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{m.product_name}</p>
                  <p className="text-xs text-inkfade capitalize">{m.change_type}</p>
                </div>
                <span className={`text-sm font-medium ${m.quantity_change < 0 ? 'text-berryDark' : 'text-sage'}`}>
                  {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone }) {
  const toneClass = tone === 'sage' ? 'text-sage' : tone === 'berry' ? 'text-berryDark' : 'text-ink'
  return (
    <div className="bg-white/60 border border-line rounded-2xl p-4">
      <Icon size={18} className="text-inkfade mb-2" />
      <p className="text-xs text-inkfade mb-0.5">{label}</p>
      <p className={`font-display text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}
