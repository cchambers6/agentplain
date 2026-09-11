import { test } from "node:test";
import assert from "node:assert/strict";
// The tsx runner compiles JSX with the CLASSIC factory and does not honour
// `"jsx": "react-jsx"` from tests/tsconfig.test.json, so `React` has to be a
// VALUE in scope. Without this line the module throws
// `ReferenceError: React is not defined` before a single assertion runs.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ApprovalCard,
  type ApprovalRow,
} from "@/app/(product)/app/workspace/[id]/approvals/ApprovalCard";
import {
  buildApprovalArtifact,
  type ApprovalArtifact,
} from "@/lib/approvals/artifact";
import {
  ARTIFACT_PAYLOAD_KEY,
  ARTIFACT_SCHEMA_VERSION,
  readStoredApprovalArtifact,
} from "@/lib/approvals/stored-artifact";
import { ACCEPTED_APPROVAL_STATUSES } from "@/lib/approvals/accepted-status";
import type { RenderedApproval } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";

/**
 * tests/approval-handoff-gating.test.tsx
 *
 * The consumer path for the stored approval artifact, and the acceptance gate
 * in front of it.
 *
 * WHAT THIS EXISTS TO CATCH
 * -------------------------
 * PR #538 built `executors/artifact-handoff.ts`, which freezes an artifact
 * onto the approval row's payload under `plainoApprovalArtifact` at approval
 * time. Nothing read it back: a `git grep` for the key returned seven hits,
 * three in the writer and four in tests, and ZERO in `app/` or `scripts/`.
 * Meanwhile `ApprovalCard.tsx` rendered `<ApprovalHandoff>` UNCONDITIONALLY
 * from an artifact RE-DERIVED at render time. Two defects fell out of that:
 *
 *   1. approval was not a precondition for delivery — the copy / .txt /
 *      mailto controls sat on PENDING rows, so a customer could carry a draft
 *      out of agentplain before approving it; and
 *   2. the stored artifact's whole stated purpose was defeated, since
 *      artifact-handoff.ts:34-37 argues it must be frozen because "a
 *      re-derivation at read time would quietly change the customer's record
 *      underneath them" — and the card performed exactly that re-derivation.
 *
 * Every check below reports `examined N of M` and FAILS AT N = 0. This repo
 * has been bitten repeatedly by assertions that pass green over an empty
 * input set, making "found nothing" and "examined nothing" indistinguishable.
 */

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

/** The marker ApprovalHandoff puts on its container (`data-approval-handoff`).
 *  Asserted on the ATTRIBUTE rather than on button copy: the labels are
 *  customer prose and will be rewritten; the hook is structural. */
const HANDOFF_MARKER = /data-approval-handoff/;

const RENDERED: RenderedApproval = {
  kindLabel: "Reply draft",
  title: "142 Peachtree Ave",
  recipientLine: "To: jane@buyer.com",
  body: ["Hi Jane — yes, 142 Peachtree is still on the market."],
  editableBody: "Hi Jane — yes, 142 Peachtree is still on the market.",
  recipients: ["jane@buyer.com"],
};

function row(over: Partial<ApprovalRow> = {}): ApprovalRow {
  return {
    id: over.id ?? "appr_gate_1",
    agentSlug: over.agentSlug ?? "buyer-inquiry-router",
    kind: over.kind ?? "BUYER_INQUIRY_REPLY_DRAFT",
    discipline: over.discipline ?? null,
    proposedAtIso: over.proposedAtIso ?? "2026-06-05T13:00:00.000Z",
    status: over.status ?? "PENDING",
    storedArtifact: over.storedArtifact,
    rendered: over.rendered ?? RENDERED,
  };
}

/** Every status the enum carries that is NOT accepted. Kept as a literal list
 *  so a new non-accepted status is a deliberate edit here rather than a silent
 *  hole; `prisma/schema.prisma` enum WorkApprovalStatus is the producer. */
const UNACCEPTED_STATUSES = ["PENDING", "REJECTED", "EXPIRED"] as const;

// ── Probe 1 ───────────────────────────────────────────────────────────────
// A row carrying a stored artifact renders the STORED one, not a re-derivation.

test("an accepted row renders the STORED artifact, not a re-derivation", () => {
  const derived = buildApprovalArtifact("BUYER_INQUIRY_REPLY_DRAFT", RENDERED);

  // Mutate the stored copy so the two are DISTINGUISHABLE. This stands in for
  // the real divergence case: the payload was edited after approval, so a
  // re-derivation would silently show the customer something other than what
  // they said yes to.
  const FROZEN_SENTENCE =
    "Hi Jane — yes, 142 Peachtree is still on the market. FROZEN AT APPROVAL.";
  const stored: ApprovalArtifact = {
    ...derived,
    blocks: [FROZEN_SENTENCE],
  };

  // The probe is only meaningful if the two artifacts actually differ.
  assert.ok(
    !derived.blocks.includes(FROZEN_SENTENCE),
    "fixture is broken: the re-derived artifact already contains the frozen sentence, " +
      "so this test could not tell the two apart",
  );

  const html = render(<ApprovalCard row={row({ status: "APPROVED", storedArtifact: stored })} />);

  assert.match(html, HANDOFF_MARKER, "an accepted row must render the handoff");
  assert.ok(
    html.includes(FROZEN_SENTENCE),
    "the card rendered an artifact that does NOT contain the stored sentence — it " +
      "re-derived at read time instead of reading the frozen copy",
  );

  // And the derived-only text must be absent from the handoff payload. The
  // off-screen <textarea> carries the exact artifact text the customer copies,
  // so this is the real consumer surface, not a proxy for it.
  const textarea = /data-artifact-text[^>]*>([\s\S]*?)<\/textarea>/.exec(html);
  assert.ok(textarea, "no artifact <textarea> in the markup — the handoff did not render");
  assert.ok(
    textarea[1].includes("FROZEN AT APPROVAL"),
    "the copyable artifact text was re-derived, not read from the row",
  );
});

test("a row with NO stored artifact falls back to the re-derived one", () => {
  // The deliberate fallback: rows approved before the executor shipped, and
  // rows whose executor failed (dispatch.ts records that and keeps going,
  // because the artifact is a pure function and always recomputable).
  const html = render(
    <ApprovalCard row={row({ status: "APPROVED", storedArtifact: null })} />,
  );
  assert.match(html, HANDOFF_MARKER, "the fallback must still deliver a handoff");
  assert.ok(
    html.includes("142 Peachtree is still on the market"),
    "the fallback artifact carried none of the row's work product",
  );
});

// ── Probe 2 ───────────────────────────────────────────────────────────────
// An unapproved row renders NO handoff controls.

test("examined N of M: no un-accepted status renders handoff controls", () => {
  let examined = 0;
  for (const status of UNACCEPTED_STATUSES) {
    const html = render(<ApprovalCard row={row({ status })} />);
    examined += 1;
    assert.doesNotMatch(
      html,
      HANDOFF_MARKER,
      `a ${status} row rendered the handoff — approval is not gating delivery`,
    );
    // The artifact text must not be reachable either. A hidden <textarea>
    // carrying the full draft is a handoff whether or not a button sits over
    // it: "select all, copy" is one gesture away.
    assert.doesNotMatch(
      html,
      /data-artifact-text/,
      `a ${status} row still exposed the artifact text in its markup`,
    );
  }
  assert.ok(examined > 0, "examined 0 statuses — the input set was empty");
  assert.equal(
    examined,
    UNACCEPTED_STATUSES.length,
    `examined ${examined} of ${UNACCEPTED_STATUSES.length} un-accepted statuses`,
  );
});

test("PENDING specifically: the card still renders, it just does not deliver", () => {
  const html = render(<ApprovalCard row={row({ status: "PENDING" })} />);
  // The gate must not blank the card — the customer still reads the draft.
  assert.ok(
    html.includes("142 Peachtree is still on the market"),
    "gating the handoff also removed the draft body — that is not the change",
  );
  assert.doesNotMatch(html, HANDOFF_MARKER);
});

// ── Probe 3 ───────────────────────────────────────────────────────────────
// AUTO_APPROVED delivers. This is the case a literal `=== "APPROVED"` breaks.

test("examined N of M: every accepted status renders handoff controls", () => {
  let examined = 0;
  for (const status of ACCEPTED_APPROVAL_STATUSES) {
    const html = render(<ApprovalCard row={row({ status })} />);
    examined += 1;
    assert.match(
      html,
      HANDOFF_MARKER,
      `a ${status} row rendered NO handoff. If this fails only for ` +
        "AUTO_APPROVED, the gate was re-derived as `status === \"APPROVED\"` — " +
        "use isAcceptedStatus (lib/approvals/accepted-status.ts).",
    );
  }
  assert.ok(examined > 0, "examined 0 accepted statuses — the input set was empty");
  assert.equal(
    examined,
    ACCEPTED_APPROVAL_STATUSES.length,
    `examined ${examined} of ${ACCEPTED_APPROVAL_STATUSES.length} accepted statuses`,
  );
  // Guards the tuple itself: a one-element ACCEPTED_APPROVAL_STATUSES would
  // make the loop above pass while covering only APPROVED.
  assert.ok(
    ACCEPTED_APPROVAL_STATUSES.includes("AUTO_APPROVED"),
    "AUTO_APPROVED dropped out of the accepted class — the threshold path " +
      "would stop delivering and nothing else here would notice",
  );
});

// ── The reader, directly ──────────────────────────────────────────────────
// readStoredApprovalArtifact is what lifts the frozen copy off the decrypted
// payload. It takes untrusted shape and must degrade to null, never throw.

test("examined N of M: every malformed stored payload degrades to null", () => {
  const good = buildApprovalArtifact("BUYER_INQUIRY_REPLY_DRAFT", RENDERED);
  const wrap = (artifact: unknown, v: unknown = ARTIFACT_SCHEMA_VERSION) => ({
    [ARTIFACT_PAYLOAD_KEY]: { v, fingerprint: "abc", artifact },
  });

  const BAD: Array<[string, unknown]> = [
    ["null payload", null],
    ["non-object payload", "a string"],
    ["array payload", [1, 2, 3]],
    ["payload without the reserved key", { somethingElse: 1 }],
    ["reserved key holding a non-object", { [ARTIFACT_PAYLOAD_KEY]: "nope" }],
    ["unknown schema version", wrap(good, 99)],
    ["artifact is not an object", wrap("nope")],
    ["missing kind", wrap({ ...good, kind: undefined })],
    ["empty kind", wrap({ ...good, kind: "" })],
    ["missing filename", wrap({ ...good, filename: undefined })],
    ["blocks not an array", wrap({ ...good, blocks: "text" })],
    ["blocks empty", wrap({ ...good, blocks: [] })],
    ["blocks holding a non-string", wrap({ ...good, blocks: ["ok", 7] })],
    ["provenanceBlocks not an array", wrap({ ...good, provenanceBlocks: null })],
    ["refs not an array", wrap({ ...good, refs: {} })],
    ["ref without a label", wrap({ ...good, refs: [{ href: "https://x.test" }] })],
    ["modes empty", wrap({ ...good, modes: [] })],
    ["modes carrying an unknown mode", wrap({ ...good, modes: ["copy", "telepathy"] })],
    ["subject of the wrong type", wrap({ ...good, subject: 42 })],
  ];

  let examined = 0;
  for (const [label, payload] of BAD) {
    examined += 1;
    assert.equal(
      readStoredApprovalArtifact(payload),
      null,
      `${label} should have degraded to null (the caller then re-derives)`,
    );
  }
  assert.ok(examined > 0, "examined 0 malformed payloads — the table was empty");
  assert.equal(examined, BAD.length, `examined ${examined} of ${BAD.length} malformed payloads`);

  // Known-positive control. A reader that returns null for EVERYTHING would
  // pass every assertion above, which is exactly the instrument failure this
  // repo keeps recording: validate against a positive before trusting a
  // negative.
  const ok = readStoredApprovalArtifact(wrap(good));
  assert.ok(ok, "the reader rejected a well-formed artifact — it rejects everything");
  assert.deepEqual(ok.blocks, good.blocks);
  assert.equal(ok.filename, good.filename);
});

test("the writer and the reader agree on the payload key", () => {
  // One definition, two importers. If these ever diverge the reader finds
  // nothing, falls back forever, and looks exactly like "no row has an
  // artifact yet" — a silent, permanent no-op.
  assert.equal(ARTIFACT_PAYLOAD_KEY, "plainoApprovalArtifact");
  assert.equal(ARTIFACT_SCHEMA_VERSION, 1);
});
