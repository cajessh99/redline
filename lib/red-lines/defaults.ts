// The eleven product red lines, worded exactly as PRD.md section 5 words them (spec, "Red lines").
// Ids are fixed (BUILD-REPORT.md B7) and shared by code, fixtures, the SQL seed and tests.
//
// Default items: the title is the bold heading without its number and closing full stop, the
// description is the heading as a sentence, and each tier is the PRD's "Severe when...",
// "Moderate when..." or "Minor when..." sentence. Offered items: the title is the bold name, the
// description is the PRD text after the tier word, and only the tiers the PRD states are present.

export const TIERS = ["Severe", "Moderate", "Minor"] as const;
export type Tier = (typeof TIERS)[number];

export type RedLineKind = "default" | "offered" | "reader";

/**
 * A red line as analysis sees it. Product items and a reader's own stored, edited red lines
 * (ticket 08) both satisfy this shape. A reader-authored red line has kind "reader" and any id.
 */
export type RedLine = {
  id: string;
  kind: RedLineKind;
  title: string;
  /** What a clause has to do to match. */
  description: string;
  /** Each stated tier, described in this red line's terms. */
  tiers: Partial<Record<Tier, string>>;
};

export const DEFAULT_RED_LINE_IDS = [
  "ip-assignment",
  "uncapped-indemnity",
  "non-compete",
  "discretionary-payment",
  "termination-without-pay",
] as const;

export const OFFERED_RED_LINE_IDS = [
  "auto-renewal",
  "arbitration",
  "unilateral-changes",
  "late-fees",
  "fee-escalators",
  "client-liability-cap",
] as const;

export type ProductRedLineId =
  | (typeof DEFAULT_RED_LINE_IDS)[number]
  | (typeof OFFERED_RED_LINE_IDS)[number];

export type ProductRedLine = RedLine & {
  id: ProductRedLineId;
  kind: "default" | "offered";
  enabledByDefault: boolean;
};

export const PRODUCT_RED_LINES: readonly ProductRedLine[] = [
  {
    id: "ip-assignment",
    kind: "default",
    enabledByDefault: true,
    title: "Assignment of IP I created before or outside this engagement",
    description: "Assignment of IP I created before or outside this engagement.",
    tiers: {
      Severe:
        "Severe when the assignment reaches work, code, tools, or libraries made before or outside the engagement.",
      Moderate: "Moderate when deliverables transfer to the client before payment is received.",
      Minor: "Minor when the reader is barred from showing the work in a portfolio.",
    },
  },
  {
    id: "uncapped-indemnity",
    kind: "default",
    enabledByDefault: true,
    title: "Uncapped indemnity or unlimited liability on me",
    description: "Uncapped indemnity or unlimited liability on me.",
    tiers: {
      Severe:
        "Severe when the reader indemnifies the client without a cap, or for the client's own acts.",
      Moderate:
        "Moderate when the reader's liability is capped but the client's is not, or the reader's cap exceeds the contract value.",
      Minor: "Minor when indemnity is mutual with narrow carve-outs.",
    },
  },
  {
    id: "non-compete",
    kind: "default",
    enabledByDefault: true,
    title: "A non-compete or non-solicit that bars me from other clients",
    description: "A non-compete or non-solicit that bars me from other clients.",
    tiers: {
      Severe:
        "Severe when the reader may not work for other clients, or in their field, during or after the engagement.",
      Moderate:
        "Moderate when the reader may not solicit the client's customers for a fixed period.",
      Minor: "Minor when the reader may not solicit the client's own employees.",
    },
  },
  {
    id: "discretionary-payment",
    kind: "default",
    enabledByDefault: true,
    title: "Payment that depends on the client's discretion or on a third party paying first",
    description: "Payment that depends on the client's discretion or on a third party paying first.",
    tiers: {
      Severe:
        'Severe when payment is conditioned on acceptance at the client\'s sole discretion, or on the client being paid by their own customer first ("pay when paid").',
      Moderate: "Moderate when payment is due later than 30 days after invoice.",
      Minor:
        "Minor when invoicing formalities delay payment, such as invoices accepted only on a fixed day.",
    },
  },
  {
    id: "termination-without-pay",
    kind: "default",
    enabledByDefault: true,
    title: "Termination without notice, or without pay for work already done",
    description: "Termination without notice, or without pay for work already done.",
    tiers: {
      Severe:
        "Severe when the client may terminate and owe nothing for work in progress or delivered.",
      Moderate:
        "Moderate when the client may terminate without notice but must pay for work done, or when there is no kill fee on unilateral termination.",
      Minor: "Minor when the notice period is under seven days.",
    },
  },
  {
    id: "auto-renewal",
    kind: "offered",
    enabledByDefault: false,
    title: "Auto-renewal",
    description:
      'The research\'s top-ranked clause type by complaint volume (FTC: "nearly 70 consumer complaints per day" in 2024), but the evidence is consumers and leases. For a freelancer it is an auto-renewing retainer, an inconvenience.',
    tiers: {
      Moderate:
        'The research\'s top-ranked clause type by complaint volume (FTC: "nearly 70 consumer complaints per day" in 2024), but the evidence is consumers and leases. For a freelancer it is an auto-renewing retainer, an inconvenience.',
    },
  },
  {
    id: "arbitration",
    kind: "offered",
    enabledByDefault: false,
    title: "Arbitration or class-action waiver",
    description:
      "Moderate for arbitration in a distant forum (cost of pursuing an unpaid invoice), Minor for a class waiver (rarely relevant to a freelancer).",
    tiers: {
      Moderate:
        "Moderate for arbitration in a distant forum (cost of pursuing an unpaid invoice)",
      Minor: "Minor for a class waiver (rarely relevant to a freelancer).",
    },
  },
  {
    id: "unilateral-changes",
    kind: "offered",
    enabledByDefault: false,
    title: "Unilateral changes to terms",
    description:
      "The client may change the agreement without the reader's consent. Research has commentary only.",
    tiers: {
      Moderate:
        "The client may change the agreement without the reader's consent. Research has commentary only.",
    },
  },
  {
    id: "late-fees",
    kind: "offered",
    enabledByDefault: false,
    title: "Late fees and penalties on me",
    description: "Fees the reader pays for missing a deadline.",
    tiers: {
      Moderate: "Fees the reader pays for missing a deadline.",
    },
  },
  {
    id: "fee-escalators",
    kind: "offered",
    enabledByDefault: false,
    title: "Fee escalators",
    description: "Prices or rates that rise automatically. No research data.",
    tiers: {
      Minor: "Prices or rates that rise automatically. No research data.",
    },
  },
  {
    id: "client-liability-cap",
    kind: "offered",
    enabledByDefault: false,
    title: "A cap on the client's liability to me set below what I am owed",
    description: "Distinct from red line 2, which is the reader's own exposure.",
    tiers: {
      Moderate: "Distinct from red line 2, which is the reader's own exposure.",
    },
  },
];

/** The red lines switched on for a new reader, and for a check made without an account. */
export function defaultEnabledRedLines(): ProductRedLine[] {
  return PRODUCT_RED_LINES.filter((redLine) => redLine.enabledByDefault);
}
