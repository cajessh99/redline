-- Questions (ticket 11, spec stories 36 to 41, "Persistence"). One row per question a signed-in
-- reader asked about one of their documents, with the result as it was shown: an answer with the
-- sentence it cites and that sentence's offset in the stored text, or "does not say".
--
-- party is the reader's party the question was answered for. A document's party can change later
-- ("Change my party"), so each answer records the side it was read from.
--
-- A "does_not_say" row carries no answer and no citation, so nothing the model said that failed
-- the check is ever stored. An "answered" row must carry all three, and (in the insert policy) its
-- citation must occur verbatim in the document's stored text. Offsets count UTF-16 units, as the
-- app computes them; the policy checks the exact substring and the app checks the offset again
-- when it reads the row back.
--
-- Row-level security: a reader reads, adds and deletes only their own questions, and only on a
-- document they own. There is no update: a stored answer is never rewritten. Deleting a document
-- deletes its questions.
--
-- Plain Postgres; paste into the Supabase SQL editor and run once, after 0006.

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  reader_id uuid not null default auth.uid() references public.readers (id) on delete cascade,
  question text not null check (btrim(question) <> '' and char_length(question) <= 500),
  party text not null check (btrim(party) <> ''),
  kind text not null check (kind in ('answered', 'does_not_say')),
  answer text null,
  citation text null,
  citation_offset int null,
  created_at timestamptz not null default now(),
  constraint questions_result_shape check (
    (
      kind = 'answered'
      and answer is not null and btrim(answer) <> ''
      and citation is not null and btrim(citation) <> ''
      and citation_offset is not null and citation_offset >= 0
    )
    or (
      kind = 'does_not_say'
      and answer is null and citation is null and citation_offset is null
    )
  )
);

create index questions_document_created_idx on public.questions (document_id, created_at desc);

alter table public.questions enable row level security;

create policy "questions_select_own" on public.questions
  for select to authenticated
  using (reader_id = (select auth.uid()));

-- The document must belong to the same reader, and an answered row's citation must be in its text.
-- The subquery runs under the documents policy too, so another reader's document is not found.
create policy "questions_insert_own_document" on public.questions
  for insert to authenticated
  with check (
    reader_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.reader_id = (select auth.uid())
        and (kind = 'does_not_say' or strpos(d.stored_text, citation) > 0)
    )
  );

create policy "questions_delete_own" on public.questions
  for delete to authenticated
  using (reader_id = (select auth.uid()));
