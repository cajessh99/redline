-- Red-line editing (ticket 09; spec stories 15 to 19). The reader edits, adds and deletes their own
-- rows through the policies in 0004. This migration adds two things:
--
-- 1. A guard that an update never changes a row's product_id or kind. A product item stays a
--    product item after the reader rewords it, so "restore defaults" can still find it.
--
-- 2. restore_default_red_lines(p_rows), which puts the eleven product items back to their shipped
--    wording, switch state and position in one statement (so in one transaction): it rewrites the
--    ones the reader still has and re-inserts the ones they deleted. Rows the reader wrote
--    (product_id null) are not touched. The wording comes from the app (lib/red-lines/defaults.ts),
--    the single source; nothing about it is written here.
--
-- Plain Postgres; paste into the Supabase SQL editor and run once, after 0004.

create function public.red_lines_keep_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.product_id is distinct from old.product_id or new.kind is distinct from old.kind then
    raise exception 'a red line''s product id and kind cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger red_lines_keep_identity
  before update on public.red_lines
  for each row execute function public.red_lines_keep_identity();

-- p_rows is a jsonb array of objects with product_id, kind, title, description, tiers, enabled and
-- position, one per product item. Every entry must carry a product id. Returns how many rows were
-- written (inserted or rewritten). Security invoker: the upsert goes through the caller's
-- row-level security, so it can only ever write the caller's own rows. Calling it twice leaves the
-- same rows as calling it once.
create function public.restore_default_red_lines(p_rows jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reader uuid := auth.uid();
  v_written int;
begin
  if v_reader is null then
    raise exception 'restore_default_red_lines needs a signed-in reader' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'restore_default_red_lines needs a non-empty jsonb array' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) as e
    where e ->> 'product_id' is null
  ) then
    raise exception 'restore_default_red_lines restores product items only' using errcode = '22023';
  end if;

  -- Lock the reader row, as seed_red_lines does, so a restore and a first seed cannot interleave.
  perform 1 from public.readers r where r.id = v_reader for update;
  if not found then
    raise exception 'reader not found' using errcode = 'P0002';
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
  on conflict (reader_id, product_id) do update
    set title = excluded.title,
        description = excluded.description,
        tiers = excluded.tiers,
        enabled = excluded.enabled,
        position = excluded.position;
  get diagnostics v_written = row_count;

  -- A restored list counts as seeded, so the first-use seed never adds a second copy.
  update public.readers
  set red_lines_seeded_at = coalesce(red_lines_seeded_at, now())
  where id = v_reader;

  return v_written;
end;
$$;

revoke execute on function public.restore_default_red_lines(jsonb) from public, anon;
grant execute on function public.restore_default_red_lines(jsonb) to authenticated;
