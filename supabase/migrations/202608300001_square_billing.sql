create table if not exists public.billing_subscriptions (
  id text primary key,
  site_project_id text,
  square_customer_id text not null,
  customer_name text,
  customer_company text,
  customer_email text,
  customer_phone text,
  plan_variation_id text,
  plan_name text,
  status text not null,
  amount_money bigint not null default 0,
  currency text not null default 'USD',
  start_date date,
  canceled_date date,
  charged_through_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_history (
  id text primary key,
  subscription_id text references public.billing_subscriptions(id) on delete cascade,
  square_customer_id text,
  status text not null,
  amount_money bigint not null default 0,
  currency text not null default 'USD',
  paid_at timestamptz,
  card_brand text,
  card_last_4 text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_customer_idx on public.billing_subscriptions(square_customer_id);
create index if not exists payment_history_subscription_idx on public.payment_history(subscription_id, paid_at desc);
alter table public.billing_subscriptions enable row level security;
alter table public.payment_history enable row level security;
create policy "owner reads subscriptions" on public.billing_subscriptions
  for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'kiara@steadyhandsop.com');
create policy "owner reads payments" on public.payment_history
  for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'kiara@steadyhandsop.com');
