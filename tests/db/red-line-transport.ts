// The red line store's transport over PGlite: the same calls the Supabase transport makes, sent as
// SQL through row-level security as the signed-in reader. Only the Supabase client is replaced;
// the store, the migrations, the policies and the RPCs run for real.
import type { RedLineRow, RedLineTransport } from "../../lib/red-lines/store.ts";
import type { TestDb } from "./harness.ts";

export const COLUMNS = "id, product_id, kind, title, description, tiers, enabled, position";

export function pgTransport(t: TestDb, reader: string): RedLineTransport {
  return {
    async seed(rows) {
      const { rows: out } = await t.asUser<{ n: number }>(reader, "select public.seed_red_lines($1::jsonb) as n", [
        JSON.stringify(rows),
      ]);
      return out[0].n;
    },
    async selectRows() {
      const { rows } = await t.asUser<RedLineRow>(reader, `select ${COLUMNS} from public.red_lines order by position`);
      return rows;
    },
    async updateEnabled(rowId, enabled) {
      const { rows } = await t.asUser<RedLineRow>(
        reader,
        `update public.red_lines set enabled = $2 where id = $1 returning ${COLUMNS}`,
        [rowId, enabled],
      );
      return rows[0] ?? null;
    },
    async updateWording(rowId, { title, description, tiers }) {
      const { rows } = await t.asUser<RedLineRow>(
        reader,
        `update public.red_lines set title = $2, description = $3, tiers = $4::jsonb where id = $1 returning ${COLUMNS}`,
        [rowId, title, description, JSON.stringify(tiers)],
      );
      return rows[0] ?? null;
    },
    async insertOwn(row) {
      const { rows } = await t.asUser<RedLineRow>(
        reader,
        `insert into public.red_lines (product_id, kind, title, description, tiers, enabled, position)
         values (null, 'reader', $1, $2, $3::jsonb, $4, $5) returning ${COLUMNS}`,
        [row.title, row.description, JSON.stringify(row.tiers), row.enabled, row.position],
      );
      return rows[0];
    },
    async deleteRow(rowId) {
      const result = await t.asUser(reader, "delete from public.red_lines where id = $1", [rowId]);
      return (result.affectedRows ?? 0) > 0;
    },
    async restore(rows) {
      const { rows: out } = await t.asUser<{ n: number }>(
        reader,
        "select public.restore_default_red_lines($1::jsonb) as n",
        [JSON.stringify(rows)],
      );
      return out[0].n;
    },
  };
}
