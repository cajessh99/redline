-- Red lines (ticket 08, spec "Red lines" and "Persistence", D4, D6). Each reader has their own
-- stored list: the eleven product items (five defaults on, six offered off), seeded once, plus any
-- red lines the reader writes (ticket 09). The enabled rows are the whole rulebook for an analysis.
--
-- product_id is the fixed product id (BUILD-REPORT.md B7) for the eleven product items and null
-- for a reader's own. Analysis identifies a red line by product_id when there is one and by the
-- row id otherwise, so flags and snapshots keep the same id across edits.
--
-- seed_red_lines() inserts the rows the app passes in (lib/red-lines/defaults.ts holds the
-- wording) only while the caller's readers.red_lines_seeded_at is null, then sets it. A second
-- call inserts nothing, even after the reader has deleted every row.
--
-- Row-level security: a reader reads and writes only their own rows.
--
-- Plain Postgres; paste into the Supabase SQL editor and run once, after 0003.

create table public.red_lines (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null default auth.uid() references public.readers (id) on delete cascade,
  product_id text null check (
    product_id in (
      'ip-assignment', 'uncapped-indemnity', 'non-compete', 'discretionary-payment',
      'termination-without-pay', 'auto-renewal', 'arbitration', 'unilateral-changes',
      'late-fees', 'fee-escalators', 'client-liability-cap'
    )
  ),
  kind text not null check (kind in ('default', 'offered', 'reader')),
  title text not null check (btrim(title) <> ''),
  description text not null check (btrim(description) <> ''),
  tiers jsonb not null check (jsonb_typeof(tiers) = 'object'),
  enabled boolean not null,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A product item carries its product id; a reader's own red line never does.
  constraint red_lines_kind_matches_product check ((kind = 'reader') = (product_id is null)),
  constraint red_lines_reader_product_key unique (reader_id, product_id)
);

create index red_lines_reader_position_idx on public.red_lines (reader_id, position);

alter table public.red_lines enable row level security;

create policy "red_lines_select_own" on public.red_lines
  for select to authenticated
  using (reader_id = (select auth.uid()));

create policy "red_lines_insert_own" on public.red_lines
  for insert to authenticated
  with check (reader_id = (select auth.uid()));

create policy "red_lines_update_own" on public.red_lines
  for update to authenticated
  using (reader_id = (select auth.uid()))
  with check (reader_id = (select auth.uid()));

create policy "red_lines_delete_own" on public.red_lines
  for delete to authenticated
  using (reader_id = (select auth.uid()));

create function public.red_lines_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger red_lines_touch_updated_at
  before update on public.red_lines
  for each row execute function public.red_lines_touch_updated_at();

-- Seeds the caller's list once. p_rows is a jsonb array of objects with product_id, kind, title,
-- description, tiers, enabled and position. Returns how many rows were inserted (0 when the list
-- was seeded before). Security invoker: everything goes through the policies above as the caller.
-- The reader row is locked first, so two first requests at once cannot both seed.
create function public.seed_red_lines(p_rows jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reader uuid := auth.uid();
  v_seeded timestamptz;
  v_inserted int;
begin
  if v_reader is null then
    raise exception 'seed_red_lines needs a signed-in reader' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'seed_red_lines needs a jsonb array' using errcode = '22023';
  end if;

  select r.red_lines_seeded_at into v_seeded
  from public.readers r
  where r.id = v_reader
  for update;

  if not found then
    raise exception 'reader not found' using errcode = 'P0002';
  end if;
  if v_seeded is not null then
    return 0;
  end if;

  insert into public.red_lines (reader_id, product_id, kind, title, description, tiers, enabled, position)
  select v_reader, r.product_id, r.kind, r.title, r.description, r.tiers, r.enabled, r.position
  from jsonb_to_recordset(p_rows) as r (
    product_id text,
    kind text,
    title text,
    description text,
    tiers jsonb,
    enabled boolean,
    position int
  )
  on conflict (reader_id, product_id) do nothing;
  get diagnostics v_inserted = row_count;

  update public.readers set red_lines_seeded_at = now() where id = v_reader;

  return v_inserted;
end;
$$;

revoke execute on function public.seed_red_lines(jsonb) from public, anon;
grant execute on function public.seed_red_lines(jsonb) to authenticated;
