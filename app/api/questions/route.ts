import { askAboutUnsavedText, ASK_ERROR_MESSAGES } from "../../../lib/analysis/ask.ts";
import { serverModelClient } from "../../../lib/server/model.ts";

// One model call can take up to 120 s and a regeneration adds a second, so allow both.
export const maxDuration = 300;

/**
 * POST { text, party, question }. For a result on /check that is not saved (signed out, or accounts
 * not open): answers from the text the reader was shown, which must be exactly the normalised text,
 * and stores nothing (BUILD-REPORT.md B3, B14). Saved documents use /api/documents/[id]/questions,
 * which reads the stored text instead.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: { code: "bad_request", message: ASK_ERROR_MESSAGES.bad_request } },
      { status: 400 },
    );
  }

  const outcome = await askAboutUnsavedText(body, {
    model: serverModelClient(),
    log: (message) => console.error(`[questions] ${message}`),
  });

  if (!outcome.ok) return Response.json({ ok: false, error: outcome.error }, { status: outcome.status });
  const { diagnostics, ...forReader } = outcome;
  console.info(`[questions] ${JSON.stringify(diagnostics)}`);
  return Response.json(forReader);
}
