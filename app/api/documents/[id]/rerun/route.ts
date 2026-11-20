import { rerunWithCurrentRedLines, RERUN_ERROR_MESSAGES } from "../../../../../lib/analysis/rerun.ts";
import { isDocumentId } from "../../../../../lib/documents/library.ts";
import type { RedLine } from "../../../../../lib/red-lines/defaults.ts";
import { supabaseDocumentStore } from "../../../../../lib/server/analysis-store.ts";
import { readerEnabledRedLines } from "../../../../../lib/server/red-line-store.ts";
import { serverModelClient } from "../../../../../lib/server/model.ts";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server.ts";

// One model call can take up to 120 s and a regeneration adds a second, so allow both.
export const maxDuration = 300;

const SIGNED_OUT = "Sign in to check this contract again.";

function refuse(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

/**
 * POST, no body. "Check again with my current red lines" (story 51): reruns the analysis of the
 * reader's stored document, over its stored text and as its stored party, against the reader's
 * enabled red lines now, and stores a new analysis with its own snapshot. Earlier analyses stay.
 * A model failure stores nothing.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return refuse(401, "signed_out", SIGNED_OUT);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return refuse(401, "signed_out", SIGNED_OUT);

  if (!isDocumentId(id)) return refuse(404, "not_found", RERUN_ERROR_MESSAGES.not_found);

  let redLines: RedLine[];
  try {
    redLines = await readerEnabledRedLines(supabase);
  } catch (loadError) {
    console.error(`[rerun] loading red lines failed: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
    return refuse(500, "red_lines_unavailable", RERUN_ERROR_MESSAGES.red_lines_unavailable);
  }

  const outcome = await rerunWithCurrentRedLines(id, {
    model: serverModelClient(),
    store: supabaseDocumentStore(supabase),
    redLines,
    log: (message) => console.error(`[rerun] ${message}`),
  });

  if (!outcome.ok) return Response.json({ ok: false, error: outcome.error }, { status: outcome.status });
  const { diagnostics, ...forReader } = outcome;
  console.info(`[rerun] ${JSON.stringify(diagnostics)}`);
  return Response.json(forReader);
}
