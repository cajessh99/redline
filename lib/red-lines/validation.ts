// Checking a red line the reader wrote or edited (ticket 09; spec stories 15 and 16). Pure, so the
// server action runs it before anything is stored and the browser runs the same rules to show
// messages beside the fields. Shared by server and client code: it must not import server-only code.
//
// A red line needs a title, a description of what matches, and at least one tier. A tier left
// empty is removed from the red line, which is how a reader drops a tier they do not want.

import { TIERS, type Tier } from "./defaults.ts";

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1000;
export const TIER_MAX = 600;

/** What the form holds: every field as typed, each tier as a string (empty means "no such tier"). */
export type RedLineDraft = {
  title: string;
  description: string;
  tiers: Record<Tier, string>;
};

/** What is stored: trimmed text, and only the tiers that have a description. */
export type RedLineWording = {
  title: string;
  description: string;
  tiers: Partial<Record<Tier, string>>;
};

export type DraftField = "title" | "description" | Tier | "tiers";

export type DraftErrors = Partial<Record<DraftField, string>>;

export type ValidationResult = { ok: true; value: RedLineWording } | { ok: false; errors: DraftErrors };

export const VALIDATION_COPY = {
  titleRequired: "Give this red line a title.",
  descriptionRequired: "Say what a clause has to do to match.",
  tierRequired: "Describe at least one tier. A red line with no tiers can't flag anything.",
  tooLong: (max: number) => `Keep this to ${max} characters or fewer.`,
} as const;

/** The order fields appear on the form, so the first error can take focus. */
export const FIELD_ORDER: readonly DraftField[] = ["title", "description", "tiers", ...TIERS];

/** An empty form, for adding a red line. */
export function emptyDraft(): RedLineDraft {
  return { title: "", description: "", tiers: { Severe: "", Moderate: "", Minor: "" } };
}

/** A form filled with a red line's current wording, for editing it. */
export function draftFrom(wording: RedLineWording): RedLineDraft {
  return {
    title: wording.title,
    description: wording.description,
    tiers: { Severe: wording.tiers.Severe ?? "", Moderate: wording.tiers.Moderate ?? "", Minor: wording.tiers.Minor ?? "" },
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Checks a draft. Takes `unknown` because the server action receives whatever the browser sent.
 * Returns the wording to store, or a message for each field that is wrong.
 */
export function validateRedLineDraft(input: unknown): ValidationResult {
  const record = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const rawTiers =
    typeof record.tiers === "object" && record.tiers !== null ? (record.tiers as Record<string, unknown>) : {};
  const errors: DraftErrors = {};

  const title = text(record.title);
  if (title === "") errors.title = VALIDATION_COPY.titleRequired;
  else if (title.length > TITLE_MAX) errors.title = VALIDATION_COPY.tooLong(TITLE_MAX);

  const description = text(record.description);
  if (description === "") errors.description = VALIDATION_COPY.descriptionRequired;
  else if (description.length > DESCRIPTION_MAX) errors.description = VALIDATION_COPY.tooLong(DESCRIPTION_MAX);

  const tiers: Partial<Record<Tier, string>> = {};
  for (const tier of TIERS) {
    const value = text(rawTiers[tier]);
    if (value === "") continue;
    if (value.length > TIER_MAX) errors[tier] = VALIDATION_COPY.tooLong(TIER_MAX);
    else tiers[tier] = value;
  }
  const anyTierTyped = TIERS.some((tier) => text(rawTiers[tier]) !== "");
  if (!anyTierTyped) errors.tiers = VALIDATION_COPY.tierRequired;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, description, tiers } };
}

/** The first field with an error, in form order, or null. */
export function firstInvalidField(errors: DraftErrors): DraftField | null {
  return FIELD_ORDER.find((field) => errors[field]) ?? null;
}
