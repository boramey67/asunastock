-- Stock Tracker database schema
-- Run this entire file in Supabase Dashboard -> SQL Editor -> New query -> Run

create extension if not exists "pgcrypto";

-- ============ CATEGORIES ============
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- ============ PRODUCTS ============
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  description text,
  is_deleted boolean not null default false,
  created_at timestamptz default now()
);

-- ============ PRODUCT VARIANTS (size/color) ============
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  size text,
  color text,
  barcode text unique,
  price_usd numeric(10,2) not null default 0,
  cost_usd numeric(10,2) not null default 0,
  quantity integer not null default 0,
  photo_url text,
  is_deleted boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_variants_product on product_variants(product_id);
create index if not exists idx_variants_barcode on product_variants(barcode);

-- ============ ORDERS ============
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_name text,
  currency text not null default 'USD', -- 'USD' or 'KHR'
  subtotal numeric(12,2) not null default 0,
  discount_type text,                    -- 'percent' | 'amount' | null
  discount_value numeric(12,2) default 0,
  total numeric(12,2) not null default 0,
  payment_status text not null default 'paid', -- 'paid' | 'deposit' | 'unpaid'
  amount_paid numeric(12,2) not null default 0,
  is_returned boolean not null default false,
  created_at timestamptz default now()
);

-- ============ ORDER ITEMS ============
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid references product_variants(id),
  product_name text,   -- snapshot, so history survives soft-deletes
  variant_label text,  -- snapshot, e.g. "M / Blue"
  quantity integer not null,
  unit_price numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_order_items_order on order_items(order_id);

-- ============ TRANSACTIONS (income/expense log) ============
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null,                    -- 'income' | 'expense'
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  description text,
  related_order_id uuid references orders(id),
  created_at timestamptz default now()
);

-- ============ STOCK MOVEMENTS ============
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references product_variants(id),
  product_name text,   -- snapshot for readability after deletes
  variant_label text,
  change_type text not null,             -- 'restock' | 'sale' | 'return' | 'adjustment'
  quantity_change integer not null,      -- positive or negative
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_stock_movements_variant on stock_movements(variant_id);

-- ============ SETTINGS (exchange rate etc.) ============
create table if not exists settings (
  key text primary key,
  value text
);

insert into settings (key, value)
  values ('exchange_rate_khr_per_usd', '4100')
  on conflict (key) do nothing;

-- ============ ROW LEVEL SECURITY ============
-- Any logged-in user (your 2 accounts) can read/write everything.
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table transactions enable row level security;
alter table stock_movements enable row level security;
alter table settings enable row level security;

drop policy if exists "auth_all_categories" on categories;
create policy "auth_all_categories" on categories for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_products" on products;
create policy "auth_all_products" on products for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_variants" on product_variants;
create policy "auth_all_variants" on product_variants for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_orders" on orders;
create policy "auth_all_orders" on orders for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_order_items" on order_items;
create policy "auth_all_order_items" on order_items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_transactions" on transactions;
create policy "auth_all_transactions" on transactions for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_stock_movements" on stock_movements;
create policy "auth_all_stock_movements" on stock_movements for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_settings" on settings;
create policy "auth_all_settings" on settings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============ STORAGE (run once) ============
-- Also create a bucket named "product-photos" as PUBLIC via
-- Dashboard -> Storage -> New bucket (this SQL doesn't do it, do it in the UI).
