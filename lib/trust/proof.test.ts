import test from "node:test";
import assert from "node:assert/strict";

import {
  DESIGN_PARTNERS,
  TESTIMONIALS,
  PRESS_MENTIONS,
  CASE_STUDIES,
  OUTCOME_STATS,
  TRUST_EMPTY_COPY,
} from "./proof";

// The trust surfaces are the site's credibility layer, so their copy and data
// are held to a stricter bar than ordinary marketing strings:
//   1. Empty states report reality — no "coming soon", no "TBD", no hype.
//   2. Populated entries carry their admission evidence (permission, source).
// The voice-gate and brand-gate scan the rendered components too; this test
// exists so a registry edit fails fast in `npm test` before a gate run.

// Filler and dishonesty markers banned from every trust string. The broader
// LLM-ese catalog lives in tools/brand/voice-gate.mjs; these are the
// trust-specific additions (plus a few gate rules worth failing fast on).
const BANNED = [
  /coming soon/i,
  /\bTBD\b/,
  /\bplaceholder\b/i,
  /lorem/i,
  /stay tuned/i,
  /watch this space/i,
  /!/, // empty states carry no exclamation points (design language §3.5)
  /\bseamless\b/i,
  /\bleverage\b/i,
  /more than just/i,
  /\bSMB\b/,
];

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object")
    Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

test("trust empty-state copy is honest and filler-free", () => {
  const strings = collectStrings(TRUST_EMPTY_COPY);
  assert.ok(strings.length > 0, "empty-state copy exists");
  for (const s of strings) {
    assert.ok(s.trim().length > 0, "no blank copy strings");
    for (const pattern of BANNED) {
      assert.ok(
        !pattern.test(s),
        `banned pattern ${pattern} found in: ${JSON.stringify(s)}`,
      );
    }
  }
});

test("populated trust entries carry their admission evidence", () => {
  for (const p of DESIGN_PARTNERS) {
    assert.equal(p.permission, true, `partner ${p.name} lacks permission`);
    assert.ok(p.name.trim() && p.vertical.trim());
  }
  for (const t of TESTIMONIALS) {
    assert.equal(t.permission, true, `testimonial from ${t.name} lacks permission`);
    assert.ok(t.quote.trim() && t.name.trim() && t.company.trim());
  }
  for (const c of CASE_STUDIES) {
    assert.equal(c.permission, true, `case study ${c.company} lacks permission`);
    assert.ok(c.source.trim().length > 0, `case study ${c.company} lacks a source artifact`);
    assert.ok(c.outcome.trim() && c.href.trim());
  }
  for (const o of OUTCOME_STATS) {
    assert.ok(o.source.trim().length > 0, `outcome "${o.metric}" lacks a source artifact`);
    assert.ok(o.before.trim() && o.after.trim() && o.context.trim());
  }
  for (const m of PRESS_MENTIONS) {
    assert.ok(/^https?:\/\//.test(m.href), `press mention ${m.outlet} needs a public link`);
  }
});

test("trust registry strings are filler-free too", () => {
  const strings = collectStrings([
    DESIGN_PARTNERS,
    TESTIMONIALS,
    PRESS_MENTIONS,
    CASE_STUDIES,
    OUTCOME_STATS,
  ]);
  for (const s of strings) {
    for (const pattern of BANNED.filter((p) => p.source !== "!")) {
      assert.ok(
        !pattern.test(s),
        `banned pattern ${pattern} found in registry string: ${JSON.stringify(s)}`,
      );
    }
  }
});
