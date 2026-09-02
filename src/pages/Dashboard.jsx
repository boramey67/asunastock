import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMoney, dayKey, weekKey, monthKey, timeOfDayBucket, prorateAdSpend } from '../lib/helpers'
import { AlertTriangle, ArrowUp, ArrowDown, Package, Info, TrendingUp, TrendingDown, EyeOff, Eye, ChevronUp, ChevronDown, Megaphone } from 'lucide-react'

const statusColors = { paid: 'bg-sage/15 text-sage', deposit: 'bg-amber-100 text-amber-700', unpaid: 'bg-berry/15 text-berry' }
const CARD_IDS = ['outofstock', 'orders', 'transactions', 'movements', 'categories', 'activity', 'topsellers', 'timeofday']
const CARD_LABELS = {
  outofstock: 'Out of stock', orders: 'Recent orders', transactions: 'Recent transactions',
  movements: 'Recent stock movements', categories: 'Products by category', activity: 'Recent activity',
  topsellers: 'Top sellers', timeofday: 'Sales by time of day',
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [variants, setVariants] = useState([])
  const [products, setProducts] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [transactions, setTransactions] = useState([])
  const [movements, setMovements] = useState([])
  const [activity, setActivity] = useState([])
  const [categories, setCategories] = useState([])
  const [adSpendEntries, setAdSpendEntries] = useState([])
  const [groupBy, setGroupBy] = useState('day')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [topSellerMode, setTopSellerMode] = useState('quantity')
  const [moneyView, setMoneyView] = useState('today')
  const [loading, setLoading] = useState(true)
  const [newSinceLastVisit, setNewSinceLastVisit] = useState(0)
  const [cardOrder, setCardOrder] = useState(() => {
    const saved = localStorage.getItem('dashboardCardOrder')
    return saved ? JSON.parse(saved) : CARD_IDS
  })
  const [hiddenCards, setHiddenCards] = useState(() => {
    const saved = localStorage.getItem('dashboardHiddenCards')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => { localStorage.setItem('dashboardCardOrder', JSON.stringify(cardOrder)) }, [cardOrder])
  useEffect(() => { localStorage.setItem('dashboardHiddenCards', JSON.stringify(hiddenCards)) }, [hiddenCards])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const cutoff = sixMonthsAgo.toISOString()

      const [
        { data: v }, { data: prods }, { data: o }, { data: t }, { data: m }, { data: a }, { data: cats }, { data: ads }
      ] = await Promise.all([
        supabase.from('product_variants').select('*, products!inner(name, category_id, is_deleted)').eq('is_deleted', false).eq('products.is_deleted', false),
        supabase.from('products').select('*, categories(name)').eq('is_deleted', false),
        supabase.from('orders').select('*, order_items(*)').eq('is_deleted', false).gte('created_at', cutoff),
        supabase.from('transactions').select('*').eq('is_deleted', false).order('created_at', { ascending: false }).limit(10),
        supabase.from('stock_movements').select('*, product_variants(size, color, products(name))').eq('is_deleted', false).order('created_at', { ascending: false }).limit(10),
        supabase.from('activity_log').select('*, profiles(name)').order('created_at', { ascending: false }).limit(10),
        supabase.from('categories').select('*').eq('is_deleted', false).order('name'),
        supabase.from('ad_spend').select('*').eq('is_deleted', false),
      ])

      setVariants(v || [])
      setProducts(prods || [])
      const active = (o || []).filter(ord => ord.status === 'active')
      setAllOrders(active)
      setRecentOrders((o || []).filter(ord => ord.status !== 'draft').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8))
      setTransactions(t || [])
      setMovements(m || [])
      setActivity(a || [])
      setCategories(cats || [])
      setAdSpendEntries(ads || [])
      setLoading(false)

      const lastVisit = localStorage.getItem('lastDashboardVisit')
      localStorage.setItem('lastDashboardVisit', new Date().toISOString())
      if (lastVisit) {
        const newCount = (o || []).filter(ord => new Date(ord.created_at) > new Date(lastVisit)).length
        setNewSinceLastVisit(newCount)
      }
    }
    load()
  }, [])

  const unitsInStock = variants.reduce((s, v) => s + (v.quantity || 0), 0)
  const inventoryValue = variants.reduce((s, v) => s + (v.quantity || 0) * (v.original_price || 0), 0)
  const lowStock = variants.filter(v => v.quantity === 0)
  const todayStr = new Date().toISOString().slice(0, 10)
  const sixMonthsAgoStr = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10)
  }, [])

  const money = useMemo(() => {
    const result = { USD: { income: 0, cogs: 0 }, KHR: { income: 0, cogs: 0 }, todayUSD: { income: 0, cogs: 0 }, todayKHR: { income: 0, cogs: 0 } }
    allOrders.forEach(order => {
      const cur = order.currency === 'KHR' ? 'KHR' : 'USD'
      const isToday = order.order_date === todayStr
      order.order_items.forEach(item => {
        const income = Number(item.line_total || 0)
        const cogs = Number(item.quantity || 0) * Number(item.cost_at_sale || 0)
        result[cur].income += income
        result[cur].cogs += cogs
        if (isToday) { result[`today${cur}`].income += income; result[`today${cur}`].cogs += cogs }
      })
    })
    return result
  }, [allOrders, todayStr])

  const adSpendToday = useMemo(() => prorateAdSpend(adSpendEntries, todayStr, todayStr), [adSpendEntries, todayStr])
  const adSpendAllTime = useMemo(() => prorateAdSpend(adSpendEntries, sixMonthsAgoStr, todayStr), [adSpendEntries, sixMonthsAgoStr, todayStr])

  const growth = useMemo(() => {
    const today = new Date()
    const thisMonthKey = monthKey(today.toISOString())
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthKeyStr = monthKey(lastMonthDate.toISOString())
    let thisMonthProfit = 0, lastMonthProfit = 0
    allOrders.forEach(order => {
      const k = monthKey(order.order_date)
      order.order_items.forEach(i => {
        const p = Number(i.line_total || 0) - i.quantity * Number(i.cost_at_sale || 0)
        if (k === thisMonthKey) thisMonthProfit += p
        if (k === lastMonthKeyStr) lastMonthProfit += p
      })
    })
    const pct = lastMonthProfit ? ((thisMonthProfit - lastMonthProfit) / Math.abs(lastMonthProfit) * 100) : null
    return { thisMonthProfit, lastMonthProfit, pct }
  }, [allOrders])

  const daysSinceLastSale = useMemo(() => {
    const dates = allOrders.map(o => new Date(o.order_date).getTime()).sort((a, b) => b - a)
    if (dates.length === 0) return null
    return Math.floor((Date.now() - dates[0]) / 86400000)
  }, [allOrders])

  const bestPeriod = useMemo(() => {
    const groups = {}
    allOrders.forEach(order => {
      const key = dayKey(order.order_date)
      order.order_items.forEach(i => {
        groups[key] = (groups[key] || 0) + (Number(i.line_total || 0) - i.quantity * Number(i.cost_at_sale || 0))
      })
    })
    const best = Object.entries(groups).sort((a, b) => b[1] - a[1])[0]
    return best ? { date: best[0], profit: best[1] } : null
  }, [allOrders])

  const topSellers = useMemo(() => {
    const map = {}
    allOrders.forEach(order => {
      order.order_items.forEach(i => {
        const key = i.variant_id
        if (!map[key]) map[key] = { qty: 0, profit: 0, label: '' }
        map[key].qty += i.quantity
        map[key].profit += Number(i.line_total || 0) - i.quantity * Number(i.cost_at_sale || 0)
      })
    })
    const variantMap = {}
    variants.forEach(v => { variantMap[v.id] = `${v.products?.name} (${v.size}/${v.color})` })
    return Object.entries(map)
      .map(([vid, v]) => ({ label: variantMap[vid] || 'Unknown item', ...v }))
      .sort((a, b) => topSellerMode === 'quantity' ? b.qty - a.qty : b.profit - a.profit)
      .slice(0, 5)
  }, [allOrders, variants, topSellerMode])

  const salesByTimeOfDay = useMemo(() => {
    const buckets = { Morning: 0, Afternoon: 0, Evening: 0 }
    allOrders.forEach(order => { buckets[timeOfDayBucket(order.created_at)] += order.order_items.reduce((s, i) => s + Number(i.line_total || 0), 0) })
    return buckets
  }, [allOrders])

  const overstockFlag = inventoryValue > (money.USD.income * 1.5) && money.USD.income > 0

  const lowStockPrioritized = useMemo(() => {
    const soldMap = {}
    allOrders.forEach(o => o.order_items.forEach(i => { soldMap[i.variant_id] = (soldMap[i.variant_id] || 0) + i.quantity }))
    return [...lowStock].sort((a, b) => (soldMap[b.id] || 0) - (soldMap[a.id] || 0)).slice(0, 8)
  }, [lowStock, allOrders])

  const categoryBreakdown = useMemo(() => {
    const map = {}
    products.forEach(p => { const name = p.categories?.name || 'Uncategorized'; map[name] = (map[name] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [products])

  const groupedSales = useMemo(() => {
    let source = allOrders
    if (useCustomRange && customFrom && customTo) {
      source = allOrders.filter(o => o.order_date >= customFrom && o.order_date <= customTo)
    }
    const keyFn = groupBy === 'day' ? dayKey : groupBy === 'week' ? weekKey : monthKey
    const groups = {}
    source.forEach(order => {
      const key = keyFn(order.order_date)
      if (!groups[key]) groups[key] = { customers: new Set(), items: 0, income: 0, cogs: 0 }
      groups[key].customers.add(order.customer_name || order.id)
      order.order_items.forEach(i => {
        groups[key].items += i.quantity
        groups[key].income += Number(i.line_total || 0)
        groups[key].cogs += Number(i.quantity || 0) * Number(i.cost_at_sale || 0)
      })
    })
    return Object.entries(groups)
      .map(([key, v]) => ({ key, customers: v.customers.size, items: v.items, income: v.income, profit: v.income - v.cogs }))
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, 20)
  }, [allOrders, groupBy, useCustomRange, customFrom, customTo])

  function moveCard(id, direction) {
    const idx = cardOrder.indexOf(id)
    const target = idx + direction
    if (target < 0 || target >= cardOrder.length) return
    const copy = [...cardOrder]
    ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
    setCardOrder(copy)
  }

  function toggleHide(id) {
    setHiddenCards(hiddenCards.includes(id) ? hiddenCards.filter(c => c !== id) : [...hiddenCards, id])
  }

  const todayProfit = money.todayUSD.income - money.todayUSD.cogs - adSpendToday
  const allTimeProfit = money.USD.income - money.USD.cogs - adSpendAllTime

  return (
    <div>
      <p className="text-inkfade text-sm mb-1">{getGreeting()}{profile?.name ? `, ${profile.name.split('@')[0]}` : ''}</p>
      <h1 className="font-display text-2xl font-semibold mb-1">Dashboard</h1>
      {newSinceLastVisit > 0 && <p className="text-xs text-sage mb-2">{newSinceLastVisit} new order{newSinceLastVisit !== 1 ? 's' : ''} since your last visit</p>}
      {daysSinceLastSale !== null && daysSinceLastSale >= 3 && (
        <p className="text-xs text-berry mb-2 flex items-center gap-1"><AlertTriangle size={12} /> No sales in {daysSinceLastSale} days</p>
      )}
      <p className="text-inkfade text-sm mb-6">Everything at a glance — last 6 months.</p>

      <div className="flex gap-4 mb-6 text-xs text-berry font-medium overflow-x-auto">
        <a href="#money">Money</a><a href="#trend">Trend</a><a href="#feeds">Feeds</a>
      </div>

      <div className="bg-berry text-white rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs opacity-80">Today's snapshot</p>
          <div className="flex gap-1 bg-white/20 rounded-full p-0.5">
            <button onClick={() => setMoneyView('today')} className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${moneyView === 'today' ? 'bg-white text-berry' : 'text-white'}`}>Today only</button>
            <button onClick={() => setMoneyView('all')} className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${moneyView === 'all' ? 'bg-white text-berry' : 'text-white'}`}>All time</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><p className="text-xs opacity-70">Income</p><p className="font-display text-lg font-semibold">{formatMoney(money.todayUSD.income, 'USD')}</p></div>
          <div><p className="text-xs opacity-70">Profit (after ad spend)</p><p className="font-display text-lg font-semibold">{formatMoney(todayProfit, 'USD')}</p></div>
          <div><p className="text-xs opacity-70">Orders</p><p className="font-display text-lg font-semibold">{recentOrders.filter(o => o.order_date === todayStr).length}</p></div>
        </div>
      </div>

      {moneyView === 'all' && (
        <>
          <div id="money" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <StatCard label="Income (USD)" hint="Money in from sales" value={formatMoney(money.USD.income, 'USD')} accent="sage" />
            <StatCard label="Cost of goods sold" hint="What sold items cost you" value={formatMoney(money.USD.cogs, 'USD')} />
            <StatCard label="Ad spend" hint="Facebook boost costs" value={formatMoney(adSpendAllTime, 'USD')} />
            <StatCard label="Profit" hint="Income − cost of goods − ad spend" value={formatMoney(allTimeProfit, 'USD')} accent="berry" trend={growth.pct} />
          </div>

          {(money.KHR.income > 0) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <StatCard label="Income (KHR)" value={formatMoney(money.KHR.income, 'KHR')} accent="sage" />
              <StatCard label="COGS (KHR)" value={formatMoney(money.KHR.cogs, 'KHR')} />
              <StatCard label="Profit (KHR)" value={formatMoney(money.KHR.income - money.KHR.cogs, 'KHR')} accent="berry" />
              <StatCard label="Profit today (KHR)" value={formatMoney(money.todayKHR.income - money.todayKHR.cogs, 'KHR')} accent="berry" />
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-inkfade bg-sand/60 rounded-xl px-3 py-2 mb-3">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span><b>Inventory value</b> below is the cost of stock still sitting unsold — separate from profit. <b>Ad spend</b> is now subtracted from Profit above (see the <Link to="/ad-spend" className="underline">Ad Spend</Link> page to manage it).</span>
          </div>

          {overstockFlag && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-3">
              <AlertTriangle size={14} /> Inventory value is high relative to recent income — you may have more cash tied up in stock than usual.
            </div>
          )}

          {bestPeriod && (
            <div className="flex items-center gap-2 text-xs text-sage bg-sage/10 rounded-xl px-3 py-2 mb-6">
              <TrendingUp size={14} /> Best day: <b>{bestPeriod.date}</b> — {formatMoney(bestPeriod.profit)} profit
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Units in stock" value={unitsInStock} small />
        <StatCard label="Inventory value" value={formatMoney(inventoryValue)} small />
        <StatCard label="Out of stock" value={lowStock.length} small accent={lowStock.length > 0 ? 'berry' : undefined} />
        <StatCard label="Products" value={products.length} small />
      </div>

      <div id="trend" className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-medium">Sales &amp; profit by date</h2>
          <div className="flex items-center gap-2">
            {!useCustomRange && ['day', 'week', 'month'].map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${groupBy === g ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>{g}</button>
            ))}
            <button onClick={() => setUseCustomRange(!useCustomRange)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${useCustomRange ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>Custom range</button>
          </div>
        </div>
        {useCustomRange && (
          <div className="flex items-center gap-2 mb-3">
            <input type="date" className="input py-1.5 text-xs" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-xs text-inkfade">to</span>
            <input type="date" className="input py-1.5 text-xs" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {groupedSales.map(g => (
            <div key={g.key} className="flex justify-between items-center text-sm py-2 border-b border-line last:border-0">
              <span className="font-medium">{g.key}</span>
              <span className="text-inkfade text-xs">{g.customers} customer{g.customers !== 1 ? 's' : ''} · {g.items} items</span>
              <span className="text-inkfade">{formatMoney(g.income)} income</span>
              <span className="font-medium text-berry">{formatMoney(g.profit)} profit</span>
            </div>
          ))}
          {groupedSales.length === 0 && <Empty text="No sales yet." />}
        </div>
      </div>

      <div id="feeds" className="grid md:grid-cols-2 gap-6">
        {cardOrder.filter(id => !hiddenCards.includes(id)).map((id) => (
          <FeedCardWrapper key={id} id={id} onMoveUp={() => moveCard(id, -1)} onMoveDown={() => moveCard(id, 1)} onHide={() => toggleHide(id)}>
            {renderCard(id)}
          </FeedCardWrapper>
        ))}
      </div>

      {hiddenCards.length > 0 && (
        <div className="mt-6">
          <p className="text-xs text-inkfade mb-2">Hidden cards</p>
          <div className="flex gap-2 flex-wrap">
            {hiddenCards.map(id => (
              <button key={id} onClick={() => toggleHide(id)} className="text-xs bg-sand px-3 py-1.5 rounded-full flex items-center gap-1 text-inkfade">
                <Eye size={12} /> {CARD_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  function renderCard(id) {
    if (id === 'outofstock') return (
      <FeedContent title="Out of stock" icon={<AlertTriangle size={16} className="text-berry" />} link="/products" linkLabel="View all products">
        {lowStockPrioritized.map(v => <Row key={v.id} left={`${v.products?.name} — ${v.size}/${v.color}`} right={<span className="text-berry font-medium">0 left</span>} />)}
        {lowStockPrioritized.length === 0 && <Empty text="Everything's in stock 🎉" />}
      </FeedContent>
    )
    if (id === 'orders') return (
      <FeedContent title="Recent orders" link="/orders" linkLabel="View all orders">
        {recentOrders.map(o => {
          const total = (o.order_items || []).reduce((s, i) => s + Number(i.line_total || 0), 0)
          return <Row key={o.id} left={`${o.customer_name || 'No name'} · ${o.order_date}${o.status === 'returned' ? ' (returned)' : ''}`}
            right={<span className="flex items-center gap-2"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[o.payment_status]}`}>{o.payment_status}</span><span className="font-medium">{formatMoney(total, o.currency)}</span></span>} />
        })}
        {recentOrders.length === 0 && <Empty text="No orders logged yet." />}
      </FeedContent>
    )
    if (id === 'transactions') return (
      <FeedContent title="Recent transactions" link="/transactions" linkLabel="View all transactions">
        {transactions.map(t => <Row key={t.id} left={t.category || (t.type === 'income' ? 'Sale' : 'Expense')} right={<span className={`font-medium ${t.type === 'income' ? 'text-sage' : 'text-berry'}`}>{t.type === 'income' ? '+' : '-'}{formatMoney(t.amount, t.currency)}</span>} />)}
        {transactions.length === 0 && <Empty text="No transactions yet." />}
      </FeedContent>
    )
    if (id === 'movements') return (
      <FeedContent title="Recent stock movements" link="/stock-movements" linkLabel="View all movements">
        {movements.map(m => <Row key={m.id} left={`${m.product_variants?.products?.name} — ${m.product_variants?.size}/${m.product_variants?.color}`}
          right={<span className={`font-medium flex items-center gap-1 ${m.change_qty > 0 ? 'text-sage' : 'text-berry'}`}>{m.change_qty > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{m.change_qty > 0 ? '+' : ''}{m.change_qty}</span>} />)}
        {movements.length === 0 && <Empty text="No stock movements yet." />}
      </FeedContent>
    )
    if (id === 'categories') return (
      <FeedContent title="Products by category" icon={<Package size={16} className="text-inkfade" />} link="/categories" linkLabel="Manage categories">
        {categoryBreakdown.map(([name, count]) => <Row key={name} left={name} right={<span className="font-medium">{count}</span>} />)}
        {categoryBreakdown.length === 0 && <Empty text="No products yet." />}
      </FeedContent>
    )
    if (id === 'activity') return (
      <FeedContent title="Recent activity">
        {activity.map(a => <div key={a.id} className="text-xs text-inkfade py-1.5"><span className="font-medium text-ink">{a.profiles?.name || 'Someone'}</span> {a.action.replace(/_/g, ' ')} · {new Date(a.created_at).toLocaleString()}</div>)}
        {activity.length === 0 && <Empty text="No activity yet." />}
      </FeedContent>
    )
    if (id === 'topsellers') return (
      <FeedContent title="Top sellers" extra={
        <div className="flex gap-1">
          <button onClick={() => setTopSellerMode('quantity')} className={`text-[10px] px-2 py-0.5 rounded-full ${topSellerMode === 'quantity' ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>Qty</button>
          <button onClick={() => setTopSellerMode('profit')} className={`text-[10px] px-2 py-0.5 rounded-full ${topSellerMode === 'profit' ? 'bg-berry text-white' : 'bg-sand text-inkfade'}`}>Profit</button>
        </div>
      }>
        {topSellers.map((t, i) => <Row key={i} left={t.label} right={<span className="font-medium">{topSellerMode === 'quantity' ? `${t.qty} sold` : formatMoney(t.profit)}</span>} />)}
        {topSellers.length === 0 && <Empty text="No sales yet." />}
      </FeedContent>
    )
    if (id === 'timeofday') return (
      <FeedContent title="Sales by time of day">
        {Object.entries(salesByTimeOfDay).map(([label, amt]) => <Row key={label} left={label} right={<span className="font-medium">{formatMoney(amt)}</span>} />)}
      </FeedContent>
    )
    return null
  }
}

function StatCard({ label, hint, value, accent, small, trend }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-inkfade mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className={`font-display font-semibold ${small ? 'text-lg' : 'text-xl'} ${accent === 'sage' ? 'text-sage' : accent === 'berry' ? 'text-berry' : 'text-ink'}`}>{value}</p>
        {trend !== null && trend !== undefined && (
          <span className={`text-xs flex items-center ${trend >= 0 ? 'text-sage' : 'text-berry'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-inkfade mt-0.5">{hint}</p>}
    </div>
  )
}

function FeedCardWrapper({ id, onMoveUp, onMoveDown, onHide, children }) {
  return (
    <div className="relative group">
      <div className="absolute -top-2 right-2 hidden group-hover:flex items-center gap-1 bg-white border border-line rounded-lg shadow-sm z-10">
        <button onClick={onMoveUp} className="p-1 text-inkfade hover:text-ink"><ChevronUp size={14} /></button>
        <button onClick={onMoveDown} className="p-1 text-inkfade hover:text-ink"><ChevronDown size={14} /></button>
        <button onClick={onHide} className="p-1 text-inkfade hover:text-berry"><EyeOff size={14} /></button>
      </div>
      {children}
    </div>
  )
}

function FeedContent({ title, icon, link, linkLabel, extra, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium flex items-center gap-2">{icon}{title}</h2>
        <div className="flex items-center gap-2">
          {extra}
          {link && <Link to={link} className="text-xs text-berry font-medium">{linkLabel} →</Link>}
        </div>
      </div>
      <div className="space-y-1 max-h-56 overflow-y-auto">{children}</div>
    </div>
  )
}

function Row({ left, right }) {
  return (
    <div className="flex justify-between items-center text-sm py-1.5">
      <span className="truncate pr-2">{left}</span>
      {right}
    </div>
  )
}

function Empty({ text }) {
  return <p className="text-inkfade text-sm">{text}</p>
}
