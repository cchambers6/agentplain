// The load-bearing product rule, enforced at the output boundary: the
// Integrator references curricula by unit/lesson identifiers and describes
// activity in the parent's terms — it NEVER reproduces curriculum content.
// The schema already caps freetext length; this gate catches the shapes a
// length cap misses (long verbatim quotes, page-of-text dumps, lists that
// read like reproduced lesson steps). A violation fails the run, and run.ts
// re-requests once with the violations appended before giving up.

const MAX_QUOTED_WORDS = 15; // > this inside quotes reads as reproduced text
const MAX_FIELD_WORDS = 80; // no plan field needs a paragraph

export interface GateViolation {
  path: string;
  reason: string;
}

function checkText(path: string, text: string, out: GateViolation[]): void {
  const words = text.trim().split(/\s+/).length;
  if (words > MAX_FIELD_WORDS) {
    out.push({
      path,
      reason: `field runs ${words} words — plan fields are identifiers and one-liners, not passages`,
    });
  }
  // Double/curly quotes only — apostrophes in possessives are normal prose.
  for (const m of text.matchAll(/["“]([^"“”]{20,})["”]/g)) {
    const quotedWords = m[1].trim().split(/\s+/).length;
    if (quotedWords > MAX_QUOTED_WORDS) {
      out.push({
        path,
        reason: `quoted span of ${quotedWords} words looks like reproduced source text`,
      });
    }
  }
  if (/\b(copyright|all rights reserved|reproduced from)\b/i.test(text)) {
    out.push({ path, reason: "text carries a copyright/reproduction marker" });
  }
}

/** Walk every string in the object and flag content-shaped violations. */
export function contentGate(value: unknown, path = "$"): GateViolation[] {
  const out: GateViolation[] = [];
  const walk = (v: unknown, p: string): void => {
    if (typeof v === "string") checkText(p, v, out);
    else if (Array.isArray(v)) v.forEach((item, i) => walk(item, `${p}[${i}]`));
    else if (v && typeof v === "object")
      Object.entries(v).forEach(([k, item]) => walk(item, `${p}.${k}`));
  };
  walk(value, path);
  return out;
}
