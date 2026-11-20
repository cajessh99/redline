// Reading a stored analysis back. Rows come from jsonb, so their shape is checked here rather than
// trusted, and every flag and every quoted receipt sentence is verified again against the stored
// text before it can be shown (ADR-0001). One that fails is left out, never shown unverified.

import { TIERS, type Tier } from "../red-lines/defaults.ts";
import type { Flag, ReceiptLine } from "./analyse.ts";
import type { CheckedRedLine } from "./run.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Flags from a stored analysis whose shape is right and whose source is verbatim at its offset. */
export function parseStoredFlags(value: unknown, storedText: string): Flag[] {
  if (!Array.isArray(value)) return [];
  const flags: Flag[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const redLineId = str(item.redLineId);
    const redLineTitle = str(item.redLineTitle);
    const tier = str(item.tier);
    const statement = str(item.statement);
    const sourceSentence = str(item.sourceSentence);
    const counterOffer = str(item.counterOffer) ?? "";
    const offset = typeof item.offset === "number" ? item.offset : -1;
    if (!redLineId || !redLineTitle || !statement || !sourceSentence) continue;
    if (!tier || !(TIERS as readonly string[]).includes(tier)) continue;
    if (!isVerbatimAt(storedText, sourceSentence, offset)) continue;
    flags.push({ redLineId, redLineTitle, tier: tier as Tier, statement, sourceSentence, offset, counterOffer });
  }
  return flags;
}

/**
 * Receipt lines from a stored analysis whose shape is right. An "addressed" line must still sit
 * verbatim in the stored text at its offset; one that does not is corrupted data and is left out
 * entirely. It is never turned into "not mentioned", which would be a claim the stored data does
 * not support. ResultView then shows that red line as unavailable rather than skipping it.
 */
export function parseStoredReceipt(value: unknown, storedText: string): ReceiptLine[] {
  if (!Array.isArray(value)) return [];
  const lines: ReceiptLine[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const redLineId = str(item.redLineId);
    const redLineTitle = str(item.redLineTitle);
    if (!redLineId || !redLineTitle) continue;
    if (item.kind === "not_mentioned") {
      lines.push({ redLineId, redLineTitle, kind: "not_mentioned" });
    } else if (item.kind === "addressed") {
      const sentence = str(item.sentence);
      const offset = typeof item.offset === "number" ? item.offset : -1;
      if (!sentence || !isVerbatimAt(storedText, sentence, offset)) continue;
      lines.push({ redLineId, redLineTitle, kind: "addressed", sentence, offset });
    }
  }
  return lines;
}

/** The red lines a stored analysis checked, from its snapshot. */
export function parseCheckedRedLines(value: unknown): CheckedRedLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = str(item.id);
    const title = str(item.title);
    return id && title ? [{ id, title }] : [];
  });
}

/** True when `sentence` sits in `text` exactly at `offset`. */
export function isVerbatimAt(text: string, sentence: string, offset: number): boolean {
  return (
    sentence.trim() !== "" &&
    Number.isInteger(offset) &&
    offset >= 0 &&
    text.slice(offset, offset + sentence.length) === sentence
  );
}
