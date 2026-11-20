// Posting a check, or a rerun with a new party, and reading the answer. Shared by the check page
// and the saved document page. Runs in the browser.
import type { Flag, ReceiptLine } from "../../lib/analysis/analyse.ts";
import type { CheckedRedLine, SavedState } from "../../lib/analysis/run.ts";

export type CheckResult = {
  title: string;
  party: string;
  flags: Flag[];
  receipt: ReceiptLine[];
  checkedRedLines: CheckedRedLine[];
  saved: SavedState;
};

export const NETWORK_ERROR =
  "Redline couldn't reach its server. Nothing was checked or saved. Check your connection and try again.";

export const SERVER_ERROR =
  "Redline couldn't finish reading this contract. It shows a result only when the whole check finishes. Nothing was saved. Try again in a minute.";

export type PostOutcome = { ok: true; result: CheckResult } | { ok: false; message: string };

export async function postCheck(url: string, body: Record<string, string>): Promise<PostOutcome> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }

  let parsed: ({ ok: true } & CheckResult) | { ok: false; error: { message: string } };
  try {
    parsed = await response.json();
  } catch {
    // A gateway timeout or crash answers with something that isn't the API's JSON.
    return { ok: false, message: SERVER_ERROR };
  }
  if (!parsed.ok) return { ok: false, message: parsed.error.message };
  const { ok: _ok, ...result } = parsed;
  return { ok: true, result };
}
