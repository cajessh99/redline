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
import { transformWithOxc, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

const serverOnly = fileURLToPath(
  new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url),
);

// The landing page's files under app/ are .js with JSX, which Next accepts. Vite parses JSX only in
// .jsx/.tsx, so this compiles app/**/*.js as JSX for the landing-page render test.
function appJsx(): Plugin {
  return {
    name: "redline:app-js-as-jsx",
    enforce: "pre",
    async transform(code, id) {
      if (!/[\\/]app[\\/][^?]*\.js$/.test(id) || id.includes("node_modules")) return null;
      const result = await transformWithOxc(code, id, { lang: "jsx", jsx: { runtime: "automatic" } });
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig({
  plugins: [appJsx()],
  resolve: {
    alias: { "server-only": serverOnly },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
