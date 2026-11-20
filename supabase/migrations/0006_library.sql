-- The library (ticket 10, spec stories 5 and 47 to 51). One row per document the signed-in reader
-- owns, with the counts of Severe, Moderate and Minor flags in its latest analysis, so the library
-- page loads with one query.
--
-- library_entries is a security-invoker view: it reads documents and analyses as the caller, so
-- the row-level security policies in 0002 decide what it returns. A reader sees only their own
-- documents; a signed-out visitor is not granted the view at all.
--
-- The counts mirror what the document page shows. A stored flag is counted only when it has the
-- fields the page needs (a red line title, a statement, a counter-offer, one of the three tiers)
-- and its source sentence still occurs, as an exact match, in the stored text. A flag the page
-- would leave out is never counted (ADR-0001). The page also checks the sentence sits at its
-- stored offset; offsets count UTF-16 units in the browser and characters here, so the view
-- checks the exact substring and leaves the offset to the page.
--
-- Also caps a title's length, matching MAX_TITLE_CHARS in lib/intake/title.ts. Titles stored
-- before this migration were cut to 80 characters, so every existing row passes.
--
-- Plain Postgres; paste into the Supabase SQL editor and run once, after 0005.

alter table public.documents
  add constraint documents_title_length check (char_length(title) <= 120);

create view public.library_entries
with (security_invoker = true)
as
select
  d.id,
  d.title,
  d.party,
  d.created_at,
  latest.created_at as analysed_at,
  coalesce(counts.severe, 0)::int as severe_count,
  coalesce(counts.moderate, 0)::int as moderate_count,
  coalesce(counts.minor, 0)::int as minor_count
from public.documents d
left join lateral (
  select a.flags, a.created_at
  from public.analyses a
  where a.document_id = d.id
  order by a.created_at desc, a.id desc
  limit 1
) latest on true
left join lateral (
  select
    count(*) filter (where f ->> 'tier' = 'Severe') as severe,
    count(*) filter (where f ->> 'tier' = 'Moderate') as moderate,
    count(*) filter (where f ->> 'tier' = 'Minor') as minor
  from jsonb_array_elements(
    case when jsonb_typeof(latest.flags) = 'array' then latest.flags else '[]'::jsonb end
  ) as f
  where jsonb_typeof(f) = 'object'
    and coalesce(f ->> 'redLineId', '') <> ''
    and coalesce(f ->> 'redLineTitle', '') <> ''
    and coalesce(f ->> 'statement', '') <> ''
    and coalesce(btrim(f ->> 'counterOffer'), '') <> ''
    and coalesce(f ->> 'sourceSentence', '') <> ''
    and strpos(d.stored_text, f ->> 'sourceSentence') > 0
) counts on true;

revoke all on public.library_entries from public, anon;
grant select on public.library_entries to authenticated;
