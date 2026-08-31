create extension if not exists pgcrypto;

create table if not exists public.hosting_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  signer_name text not null,
  business_name text not null,
  signer_email text not null,
  electronic_signature text not null,
  plan_key text not null,
  plan_label text not null,
  terms_version text not null,
  agreement_snapshot text not null,
  accepted boolean not null default false check (accepted = true),
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists hosting_agreements_user_idx on public.hosting_agreements(user_id, signed_at desc);
create index if not exists hosting_agreements_email_idx on public.hosting_agreements(lower(signer_email), signed_at desc);

alter table public.hosting_agreements enable row level security;

create policy "clients create own agreements" on public.hosting_agreements
  for insert to authenticated
  with check (auth.uid() = user_id and lower(auth.jwt() ->> 'email') = lower(signer_email));

create policy "clients read own agreements" on public.hosting_agreements
  for select to authenticated
  using (auth.uid() = user_id);

create policy "owner reads all agreements" on public.hosting_agreements
  for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'kiara@steadyhandsop.com');

grant select, insert on public.hosting_agreements to authenticated;

alter table public.square_checkout_sessions
  add column if not exists agreement_id uuid references public.hosting_agreements(id) on delete restrict;
