import { rerunWithParty, RERUN_ERROR_MESSAGES } from "../../../../../lib/analysis/rerun.ts";
import { defaultEnabledRedLines } from "../../../../../lib/red-lines/defaults.ts";
import { supabaseDocumentStore } from "../../../../../lib/server/analysis-store.ts";
import { serverModelClient } from "../../../../../lib/server/model.ts";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server.ts";

// One model call can take up to 120 s and a regeneration adds a second, so allow both.
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIGNED_OUT = "Sign in again to change your party on this contract.";

function refuse(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

/**
 * POST { party }. Reruns the analysis of the reader's stored document as that party, using the
 * text already stored for it, and stores the new party and analysis together. The request carries
 * no text: anything else in the body is ignored.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return refuse(401, "signed_out", SIGNED_OUT);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return refuse(401, "signed_out", SIGNED_OUT);

  if (!UUID.test(id)) return refuse(404, "not_found", RERUN_ERROR_MESSAGES.not_found);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "bad_request", RERUN_ERROR_MESSAGES.bad_request);
  }

  const outcome = await rerunWithParty(id, body, {
    model: serverModelClient(),
    store: supabaseDocumentStore(supabase),
    // Ticket 08 replaces these with the reader's stored, enabled red lines.
    redLines: defaultEnabledRedLines(),
    log: (message) => console.error(`[rerun] ${message}`),
  });

  if (!outcome.ok) return Response.json({ ok: false, error: outcome.error }, { status: outcome.status });
  const { diagnostics, ...forReader } = outcome;
  console.info(`[rerun] ${JSON.stringify(diagnostics)}`);
  return Response.json(forReader);
}
