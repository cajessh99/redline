import { askAboutStoredDocument, ASK_ERROR_MESSAGES } from "../../../../../lib/analysis/ask.ts";
import { isDocumentId } from "../../../../../lib/documents/library.ts";
import { serverModelClient } from "../../../../../lib/server/model.ts";
import { supabaseQuestionStore } from "../../../../../lib/server/question-store.ts";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server.ts";

// One model call can take up to 120 s and a regeneration adds a second, so allow both.
export const maxDuration = 300;

const SIGNED_OUT = "Sign in again to ask about this contract.";

function refuse(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

/**
 * POST { question }. Answers a question about the reader's saved document from its stored text, as
 * its stored party, and stores the question with its result. The request carries no text or
 * party: anything else in the body is ignored. A model failure stores nothing.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return refuse(401, "signed_out", SIGNED_OUT);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return refuse(401, "signed_out", SIGNED_OUT);

  if (!isDocumentId(id)) return refuse(404, "not_found", ASK_ERROR_MESSAGES.not_found);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "bad_request", ASK_ERROR_MESSAGES.bad_request);
  }

  const outcome = await askAboutStoredDocument(id, body, {
    model: serverModelClient(),
    store: supabaseQuestionStore(supabase),
    log: (message) => console.error(`[questions] ${message}`),
  });

  if (!outcome.ok) return Response.json({ ok: false, error: outcome.error }, { status: outcome.status });
  const { diagnostics, ...forReader } = outcome;
  console.info(`[questions] ${JSON.stringify(diagnostics)}`);
  return Response.json(forReader);
}
