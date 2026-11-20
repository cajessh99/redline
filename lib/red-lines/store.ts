// A reader's stored red lines (ticket 08; spec "Red lines"; D4, D6). The port the app uses, the
// mapping between stored rows and the RedLine type analysis takes, and the seeding rule.
//
// The store talks to the database through a small transport, so the same logic runs over Supabase
// (lib/server/red-line-store.ts) and, in tests, over the real migrations in PGlite. It must not
// import server-only code.
//
// Ids. A product item is identified by its product id (BUILD-REPORT.md B7) and a reader's own red
// line by its row id. That id is what analysis receives, what flags and receipt lines carry, and
// what the analysis snapshot stores. It does not change when the red line is edited or switched.

import {
  PRODUCT_RED_LINES,
  TIERS,
  type ProductRedLineId,
  type RedLine,
  type RedLineKind,
  type Tier,
} from "./defaults.ts";

/** A red_lines row as the database returns it. */
export type RedLineRow = {
  id: string;
  product_id: string | null;
  kind: string;
  title: string;
  description: string;
  tiers: unknown;
  enabled: boolean;
  position: number;
};

/** What seed_red_lines() takes for each row. */
export type SeedRow = {
  product_id: ProductRedLineId;
  kind: "default" | "offered";
  title: string;
  description: string;
  tiers: Partial<Record<Tier, string>>;
  enabled: boolean;
  position: number;
};

/** One of the reader's red lines, as the red lines page shows it. */
export type StoredRedLine = RedLine & {
  /** The row's uuid. Used to switch it; never sent to analysis unless it is a reader's own. */
  rowId: string;
  productId: ProductRedLineId | null;
  enabled: boolean;
  position: number;
};

/** The database side of the store. Each call runs as the signed-in reader, under row-level security. */
export interface RedLineTransport {
  /** Calls seed_red_lines(). Returns how many rows it inserted. */
  seed(rows: SeedRow[]): Promise<number>;
  /** The reader's rows, in any order. */
  selectRows(): Promise<RedLineRow[]>;
  /** Sets one row's enabled flag. Returns the updated row, or null when no row of the reader's has that id. */
  updateEnabled(rowId: string, enabled: boolean): Promise<RedLineRow | null>;
}

/** The port. */
export interface RedLineStore {
  /** Seeds the list the first time, then returns every red line ordered by position. */
  listForReader(): Promise<StoredRedLine[]>;
  /** Switches one red line on or off. Returns it as stored; throws when it is not the reader's. */
  setEnabled(rowId: string, enabled: boolean): Promise<StoredRedLine>;
}

export class RedLineNotFoundError extends Error {}

/** The rows a new reader's list starts with: the eleven product items, worded as PRD section 5. */
export function seedRows(): SeedRow[] {
  return PRODUCT_RED_LINES.map((redLine, position) => ({
    product_id: redLine.id,
    kind: redLine.kind,
    title: redLine.title,
    description: redLine.description,
    tiers: { ...redLine.tiers },
    enabled: redLine.enabledByDefault,
    position,
  }));
}

const PRODUCT_IDS = new Set<string>(PRODUCT_RED_LINES.map((redLine) => redLine.id));
const KINDS: readonly RedLineKind[] = ["default", "offered", "reader"];

function parseTiers(value: unknown, rowId: string): Partial<Record<Tier, string>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`red line ${rowId} has malformed tiers`);
  }
  const tiers: Partial<Record<Tier, string>> = {};
  for (const tier of TIERS) {
    const text = (value as Record<string, unknown>)[tier];
    if (typeof text === "string" && text.trim() !== "") tiers[tier] = text;
  }
  if (Object.keys(tiers).length === 0) throw new Error(`red line ${rowId} has no tiers`);
  return tiers;
}

/**
 * A stored row as a red line. A row that is malformed throws rather than being skipped: a red line
 * the reader sees as on must never be quietly left out of a check.
 */
export function fromRow(row: RedLineRow): StoredRedLine {
  if (!(KINDS as readonly string[]).includes(row.kind)) throw new Error(`red line ${row.id} has an unknown kind`);
  const kind = row.kind as RedLineKind;
  let productId: ProductRedLineId | null = null;
  if (row.product_id !== null) {
    if (!PRODUCT_IDS.has(row.product_id)) throw new Error(`red line ${row.id} has an unknown product id`);
    productId = row.product_id as ProductRedLineId;
  }
  if ((kind === "reader") !== (productId === null)) throw new Error(`red line ${row.id} mixes kind and product id`);
  return {
    id: productId ?? row.id,
    rowId: row.id,
    productId,
    kind,
    title: row.title,
    description: row.description,
    tiers: parseTiers(row.tiers, row.id),
    enabled: row.enabled,
    position: row.position,
  };
}

/** The red lines analysis is given: the enabled ones, in list order, with nothing but the RedLine fields. */
export function enabledRedLines(list: readonly StoredRedLine[]): RedLine[] {
  return list.filter((redLine) => redLine.enabled).map(toRedLine);
}

/** A red line with only the fields analysis and the snapshot use. */
export function toRedLine({ id, kind, title, description, tiers }: RedLine): RedLine {
  return { id, kind, title, description, tiers: { ...tiers } };
}

function byPosition(a: StoredRedLine, b: StoredRedLine): number {
  return a.position - b.position || a.rowId.localeCompare(b.rowId);
}

/** The store over a transport. */
export function redLineStore(transport: RedLineTransport): RedLineStore {
  return {
    async listForReader() {
      let rows = await transport.selectRows();
      // A reader has rows only once seeded, so an empty list is either a new reader or one who
      // deleted everything. seed_red_lines() tells them apart and inserts only for the first.
      if (rows.length === 0) {
        const inserted = await transport.seed(seedRows());
        if (inserted > 0) rows = await transport.selectRows();
      }
      return rows.map(fromRow).sort(byPosition);
    },
    async setEnabled(rowId, enabled) {
      const row = await transport.updateEnabled(rowId, enabled);
      if (!row) throw new RedLineNotFoundError(`no red line ${rowId} for this reader`);
      return fromRow(row);
    },
  };
}
