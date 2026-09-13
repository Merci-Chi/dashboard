-- Rename the BUILDING team role to BUILDER while preserving existing access.
alter table public.team_permissions
  drop constraint if exists team_permissions_role_check;

update public.team_permissions
set role = 'BUILDER',
    updated_at = now()
where role = 'BUILDING';

update auth.users
set raw_app_meta_data = jsonb_set(
  raw_app_meta_data,
  '{roles}',
  (
    select jsonb_agg(
      to_jsonb(case when role_name = 'BUILDING' then 'BUILDER' else role_name end)
    )
    from jsonb_array_elements_text(raw_app_meta_data->'roles') as role_values(role_name)
  ),
  true
)
where jsonb_typeof(raw_app_meta_data->'roles') = 'array'
  and (raw_app_meta_data->'roles') ? 'BUILDING';

alter table public.team_permissions
  add constraint team_permissions_role_check
  check (role in ('SALES', 'BUILDER', 'MOD', 'ADMIN'));
