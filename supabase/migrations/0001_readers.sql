-- Readers: one row per Supabase Auth user, created by a trigger when the user signs up.
-- Every later table hangs off this one, and row-level security is on from the first table:
-- a reader can read and write only the row whose id is their own auth.uid().
--
-- Plain Postgres; paste into the Supabase SQL editor and run once.

create table public.readers (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  red_lines_seeded_at timestamptz null
);

alter table public.readers enable row level security;

create policy "readers_select_own" on public.readers
  for select to authenticated
  using (id = (select auth.uid()));

create policy "readers_insert_own" on public.readers
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "readers_update_own" on public.readers
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "readers_delete_own" on public.readers
  for delete to authenticated
  using (id = (select auth.uid()));

-- Creates the reader row when Supabase Auth creates a user. Security definer so it can write
-- past row-level security; an empty search_path so every name it uses is schema-qualified.
create function public.create_reader_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.readers (id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.create_reader_for_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_reader_for_new_user();
