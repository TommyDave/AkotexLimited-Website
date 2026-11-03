create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.inquiries enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can view their own admin record" on public.admin_users;
create policy "Admins can view their own admin record"
  on public.admin_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Public can submit new inquiries" on public.inquiries;
create policy "Public can submit new inquiries"
  on public.inquiries
  for insert
  to anon, authenticated
  with check (
    status = 'new'
    and char_length(btrim(name)) between 2 and 120
    and char_length(email) <= 254
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and (phone is null or char_length(phone) <= 40)
    and char_length(btrim(message)) between 10 and 5000
  );

drop policy if exists "Admins can read inquiries" on public.inquiries;
create policy "Admins can read inquiries"
  on public.inquiries
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can update inquiries" on public.inquiries;
create policy "Admins can update inquiries"
  on public.inquiries
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete inquiries" on public.inquiries;
create policy "Admins can delete inquiries"
  on public.inquiries
  for delete
  to authenticated
  using ((select public.is_admin()));

grant usage on schema public to anon, authenticated;
grant insert on public.inquiries to anon, authenticated;
grant select, update, delete on public.inquiries to authenticated;
grant select on public.admin_users to authenticated;
grant usage, select on sequence public.inquiries_id_seq to anon, authenticated;
