-- Documents and analyses (spec, "Persistence"). A document is the stored (normalised) text a
-- reader checked, never the file. An analysis is one run over it: the red lines checked, as they
-- were worded at the time, and the verified flags. Ticket 04 fills the receipt column.
--
-- Row-level security: a reader reads and writes only their own rows, and an analysis can only be
-- attached to a document the same reader owns. Deleting a document deletes its analyses.
--
-- save_document_analysis() writes a document and its first analysis in one statement, so a
-- failure leaves no document without its analysis.
--
-- Plain Postgres; paste into the Supabase SQL editor and run once, after 0001.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null default auth.uid() references public.readers (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  stored_text text not null check (stored_text <> ''),
  party text not null check (btrim(party) <> ''),
  created_at timestamptz not null default now()
);

create index documents_reader_created_idx on public.documents (reader_id, created_at desc);

alter table public.documents enable row level security;

create policy "documents_select_own" on public.documents
  for select to authenticated
  using (reader_id = (select auth.uid()));

create policy "documents_insert_own" on public.documents
  for insert to authenticated
  with check (reader_id = (select auth.uid()));

create policy "documents_update_own" on public.documents
  for update to authenticated
  using (reader_id = (select auth.uid()))
  with check (reader_id = (select auth.uid()));

create policy "documents_delete_own" on public.documents
  for delete to authenticated
  using (reader_id = (select auth.uid()));

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  reader_id uuid not null default auth.uid() references public.readers (id) on delete cascade,
  red_lines_snapshot jsonb not null check (jsonb_typeof(red_lines_snapshot) = 'array'),
  flags jsonb not null check (jsonb_typeof(flags) = 'array'),
  receipt jsonb not null default '[]'::jsonb check (jsonb_typeof(receipt) = 'array'),
  created_at timestamptz not null default now()
);

create index analyses_document_created_idx on public.analyses (document_id, created_at desc);

alter table public.analyses enable row level security;

create policy "analyses_select_own" on public.analyses
  for select to authenticated
  using (reader_id = (select auth.uid()));

-- The document must belong to the same reader. The subquery runs under the documents policy too,
-- so another reader's document is simply not found.
create policy "analyses_insert_own_document" on public.analyses
  for insert to authenticated
  with check (
    reader_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.reader_id = (select auth.uid())
    )
  );

create policy "analyses_update_own" on public.analyses
  for update to authenticated
  using (reader_id = (select auth.uid()))
  with check (
    reader_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.reader_id = (select auth.uid())
    )
  );

create policy "analyses_delete_own" on public.analyses
  for delete to authenticated
  using (reader_id = (select auth.uid()));

-- Stores a document and its analysis together for the signed-in reader and returns the document
-- id. Security invoker: both inserts go through the policies above as the caller. A function call
-- is one statement, so if the analysis insert fails the document insert is rolled back with it.
create function public.save_document_analysis(
  p_title text,
  p_stored_text text,
  p_party text,
  p_red_lines_snapshot jsonb,
  p_flags jsonb,
  p_receipt jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reader uuid := auth.uid();
  v_document uuid;
begin
  if v_reader is null then
    raise exception 'save_document_analysis needs a signed-in reader' using errcode = '42501';
  end if;

  insert into public.documents (reader_id, title, stored_text, party)
  values (v_reader, p_title, p_stored_text, p_party)
  returning id into v_document;

  insert into public.analyses (document_id, reader_id, red_lines_snapshot, flags, receipt)
  values (v_document, v_reader, p_red_lines_snapshot, p_flags, coalesce(p_receipt, '[]'::jsonb));

  return v_document;
end;
$$;

revoke execute on function public.save_document_analysis(text, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_document_analysis(text, text, text, jsonb, jsonb, jsonb) to authenticated;
