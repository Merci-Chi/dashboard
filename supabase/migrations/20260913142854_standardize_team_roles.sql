delete from auth.users
where lower(email) = 'notai@steadyhandsop.com';

alter table public.team_permissions
drop constraint if exists team_permissions_role_check;

update public.team_permissions
set
  role = 'BUILDING',
  updated_at = now()
where role in ('PREP', 'CUSTOM');

alter table public.team_permissions
add constraint team_permissions_role_check
check (role in ('SALES', 'BUILDING', 'MOD', 'ADMIN'));
