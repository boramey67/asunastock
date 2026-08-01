# Stock Tracker

A stock and income tracker built for a small online clothing business — products with
size/color variants, barcode lookup, cart-style orders with deposits and discounts,
returns, restock cost tracking, and a dashboard with day/week/month sales views.

## Setup

### 1. Install dependencies

```
npm install
```

### 2. Connect to Supabase

Copy `.env.example` to `.env`:

```
cp .env.example .env
```

Open `.env` and fill in your Supabase project's **Project URL** and **anon public key**
(Supabase dashboard → Project Settings → API Keys).

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Set up your Supabase project

- Open Supabase Dashboard → SQL Editor → New query, paste in the full contents of
  `supabase_schema.sql` (included in this project), and run it. This creates every
  table, index, and security policy the app needs.
- Go to Storage → New bucket → name it exactly `product-photos` → toggle **Public** on.
- Go to Authentication → Users → Add user, and create your two accounts. Turn on
  "Auto Confirm User" for each so you don't need email verification.

### 4. Run it locally

```
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Log in with either of the
two accounts you created in Supabase.

### 5. Use it on your phone (same Wi-Fi)

While your laptop is running `npm run dev`, both your laptop and phone need to be on
the same Wi-Fi network. Vite will print a "Network" URL (like `http://192.168.x.x:5173`)
— open that on your phone's browser.

## Deploying to Vercel (permanent access from anywhere)

1. Push this project to a GitHub repository (create a new repo, then
   `git init`, `git add .`, `git commit -m "Initial commit"`, `git remote add origin <your-repo-url>`,
   `git push -u origin main`).
2. Go to [vercel.com](https://vercel.com), sign in, click **Add New → Project**, and
   import that GitHub repo. Vercel auto-detects Vite — leave the build settings as-is.
3. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon public key
   (Your `.env` file never gets pushed to GitHub — that's what `.gitignore` is for —
   so Vercel needs these values entered directly in its dashboard.)
4. Click **Deploy**. Vercel gives you a live URL (e.g. `stock-tracker.vercel.app`)
   that works from any device, anywhere, no shared Wi-Fi required.
5. Every time you `git push` after that, Vercel automatically redeploys.

## What's built

- **Login** — simple email/password via Supabase Auth
- **Dashboard** — stock on hand, inventory value, income/expenses/net (USD & KHR),
  out-of-stock list, sales trend chart (day/week/month), recent activity
- **Products** — grid view, filter by category, add/edit product with multiple
  size/color variants, photo per variant, auto-generated barcode
- **Log a Sale** — barcode/name search, multi-item cart, discounts (whole order or
  per item), payment status (paid/deposit/unpaid), USD or KHR
- **Orders** — full order history, edit item quantities (auto-adjusts stock), return
  a whole order (restores stock, reverses income)
- **Stock Movements** — full history of every quantity change (restock/sale/return/adjustment)
- **Transactions** — income and expense log, filterable
- **Categories** — add/edit/delete anytime

## Notes

- Restocking a variant lets you enter a batch delivery fee, which is automatically
  split across the quantity received for accurate per-item cost.
- Selling more than what's in stock is blocked.
- Deleting a product or variant is a "soft delete" — it's hidden from view but its
  sales history is preserved so past profit numbers stay accurate.
