// Filesystem-derived Inngest function registry.
//
// WHY THIS EXISTS
// app/api/inngest/route.ts used to carry a hand-maintained `functions: [...]`
// array. Every PR that added an Inngest function edited those same lines, so
// two PRs in flight against main collided in the same file — five stacked-PR
// conflicts in a single evening (2026-06-11), one of which resolved into a
// DUPLICATE Inngest function id that broke the production webpack build.
//
// The fix is structural, not procedural: this registry discovers every
// function under ./functions at BUILD TIME and route.ts just consumes the
// result. Adding a function is now "create a file in ./functions" — it touches
// only that new file, so two PRs never edit the same line. Zero merge surface.
//
// WHY require.context AND NOT glob.sync
// A runtime `glob.sync('lib/inngest/functions/**')` was considered and
// rejected: Vercel ships compiled, bundled output — not the source .ts files —
// so a runtime filesystem read finds nothing in production. webpack's
// require.context is resolved statically at build time, so the matched modules
// are really traced and bundled. It is the only filesystem-derived approach
// that survives the Next.js/Vercel bundler. (Build is plain `next build` =
// webpack, not Turbopack — see package.json.)

import { isInngestFunction } from "inngest";
import type { InngestFunction } from "inngest";

// webpack's require.context is statically analyzed at build time; it is not in
// node's require typings, so describe only the shape we use.
type RequireContext = {
  keys(): string[];
  (id: string): Record<string, unknown>;
};
const webpackRequire = require as unknown as {
  context(dir: string, recursive: boolean, pattern: RegExp): RequireContext;
};

// Match ./<name>.ts directly under ./functions, but NOT colocated *.test.ts —
// some functions keep their unit test next to them (e.g. fleet-health-check).
// `isInngestFunction` below is a second safety net for any non-function .ts.
const functionsContext = webpackRequire.context(
  "./functions",
  false,
  /^\.\/(?!.*\.test\.).+\.ts$/,
);

function collectInngestFunctions(): InngestFunction.Any[] {
  const found: InngestFunction.Any[] = [];
  for (const key of functionsContext.keys().sort()) {
    const mod = functionsContext(key);
    for (const exported of Object.values(mod)) {
      if (isInngestFunction(exported)) found.push(exported);
    }
  }

  // Duplicate-id guard. Two functions sharing an Inngest id is the exact bug
  // that broke the build on 2026-06-11. Fail loud at module load (build / cold
  // boot) naming the offending id, rather than shipping a half-registered
  // serve handler that 500s the Inngest handshake in production.
  const seen = new Map<string, string>();
  for (const fn of found) {
    const id = fn.id();
    if (seen.has(id)) {
      throw new Error(
        `Duplicate Inngest function id "${id}" found while auto-deriving the ` +
          `registry from lib/inngest/functions/. Two functions cannot share an ` +
          `id — rename one. See lib/inngest/registry.ts.`,
      );
    }
    seen.set(id, id);
  }

  return found;
}

// Discovered once at module load. route.ts passes this straight to serve().
export const allInngestFunctions: InngestFunction.Any[] = collectInngestFunctions();
