const SECTIONS = [
  {
    title: 'Dashboard',
    items: [
      ['What do Income, COGS, and Profit mean?', 'Income is money coming in from sales. Cost of Goods Sold (COGS) is what those sold items cost you. Ad spend is your Facebook boost costs. Profit = Income − COGS − Ad spend. Inventory Value is separate — it\'s the cost of what\'s still sitting unsold, not part of profit.'],
      ['Why does Profit differ from what I expected?', 'Profit only counts active (non-returned, non-draft) orders, and uses the actual cost of each item at the time it was sold — so price changes over time stay accurate.'],
      ['What\'s the Today/All time toggle for?', 'Today only shows just today\'s snapshot, keeping the page short. All time shows the full 6-month breakdown with more detail.'],
    ],
  },
  {
    title: 'Products',
    items: [
      ['How do I add stock to an existing item?', 'Open the product, find the variant, click "+ Add stock". Enter quantity, price, and any delivery fee for that batch.'],
      ['What\'s the pin (star) for?', 'Pin frequently-sold items so they float to the top of the Products list.'],
      ['Why is a row highlighted green?', 'That means the product was added today — just a visual cue, nothing to worry about.'],
      ['Can I fix a typo in quantity or cost without restocking?', 'Yes — on the product edit page, existing variants have a "direct fix" quantity and price field, separate from "+ Add stock" (which is for real new stock arriving).'],
    ],
  },
  {
    title: 'Log a Sale',
    items: [
      ['Can I sell multiple items in one order?', 'Yes — search and add as many items as needed, they\'ll all be part of one order for that customer.'],
      ['What\'s the difference between Deposit and Unpaid?', 'Deposit means partial payment now with a balance still owed. Unpaid means nothing\'s been paid yet. Paid in full means the whole amount was collected.'],
      ['What does "Save as Draft" do?', 'Saves the order without deducting stock or logging income yet. Finish it later from the Drafts tab in Orders — it only affects stock/money once converted.'],
    ],
  },
  {
    title: 'Orders',
    items: [
      ['Can I fix a sale after saving it?', 'Yes — open the order, click "edit qty" on any item. Stock adjusts automatically to match.'],
      ['What does "Return whole order" do?', 'It restores all stock from that order and reverses the income. It affects the entire order, not individual items.'],
      ['What\'s the difference between Return and Delete?', 'Return keeps a record that it happened and was reversed. Delete removes it entirely, as if it never happened — use Delete for test entries or genuine mistakes.'],
    ],
  },
  {
    title: 'Ad Spend',
    items: [
      ['How does this work with Profit?', 'Each boost period you log gets spread evenly across its days, so "today" and "all time" Profit numbers on the Dashboard fairly include a portion of any ad spend covering that day.'],
      ['Where do I get the amount?', 'From your Facebook Ads Manager billing for the matching date range.'],
    ],
  },
  {
    title: 'Safety',
    items: [
      ['I deleted something by accident!', 'Check Trash in the sidebar — deleted products, orders, categories, transactions, and stock movements can all be restored anytime within 30 days.'],
      ['Why did I get signed out?', 'The app signs out automatically after a period of inactivity, for safety on shared devices.'],
    ],
  },
]

export default function Help() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold mb-1">Help</h1>
      <p className="text-inkfade text-sm mb-6">Quick answers for common questions.</p>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="font-medium mb-2">{section.title}</h2>
            <div className="card divide-y divide-line">
              {section.items.map(([q, a]) => (
                <div key={q} className="px-4 py-3">
                  <p className="text-sm font-medium mb-1">{q}</p>
                  <p className="text-sm text-inkfade">{a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
