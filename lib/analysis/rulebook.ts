// Which red lines a check uses (D4: they are the whole rulebook). Signed in, the reader's own
// enabled red lines from their stored list; signed out, or with accounts not configured, the five
// defaults held in code (BUILD-REPORT.md B3). A signed-in reader whose list can't be loaded gets
// an error, never the defaults: that would check against a rulebook they didn't set.

import { defaultEnabledRedLines, type RedLine } from "../red-lines/defaults.ts";

export type Rulebook = { ok: true; redLines: RedLine[] } | { ok: false; error: string };

/** `loadReaderRedLines` is null when nobody is signed in. */
export async function rulebookFor(loadReaderRedLines: (() => Promise<RedLine[]>) | null): Promise<Rulebook> {
  if (!loadReaderRedLines) return { ok: true, redLines: defaultEnabledRedLines() };
  try {
    return { ok: true, redLines: await loadReaderRedLines() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
