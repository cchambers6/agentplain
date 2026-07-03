import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { BOOKING_CTA_LABEL, bookingCta, bookingUrl } from "@/lib/marketing/booking";

// ── booking config (lib/marketing/booking.ts) ────────────────────────────
//
// The env contract is the whole point: whatever NEXT_PUBLIC_BOOKING_URL
// holds — unset, a real link, or a leftover {{CALENDLY_LINK}} token from an
// outreach template — the CTA must resolve to something a customer can
// click. See sales deep-dive 2026-07-02 doc 03 (the placeholder dead-end).

const ENV_KEY = "NEXT_PUBLIC_BOOKING_URL";

describe("booking CTA config", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env[ENV_KEY];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = saved;
  });

  it("unset env → CTA falls back to /contact, never a dead link", () => {
    delete process.env[ENV_KEY];
    assert.equal(bookingUrl(), null);
    assert.deepEqual(bookingCta(), { href: "/contact", external: false });
  });

  it("configured https link passes through as an external CTA", () => {
    process.env[ENV_KEY] = "https://calendly.com/example/intro-call";
    assert.equal(bookingUrl(), "https://calendly.com/example/intro-call");
    assert.deepEqual(bookingCta(), {
      href: "https://calendly.com/example/intro-call",
      external: true,
    });
  });

  it("a leftover template token in the env is treated as unset", () => {
    process.env[ENV_KEY] = "{{CALENDLY_LINK}}";
    assert.equal(bookingUrl(), null);
    assert.equal(bookingCta().href, "/contact");
  });

  it("non-https values are treated as unset (no javascript:/http: links)", () => {
    for (const bad of ["http://calendly.com/x", "javascript:alert(1)", "calendly.com/x"]) {
      process.env[ENV_KEY] = bad;
      assert.equal(bookingUrl(), null, `expected ${bad} to be rejected`);
    }
  });

  it("whitespace-only env is unset", () => {
    process.env[ENV_KEY] = "   ";
    assert.equal(bookingUrl(), null);
  });

  it("the label is the ratified outreach wording", () => {
    assert.equal(BOOKING_CTA_LABEL, "Book an intro call");
  });
});

// ── placeholder sweep over customer-rendered source ──────────────────────
//
// Guardrail for the whole class of bug: no unresolved template token
// (`{{CALENDLY_LINK}}`, `{{CalLink}}`, …) may appear in source that renders
// on a customer surface. The pattern requires a template-style identifier
// inside the braces so JSX double-brace expressions (style={{ color: … }})
// don't false-positive: identifiers only, no spaces/colons.
//
// docs/ are exempt on purpose — the outreach packet templates keep their
// merge fields; this sweep covers what the site itself can render.
//
// SCREAMING_CASE only: JSX object shorthand (props={{ compact }}) is legal
// TSX and must not false-positive, and every real merge token in this repo
// ({{CALENDLY_LINK}}, {{FIRM_NAME}}, …) is uppercase.

const CUSTOMER_SOURCE_DIRS = [
  "app/(marketing)",
  "components",
  "lib/marketing",
  "lib/verticals",
] as const;

const PLACEHOLDER = /\{\{\s*[A-Z][A-Z0-9_]{2,}\s*\}\}/;
const SOURCE_EXT = /\.(ts|tsx|mdx?)$/;
// Comment lines can't render — and the booking module's own docs quote the
// {{CALENDLY_LINK}} token by name. Only code/JSX lines count.
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      yield* walk(p);
    } else if (SOURCE_EXT.test(name)) {
      yield p;
    }
  }
}

describe("no unresolved template placeholders on customer-rendered source", () => {
  it("finds zero {{TOKEN}} occurrences", () => {
    const root = process.cwd();
    const offenders: string[] = [];
    for (const dir of CUSTOMER_SOURCE_DIRS) {
      for (const file of walk(join(root, dir))) {
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          if (COMMENT_LINE.test(line)) return;
          if (PLACEHOLDER.test(line)) {
            offenders.push(`${relative(root, file)}:${i + 1} ${line.trim()}`);
          }
        });
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `unresolved template placeholder(s) in customer-rendered source:\n${offenders.join("\n")}`,
    );
  });
});
