alter table public.team_permissions
add column listed boolean not null default true;

update public.team_permissions permissions
set
  role = 'CUSTOM',
  views = '{}'::text[],
  active = false,
  listed = false,
  updated_at = now()
from auth.users users
where users.id = permissions.user_id
  and lower(users.email) = 'notai@steadyhandsop.com';

insert into public.team_permissions (user_id, role, views, active, listed)
select
  users.id,
  'MOD',
  array[
    'dashboard',
    'leads',
    'staging',
    'outreach',
    'live',
    'ideas',
    'scripts',
    'assets',
    'seo',
    'prospects',
    'onboarding',
    'data-collection',
    'payment',
    'site-development',
    'delivery',
    'reports'
  ]::text[],
  true,
  true
from auth.users users
where lower(users.email) = 'iamnottaiii@gmail.com'
on conflict (user_id) do update
set
  role = excluded.role,
  views = excluded.views,
  active = excluded.active,
  listed = excluded.listed,
  updated_at = now();

update public.team_permissions
set
  views = array[
    'dashboard',
    'leads',
    'staging',
    'outreach',
    'live',
    'ideas',
    'scripts',
    'assets',
    'seo',
    'prospects',
    'onboarding',
    'data-collection',
    'payment',
    'site-development',
    'delivery',
    'reports'
  ]::text[],
  updated_at = now()
where role = 'MOD';
