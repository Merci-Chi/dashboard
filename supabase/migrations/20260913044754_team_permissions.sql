create table public.team_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'CUSTOM'
    check (role in ('ADMIN', 'MOD', 'SALES', 'PREP', 'CUSTOM')),
  views text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.team_permissions enable row level security;

grant select on table public.team_permissions to authenticated;

create policy "team members can read their own permissions"
on public.team_permissions
for select
to authenticated
using ((select auth.uid()) = user_id);

insert into public.team_permissions (user_id, role, views, active)
select
  u.id,
  case
    when exists (
      select 1
      from public.members m
      where m.userid = u.id and m.role in ('owner', 'admin')
    ) then 'ADMIN'
    when upper(coalesce(u.raw_app_meta_data -> 'roles' ->> 0, '')) in ('ADMIN', 'MOD', 'SALES', 'PREP')
      then upper(u.raw_app_meta_data -> 'roles' ->> 0)
    else 'CUSTOM'
  end,
  case upper(coalesce(u.raw_app_meta_data -> 'roles' ->> 0, ''))
    when 'ADMIN' then array[
      'dashboard','leads','outreach','staging','review','live','contact','clients','requests',
      'ideas','scripts','assets','seo','domain','hosting','prospects','onboarding',
      'data-collection','payment','site-development','delivery','reports','team'
    ]::text[]
    when 'MOD' then array['leads','staging','outreach','review']::text[]
    when 'SALES' then array['leads','outreach']::text[]
    when 'PREP' then array['staging']::text[]
    else coalesce(
      array(select jsonb_array_elements_text(u.raw_app_meta_data -> 'dashboard_views')),
      '{}'::text[]
    )
  end,
  true
from auth.users u
where
  lower(coalesce(u.email, '')) like '%@steadyhandsop.com'
  or jsonb_typeof(u.raw_app_meta_data -> 'roles') = 'array'
  or exists (select 1 from public.members m where m.userid = u.id)
on conflict (user_id) do nothing;

create or replace function public.has_dashboard_view(required_views text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_permissions permissions
    where permissions.user_id = (select auth.uid())
      and permissions.active
      and (
        permissions.role = 'ADMIN'
        or permissions.views && required_views
      )
  );
$$;

revoke all on function public.has_dashboard_view(text[]) from public;
grant execute on function public.has_dashboard_view(text[]) to authenticated;

drop policy if exists "crm_role_select" on public.crm;
drop policy if exists "crm_role_insert" on public.crm;
drop policy if exists "crm_role_update" on public.crm;
drop policy if exists "crm_role_delete" on public.crm;

create policy "crm_team_select" on public.crm for select to authenticated
using ((select public.has_dashboard_view(array['leads','outreach','staging','review','live','contact','clients'])));
create policy "crm_team_insert" on public.crm for insert to authenticated
with check ((select public.has_dashboard_view(array['leads','outreach','staging','review','live','contact','clients'])));
create policy "crm_team_update" on public.crm for update to authenticated
using ((select public.has_dashboard_view(array['leads','outreach','staging','review','live','contact','clients'])))
with check ((select public.has_dashboard_view(array['leads','outreach','staging','review','live','contact','clients'])));
create policy "crm_team_delete" on public.crm for delete to authenticated
using ((select public.has_dashboard_view(array['leads','outreach','staging','review','live','contact','clients'])));

create policy "sites_team_access" on public.sites for all to authenticated
using ((select public.has_dashboard_view(array['staging','review','live','contact','clients'])))
with check ((select public.has_dashboard_view(array['staging','review','live','contact','clients'])));

create policy "agreements_team_access" on public.agreements for all to authenticated
using ((select public.has_dashboard_view(array['clients'])))
with check ((select public.has_dashboard_view(array['clients'])));

create policy "square_team_access" on public.square for all to authenticated
using ((select public.has_dashboard_view(array['clients'])))
with check ((select public.has_dashboard_view(array['clients'])));

create policy "payments_team_access" on public.payments for all to authenticated
using ((select public.has_dashboard_view(array['clients'])))
with check ((select public.has_dashboard_view(array['clients'])));

create policy "requests_team_access" on public.requests for all to authenticated
using ((select public.has_dashboard_view(array['requests','clients'])))
with check ((select public.has_dashboard_view(array['requests','clients'])));

create policy "activity_team_access" on public.activity for all to authenticated
using ((select public.has_dashboard_view(array['leads','outreach','contact'])))
with check ((select public.has_dashboard_view(array['leads','outreach','contact'])));
