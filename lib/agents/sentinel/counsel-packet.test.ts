/**
 * lib/agents/sentinel/counsel-packet.test.ts
 *
 * Pins the counsel-handoff packet builder. Every active vertical's
 * corpus must produce a packet with at least one literal trigger OR
 * one counsel-reference entry — counsel cannot red-line an empty
 * deliverable.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildCounselHandoffPacket } from "./counsel-packet";
import { loadCorpusFor, listCorpusVerticals } from "./index";

describe("counsel-handoff packet builder", () => {
  it("real-estate packet carries the HUD literal triggers + statutory anchor reference", () => {
    const corpus = loadCorpusFor("real-estate")!;
    const packet = buildCounselHandoffPacket(corpus);
    assert.equal(packet.verticalSlug, "real-estate");
    assert.equal(packet.status, "DRAFT");
    assert.equal(packet.counselReviewer, null);
    assert.ok(
      packet.literalTriggers.length >= 30,
      `real-estate literal-trigger count should be ≥ 30 after the HUD port; got ${packet.literalTriggers.length}`,
    );
    assert.ok(
      packet.counselReferences.length >= 1,
      "real-estate packet must include the 42 USC § 3604(c) statutory reference",
    );
    assert.ok(
      packet.openQuestions.length >= 1,
      "real-estate corpus must ship with counsel open questions",
    );
    // Every literal trigger carries a citation with URL + accessedAt.
    for (const t of packet.literalTriggers) {
      assert.ok(t.citation.source, `trigger ${t.phrase}: missing citation.source`);
      assert.ok(t.citation.url.startsWith("http"), `trigger ${t.phrase}: bad URL`);
      assert.match(t.citation.accessedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every active corpus produces a non-empty packet (no empty counsel deliverables)", () => {
    for (const slug of listCorpusVerticals()) {
      const corpus = loadCorpusFor(slug)!;
      const packet = buildCounselHandoffPacket(corpus);
      const total =
        packet.literalTriggers.length + packet.counselReferences.length;
      assert.ok(
        total > 0,
        `${slug}: counsel packet is empty — corpus must ship literal triggers OR counsel-reference rules`,
      );
    }
  });

  it("unverified literal-match rules with triggers land in candidateLiteralTriggers, not the live-firing bucket", () => {
    // Synthetic corpus with an unverified literal-match rule — even though
    // it has triggers, the unverified flag should keep it out of the
    // deterministic-match bucket. It DOES belong in candidate triggers so
    // counsel sees a phrase-by-phrase red-line target.
    const packet = buildCounselHandoffPacket({
      verticalSlug: "test",
      metadata: {
        verticalSlug: "test",
        lastReviewedAt: "2026-05-22",
        counselReviewer: null,
        status: "DRAFT",
        openQuestions: ["test"],
      },
      rules: [
        {
          ruleId: "test-unverified",
          title: "Unverified trigger candidate",
          summary: "phrase we have not confirmed yet",
          jurisdiction: "federal-regulation",
          scope: { kind: "federal" },
          citation: {
            source: "X",
            url: "https://example.com",
            accessedAt: "2026-05-22",
          },
          literalText: "[UNVERIFIED]",
          purpose: "literal-match",
          unverified: true,
          triggers: ["pending phrase"],
          drafterNotes: "drafted from X",
        },
      ],
    });
    assert.equal(packet.literalTriggers.length, 0);
    assert.equal(packet.candidateLiteralTriggers.length, 1);
    assert.equal(packet.counselReferences.length, 0);
    assert.equal(packet.candidateLiteralTriggers[0].ruleId, "test-unverified");
    assert.equal(packet.candidateLiteralTriggers[0].phrase, "pending phrase");
    assert.equal(packet.candidateLiteralTriggers[0].drafterNotes, "drafted from X");
  });

  it("every wave-4 in-scope vertical ships a candidate literal-trigger list for counsel review", () => {
    // Wave 4 (2026-05-25): each of the nine verticals below must surface
    // at least one candidate literal trigger so counsel has something
    // concrete to red-line. Sentinel does not fire on these (the scanner
    // skips unverified rules) — they exist for the counsel-handoff packet.
    //
    // `home-services` joined this list in the follow-on wave-4 PR
    // (2026-05-25) — the FTC § 5 + 16 CFR § 251.1 ("free") + Magnuson-Moss
    // § 2303 candidate triggers cover the advertising side of the
    // home-services corpus that the initial wave-4 PR deferred.
    const wave4InScope = [
      "cpa",
      "law",
      "ria",
      "insurance",
      "mortgage",
      "recruiting",
      "property-management",
      "title-escrow",
      "home-services",
    ];
    for (const slug of wave4InScope) {
      const corpus = loadCorpusFor(slug);
      assert.ok(corpus, `${slug}: corpus must be registered`);
      const packet = buildCounselHandoffPacket(corpus);
      assert.ok(
        packet.candidateLiteralTriggers.length > 0,
        `${slug}: candidate trigger list is empty — counsel-handoff packet needs concrete phrases to red-line`,
      );
      for (const t of packet.candidateLiteralTriggers) {
        assert.ok(t.citation.source, `${slug} candidate ${t.phrase}: missing citation.source`);
        assert.ok(
          t.citation.url.startsWith("http"),
          `${slug} candidate ${t.phrase}: bad citation URL`,
        );
        assert.match(t.citation.accessedAt, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("candidate triggers do NOT cause sentinel to flip the verticals live (status stays DRAFT)", () => {
    // Honesty guard: shipping candidate phrases must NOT silently flip a
    // corpus to COUNSEL_REVIEWED or attach a counselReviewer name.
    for (const slug of listCorpusVerticals()) {
      const corpus = loadCorpusFor(slug)!;
      const packet = buildCounselHandoffPacket(corpus);
      assert.equal(
        packet.status,
        "DRAFT",
        `${slug}: status must remain DRAFT until counsel signs off`,
      );
      assert.equal(
        packet.counselReviewer,
        null,
        `${slug}: counselReviewer must be null until counsel signs off`,
      );
    }
  });
});
