// Import convention for everything under lib/ (and tests/, scripts/): relative imports carry the
// `.ts` extension, as in `import { supabaseConfig } from "../env.ts"`. Next's bundler accepts the
// extension, tsconfig allows it (allowImportingTsExtensions), and it lets plain Node (v22.18+,
// which strips types natively) run `node scripts/x.ts` against the same modules with no build
// step. Two tsconfig flags keep that true: verbatimModuleSyntax (type-only imports must say
// `import type`, which Node erases) and erasableSyntaxOnly (no enums, namespaces, or parameter
// properties, which Node cannot strip). A module under lib/ must not import from `@/` aliases or
// from app/, because Node would not resolve either.
//
// `server-only` ships inside Next and is aliased by Next's bundler; outside Next it has no
// top-level package, so the alias below points it at Next's own empty module for tests.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const serverOnly = fileURLToPath(
  new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: { "server-only": serverOnly },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
