-- Changing the party on a stored document (ticket 07, spec story 10, D10). The reader picks a
-- different party and the analysis runs again over the stored text; the new party and the new
-- analysis are then written here together.
--
-- rerun_document_analysis() updates documents.party and inserts the new analysis in one statement,
-- so either both happen or neither does: a failed insert leaves the old party in place. Earlier
-- analyses are kept; the document page shows the latest one.
--
-- Security invoker: the update and the insert go through the row-level security policies in 0002
-- as the caller, so a reader can rerun only their own documents. The stored text is not a
-- parameter and is never changed here.
--
-- Plain Postgres; paste into the Supabase SQL editor and run once, after 0002.

create function public.rerun_document_analysis(
  p_document uuid,
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
  v_updated uuid;
  v_analysis uuid;
begin
  if v_reader is null then
    raise exception 'rerun_document_analysis needs a signed-in reader' using errcode = '42501';
  end if;

  -- Under the documents_update_own policy another reader's document matches no row.
  update public.documents
  set party = p_party
  where id = p_document
  returning id into v_updated;

  if v_updated is null then
    raise exception 'document not found' using errcode = 'P0002';
  end if;

  -- clock_timestamp(), not now(): the new analysis must sort after any written earlier in the
  -- same transaction.
  insert into public.analyses (document_id, reader_id, red_lines_snapshot, flags, receipt, created_at)
  values (p_document, v_reader, p_red_lines_snapshot, p_flags, coalesce(p_receipt, '[]'::jsonb), clock_timestamp())
  returning id into v_analysis;

  return v_analysis;
end;
$$;

revoke execute on function public.rerun_document_analysis(uuid, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.rerun_document_analysis(uuid, text, jsonb, jsonb, jsonb) to authenticated;
