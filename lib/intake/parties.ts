// Candidate party names (spec, "Party selection"; D10). A pure, pattern-based scan of the opening of
// the stored text for defined terms that name a side to the contract, such as ("Client") or
// (the "Contractor"). No model call.
//
// The candidates are only offered to the reader. The reader's pick, or the role they type, is the
// only party analysis ever receives; nothing here is used to infer or default it.
//
// A defined term counts as a party when it has a positive signal:
// - it is a common role word ("Landlord", "Employee", "Client", ...), or
// - it is defined in the paragraph that names the parties ("by and between ... and ..."), after
//   that phrase, directly after a capitalised name ("Quillmont Analytics LLC, ... Ashbury ("Client")").
// A short list of defined terms that are never parties ("Agreement", "Services", "Effective Date",
// ...) is a backstop on top of that.

/** How much of the stored text is scanned, in characters. Parties are named in the opening. */
export const PARTY_SCAN_CHARS = 1500;

/** The most candidates offered. A contract has two sides, occasionally a few more. */
export const MAX_PARTY_CANDIDATES = 6;

/** Role words that name a side when the contract defines them as a term. */
export const PARTY_ROLE_WORDS: readonly string[] = [
  "Landlord",
  "Tenant",
  "Lessor",
  "Lessee",
  "Employer",
  "Employee",
  "Executive",
  "Company",
  "Consultant",
  "Contractor",
  "Subcontractor",
  "Freelancer",
  "Client",
  "Customer",
  "Supplier",
  "Vendor",
  "Provider",
  "Service Provider",
  "Agency",
  "Licensor",
  "Licensee",
  "Buyer",
  "Seller",
  "Purchaser",
  "Distributor",
  "Owner",
];

/** Defined terms that are never a party, whatever their position. */
export const NON_PARTY_TERMS: readonly string[] = [
  "Agreement",
  "Contract",
  "Lease",
  "Offer Letter",
  "Letter",
  "Services",
  "Service",
  "Deliverables",
  "Work",
  "Work Product",
  "Project",
  "Effective Date",
  "Start Date",
  "Commencement Date",
  "Confidential Information",
  "Statement of Work",
  "SOW",
  "Fees",
  "Term",
  "Party",
  "Parties",
  "Premises",
  "Property",
  "Products",
  "Goods",
  "Territory",
  "Schedule",
  "Exhibit",
];

const OPEN_QUOTE = `["“'‘]`;
const CLOSE_QUOTE = `["”'’]`;
// One to four capitalised words: "Client", "Service Provider", "Statement of Work".
const TERM = `([A-Z][A-Za-z&-]*(?:\\s+(?:of|and|[A-Z][A-Za-z&-]*)){0,3})`;
const LEAD_IN =
  "(?:(?:the|this|each|a|an|together|collectively|individually|hereinafter|herein|referred\\s+to\\s+as|called|as)\\s+)*";

/** ("Client"), (the "Contractor"), (hereinafter referred to as the "Tenant"), with curly quotes too. */
const PARENTHESISED = new RegExp(`\\(\\s*${LEAD_IN}${OPEN_QUOTE}${TERM}${CLOSE_QUOTE}\\s*\\)`, "g");

/** hereinafter "Tenant", hereinafter referred to as the "Landlord", without brackets. */
const HEREINAFTER = new RegExp(
  `\\bhereinafter\\s+(?:(?:referred\\s+to\\s+as|called)\\s+)?(?:the\\s+)?${OPEN_QUOTE}${TERM}${CLOSE_QUOTE}`,
  "g",
);

/** Where a paragraph starts naming the parties. */
const PARTIES_ANCHOR = /\b(?:by\s+and\s+between|between|among|made\s+by|entered\s+into\s+by)\b/i;

/** The text before a definition ends in a capitalised word or a company suffix: a name. */
const ENDS_WITH_NAME = /(?:[A-Z][A-Za-z.&'-]*|Inc\.|L\.L\.C\.|Ltd\.|Co\.)\s*,?\s*(?:hereinafter\s+(?:referred\s+to\s+as\s+|called\s+)?(?:the\s+)?)?$/;

type Definition = { term: string; index: number; before: string; afterAnchor: boolean };

function definitionsIn(paragraph: string): Definition[] {
  const anchor = PARTIES_ANCHOR.exec(paragraph);
  const anchorAt = anchor ? anchor.index : -1;
  const found = new Map<number, Definition>();
  for (const pattern of [PARENTHESISED, HEREINAFTER]) {
    pattern.lastIndex = 0;
    for (const match of paragraph.matchAll(pattern)) {
      const index = match.index ?? 0;
      // A bracketed "hereinafter" is matched by both patterns; keep the first one seen at a spot.
      const termAt = index + match[0].indexOf(match[1]);
      if (found.has(termAt)) continue;
      found.set(termAt, {
        term: match[1].replace(/\s+/g, " ").trim(),
        index: termAt,
        before: paragraph.slice(Math.max(0, index - 80), index),
        afterAnchor: anchorAt >= 0 && index > anchorAt,
      });
    }
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
}

function lower(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.toLowerCase()));
}

const ROLE_WORDS = lower(PARTY_ROLE_WORDS);
const NON_PARTIES = lower(NON_PARTY_TERMS);

function isParty(definition: Definition): boolean {
  const key = definition.term.toLowerCase();
  if (NON_PARTIES.has(key)) return false;
  if (ROLE_WORDS.has(key)) return true;
  return definition.afterAnchor && ENDS_WITH_NAME.test(definition.before);
}

/**
 * The party names a contract defines in its opening, in the order they first appear, without
 * duplicates. An empty list means the reader types their role.
 */
export function findPartyCandidates(text: string): string[] {
  const opening = text.slice(0, PARTY_SCAN_CHARS);
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const paragraph of opening.split(/\n\s*\n/)) {
    for (const definition of definitionsIn(paragraph)) {
      if (!isParty(definition)) continue;
      const key = definition.term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(definition.term);
      if (candidates.length === MAX_PARTY_CANDIDATES) return candidates;
    }
  }
  return candidates;
}
