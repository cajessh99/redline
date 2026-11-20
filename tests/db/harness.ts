// A real Postgres (PGlite, compiled to WebAssembly) with a minimal stand-in for the parts of
// Supabase the migrations depend on: the auth schema with auth.users and auth.uid(), and the anon
// and authenticated roles with Supabase's default grants on schema public. Every file in
// supabase/migrations/ is then applied in name order, exactly as written.
//
// Queries run through asUser() or asAnon() go through row-level security the way a request
// from the browser does on Supabase: role switched to authenticated (or anon) and the JWT
// subject claim set, inside a transaction so nothing leaks into the next query.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite, type Results, type Transaction } from "@electric-sql/pglite";

const migrationsDir = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));

const supabaseStandIn = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export type TestDb = {
  /** The raw database, connected as the Postgres superuser (bypasses row-level security). */
  db: PGlite;
  /** Creates a Supabase Auth user, as the sign-up flow does, and returns its id. */
  createAuthUser(email: string): Promise<string>;
  /** Runs one statement as a signed-in user, through row-level security. */
  asUser<T = Record<string, unknown>>(userId: string, sql: string, params?: unknown[]): Promise<Results<T>>;
  /** Runs one statement as a signed-out visitor (the anon role), through row-level security. */
  asAnon<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<Results<T>>;
  close(): Promise<void>;
};

async function migrationFiles(): Promise<string[]> {
  const names = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  return names.map((name) => migrationsDir + name);
}

async function runAs<T>(
  db: PGlite,
  role: "anon" | "authenticated",
  sub: string | null,
  sql: string,
  params: unknown[],
): Promise<Results<T>> {
  return db.transaction(async (tx: Transaction) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [sub ?? ""]);
    await tx.query("select set_config('request.jwt.claim.role', $1, true)", [role]);
    await tx.exec(`set local role ${role}`);
    return tx.query<T>(sql, params);
  });
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(supabaseStandIn);
  for (const file of await migrationFiles()) {
    await db.exec(await readFile(file, "utf8"));
  }

  return {
    db,
    async createAuthUser(email) {
      const result = await db.query<{ id: string }>(
        "insert into auth.users (email) values ($1) returning id",
        [email],
      );
      return result.rows[0].id;
    },
    asUser: (userId, sql, params = []) => runAs(db, "authenticated", userId, sql, params),
    asAnon: (sql, params = []) => runAs(db, "anon", null, sql, params),
    close: () => db.close(),
  };
}
