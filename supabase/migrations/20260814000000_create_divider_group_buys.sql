create extension if not exists pgcrypto;

create table if not exists public.divider_group_buys (
  id text primary key,
  share_token uuid not null default gen_random_uuid() unique,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'closed')),
  payload jsonb not null default '{}'::jsonb,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.divider_group_buys enable row level security;

create policy "Owners can view their group buys"
on public.divider_group_buys
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can create group buys"
on public.divider_group_buys
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update their group buys"
on public.divider_group_buys
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their group buys"
on public.divider_group_buys
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create or replace function public.divider_get_group_buy(
  p_id text,
  p_share_token uuid
)
returns table (
  id text,
  name text,
  status text,
  payload jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    group_buy.id,
    group_buy.name,
    group_buy.status,
    group_buy.payload,
    group_buy.created_at,
    group_buy.updated_at
  from public.divider_group_buys as group_buy
  where group_buy.id = p_id
    and group_buy.share_token = p_share_token;
$$;

revoke all on function public.divider_get_group_buy(text, uuid) from public;
grant execute on function public.divider_get_group_buy(text, uuid) to anon, authenticated;

create or replace function public.divider_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists divider_group_buys_set_updated_at
on public.divider_group_buys;

create trigger divider_group_buys_set_updated_at
before update on public.divider_group_buys
for each row
execute function public.divider_set_updated_at();