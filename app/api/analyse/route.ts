import { runAnalysis, RUN_ERROR_MESSAGES } from "../../../lib/analysis/run.ts";
import { defaultEnabledRedLines } from "../../../lib/red-lines/defaults.ts";
import { supabaseAnalysisStore } from "../../../lib/server/analysis-store.ts";
import { serverModelClient } from "../../../lib/server/model.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

// One model call can take up to 120 s and a regeneration adds a second, so allow both.
export const maxDuration = 300;

/**
 * POST { text, party }. The text is the normalised text the reader was shown; the file never
 * reaches the server. Signed in, the document and analysis are stored together; signed out, or
 * with accounts not configured, nothing is stored.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: { code: "bad_request", message: RUN_ERROR_MESSAGES.bad_request } },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  let store = null;
  if (supabase) {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) store = supabaseAnalysisStore(supabase);
  }

  const outcome = await runAnalysis(body, {
    model: serverModelClient(),
    store,
    // Ticket 08 replaces these with the reader's stored, enabled red lines.
    redLines: defaultEnabledRedLines(),
    log: (message) => console.error(`[analyse] ${message}`),
  });

  if (!outcome.ok) {
    return Response.json({ ok: false, error: outcome.error }, { status: outcome.status });
  }
  // Diagnostics are for the operator, not the reader.
  const { diagnostics, ...forReader } = outcome;
  console.info(`[analyse] ${JSON.stringify(diagnostics)}`);
  return Response.json(forReader);
}
