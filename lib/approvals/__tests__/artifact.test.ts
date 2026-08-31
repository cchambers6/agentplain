/**
 * lib/approvals/__tests__/artifact.test.ts
 *
 * The customer approves a draft; this proves they can actually LEAVE with it.
 *
 * The enum is read programmatically off the Prisma-generated client. A
 * hand-written array of kinds silently goes stale the day someone adds an
 * enum value — that is the exact defect class this repo already carries 38
 * quarantine entries for, and it is not worth repeating here. Adding a
 * WorkApprovalKind without a fixture below fails this test loudly.
 *
 * "Non-empty blocks" on its own is a weak assertion: renderApprovalPayload
 * emits calm fallback lines ("No body attached.", "No calendar entries
 * attached.") whenever a payload came up empty, and an artifact built from
 * those is an empty artifact with a green checkmark on it. So every fixture
 * carries `expect` strings that MUST survive into the derived text — that is
 * what proves the artifact carries the payload's real content.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { WorkApprovalKind } from "@prisma/client";
import { renderApprovalPayload } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";
import {
  ARTIFACT_EMPTY_NOTICE,
  CLOSED_LOOP_KINDS,
  RENDERER_FALLBACK_BLOCKS,
  artifactBodyBlocks,
  artifactMailtoHref,
  buildApprovalArtifact,
  isCardChromeBlock,
  isRendererFallbackBlock,
  renderArtifactText,
} from "@/lib/approvals/artifact";

/** The producer. Read as SOURCE by the fallback guard below, so that the
 *  strings this module claims to strip are checked against the module that
 *  actually emits them rather than against a copy of themselves. */
const RENDERER_SOURCE_PATH = path.join(
  process.cwd(),
  "app",
  "(product)",
  "app",
  "workspace",
  "[id]",
  "approvals",
  "renderApprovalPayload.ts",
);

/** Model vendor stays invisible on every customer surface. Standing
 *  product constraint — the artifact is a customer surface. */
const VENDOR_RE = /claude|anthropic|openai|chatgpt|gpt-[0-9]/i;

interface Fixture {
  payload: Record<string, unknown>;
  /** Substrings that MUST appear in renderArtifactText output. Each one is
   *  real content from the payload (or, for the fixed-copy consent card, the
   *  substantive terms the customer is agreeing to). */
  expect: string[];
}

const FIXTURES: Record<string, Fixture> = {
  COMPLIANCE_FLAG: {
    payload: {
      rule: "NAR Article 12",
      summary:
        "The public remarks promise guaranteed appreciation, which is a forward-looking claim we cannot stand behind.",
      source: "Listing 142 Peachtree Ave — public remarks",
    },
    expect: ["NAR Article 12", "guaranteed appreciation", "142 Peachtree Ave"],
  },
  LISTING_RECOMMENDATION: {
    payload: {
      address: "142 Peachtree Ave",
      summary: "Move the twilight exterior to the hero slot.",
      rationale:
        "The kitchen shot is currently first and it is the weakest frame in the set.",
      confidence: 0.86,
    },
    expect: ["142 Peachtree Ave", "twilight exterior", "weakest frame"],
  },
  BUYER_INQUIRY_REPLY_DRAFT: {
    payload: {
      to: "jane@buyer.example.com",
      subject: "142 Peachtree Ave — still available?",
      draft:
        "Hi Jane — 142 Peachtree is still on the market.\n\nI have Thursday afternoon open if you would like to walk it.",
      confidence: 0.91,
      tone: "warm-direct",
      inboundSummary: "Jane asked whether the Peachtree listing is still available.",
      persisted: false,
    },
    expect: ["jane@buyer.example.com", "still on the market", "Thursday afternoon"],
  },
  PRICING_RECOMMENDATION: {
    payload: {
      address: "142 Peachtree Ave",
      current: "$489,000",
      proposed: "$472,500",
      rationale:
        "Three comparable homes within a half mile closed under $475,000 this month.",
      confidence: 0.74,
    },
    expect: ["$489,000", "$472,500", "half mile"],
  },
  ADMIN_VERIFICATION_CODE: {
    payload: {
      title: "Sign-in code from Buildium",
      subject: "Your Buildium verification code",
      fromDisplay: "Buildium <no-reply@buildium.example.com>",
      category: "verification-code",
      priority: "critical",
      confidence: 0.97,
      signals: { verificationCode: "481920", serviceName: "Buildium" },
      body: ["Buildium sent a one-time sign-in code for your property account."],
    },
    expect: ["481920", "Buildium", "one-time sign-in code"],
  },
  ADMIN_PASSWORD_RESET: {
    payload: {
      title: "Password reset requested",
      subject: "Reset your Follow Up Boss password",
      fromDisplay: "Follow Up Boss <no-reply@fub.example.com>",
      category: "password-reset",
      priority: "normal",
      confidence: 0.93,
      signals: { primaryUrl: "https://fub.example.com/reset/abc123" },
      body: ["A password reset was requested for your Follow Up Boss account."],
    },
    expect: ["https://fub.example.com/reset/abc123", "password reset was requested"],
  },
  ADMIN_TRIAL_ENDING: {
    payload: {
      title: "Canva trial ends Friday",
      subject: "Your Canva trial ends in 3 days",
      fromDisplay: "Canva <billing@canva.example.com>",
      category: "trial-expiration",
      priority: "normal",
      confidence: 0.88,
      signals: {
        expiresAt: "2026-09-04T00:00:00.000Z",
        serviceName: "Canva",
        amount: "$14.99/mo",
      },
      body: ["The Canva trial converts to a paid plan unless it is cancelled first."],
    },
    expect: ["$14.99/mo", "converts to a paid plan", "2026-09-04"],
  },
  ADMIN_BILLING_NOTICE: {
    payload: {
      title: "Stripe invoice paid",
      subject: "Your Stripe invoice for August",
      fromDisplay: "Stripe <invoices@stripe.example.com>",
      category: "billing-notice",
      priority: "normal",
      confidence: 0.9,
      signals: { amount: "$248.00", serviceName: "Stripe" },
      body: ["The August invoice cleared against the card ending 4242."],
      draftBody: "Thanks — received and filed against August operating costs.",
    },
    expect: ["$248.00", "card ending 4242"],
  },
  ADMIN_SECURITY_ALERT: {
    payload: {
      title: "New sign-in from Dallas",
      subject: "New sign-in to your account",
      fromDisplay: "Accounts <no-reply@accounts.example.com>",
      category: "account-suspension",
      priority: "critical",
      confidence: 0.95,
      body: ["A new sign-in was recorded from Dallas, TX on a Windows device."],
    },
    expect: ["Dallas, TX", "Windows device"],
  },
  CHIEF_OF_STAFF_MEETING: {
    payload: {
      subject: "Quarterly pipeline review",
      inviteBody:
        "Blocking thirty minutes to walk the Q4 pipeline before the board packet is due.",
      attendees: [{ email: "dana@partner.example.com" }],
      candidateSlots: [
        { day: "tuesday", startLocal: "10:30", endLocal: "11:00" },
        { day: "thursday", startLocal: "14:00", endLocal: "14:30" },
      ],
      confidence: 0.82,
      reasoning: "Dana asked for time before the board packet deadline.",
    },
    expect: [
      "dana@partner.example.com",
      "Q4 pipeline",
      "Tuesday 10:30",
      "board packet deadline",
    ],
  },
  CHIEF_OF_STAFF_REPLY_DRAFT: {
    payload: {
      subject: "Re: vendor contract renewal",
      body: "We are good to renew at the current terms. I will send the countersigned copy Monday.",
      toEmails: ["ops@vendor.example.com"],
      tone: "warm-direct",
      confidence: 0.87,
      reasoning: "The vendor asked for a renewal decision by end of week.",
    },
    // Every `expect` string here is WORK PRODUCT. It deliberately no longer
    // names "end of week", which lives only in `reasoning`: an expectation
    // satisfied by Plaino's internal rationale proves the artifact carried
    // the fleet's notes, not the customer's letter.
    expect: [
      "ops@vendor.example.com",
      "good to renew at the current terms",
      "countersigned copy Monday",
    ],
  },
  CHIEF_OF_STAFF_TODO: {
    payload: {
      title: "Send the countersigned vendor contract",
      contextText: "Vendor is holding the current pricing until the signed copy lands.",
      suggestedDueLocal: "Monday 9:00am",
      confidence: 0.79,
      reasoning: "Named as a commitment in the thread with the vendor.",
    },
    expect: [
      "countersigned vendor contract",
      "holding the current pricing",
      "Monday 9:00am",
    ],
  },
  INBOX_TRIAGE: {
    payload: {
      priority: "customer-active",
      reasoning:
        "An active client asking about a closing date is customer-active, not noise.",
      confidence: 0.84,
      ackDraft: {
        subject: "Re: closing timeline",
        body: "Got it — I am confirming the closing date with the title company today.",
        toEmails: ["client@example.com"],
        tone: "warm-direct",
      },
    },
    expect: ["client@example.com", "title company today", "customer-active"],
  },
  FOLLOW_UP_NUDGE: {
    payload: {
      subject: "Re: proposal for the Riverside build",
      body: "Circling back on the Riverside proposal — happy to adjust scope if the number is the sticking point.",
      toEmails: ["sam@riverside.example.com"],
      stage: "second",
      ageDays: 9,
      confidence: 0.81,
      reasoning: "Nine days with no reply after a proposal is the point to nudge.",
    },
    expect: ["sam@riverside.example.com", "Riverside proposal", "sticking point"],
  },
  PROCESS_DOC_DRAFT: {
    payload: {
      title: "New client intake SOP",
      body: "1. Log the inquiry in the CRM within one business hour.\n\n2. Send the intake packet and calendar link.",
      occurrenceCount: 14,
      confidence: 0.77,
      reasoning: "This sequence repeated fourteen times over the last quarter.",
    },
    expect: ["New client intake SOP", "one business hour", "intake packet"],
  },
  SUPPORT_HANDLER_REPLY_DRAFT: {
    payload: {
      subject: "Cannot export the owner statement",
      body: "Thanks for flagging this — owner statements export from Reports, not the Owners tab. Here is the path.",
      confidence: "high",
      suggestedAction: "send",
      reasoning: "The help centre covers this exact export path.",
      citations: [
        { title: "Owner statements — export path", similarity: 0.91 },
        { title: "Reports tab overview", similarity: 0.78 },
      ],
    },
    expect: [
      "owner statements export from Reports",
      "Owner statements — export path",
      "Reports tab overview",
    ],
  },
  PLAINO_INSTRUCTION: {
    payload: {
      status: "drafted",
      targetDiscipline: "marketing",
      instructionText: "Write the open-house announcement for 142 Peachtree.",
      draftBody: "Open house at 142 Peachtree Ave this Sunday, one to three.",
      draftReasoning: "Kept it to the address, the day, and the window.",
      honoredRules: [{ scope: "workspace", rule: "Never use exclamation points." }],
    },
    expect: [
      "Write the open-house announcement",
      "142 Peachtree Ave this Sunday",
      "Never use exclamation points.",
    ],
  },
  LEAD_TRIAGE: {
    payload: {
      leadName: "Marcus Webb",
      category: "ready-now",
      firstTouchDraft: {
        subject: "Touring this weekend?",
        body: "Marcus — I have two homes in your range that just came on. Free Saturday morning?",
        confidence: 0.88,
      },
      routing: {
        type: "call-now",
        rationale:
          "Pre-approved with a thirty-day timeline — this one wants a phone call.",
      },
      scores: { motivation: 0.9, timeline: 0.85, preapproval: 1 },
    },
    expect: ["Marcus Webb", "Free Saturday morning", "thirty-day timeline"],
  },
  ANALYTICS_PULSE: {
    payload: {
      body: "Twenty-two drafts went out this week and nineteen were approved without an edit.",
      forWeekStarting: "2026-08-24",
      recommendations: ["Raise the auto-persist threshold for reply drafts."],
      counts: { approvalsCreated: 22 },
    },
    expect: ["nineteen were approved", "Raise the auto-persist threshold", "2026-08-24"],
  },
  RESEARCH_BRIEF: {
    payload: {
      summary: "Three of the four competitors now bundle e-signature at no extra cost.",
      keyFindings: ["Only one competitor still charges per envelope."],
      gaps: ["No pricing found for the enterprise tier."],
      citations: [{ title: "Competitor pricing page — August 2026" }],
    },
    expect: [
      "bundle e-signature",
      "charges per envelope",
      "No pricing found for the enterprise tier",
    ],
  },
  CONTENT_CALENDAR: {
    payload: {
      preamble: "Four posts this week, weighted toward the listing that has gone quiet.",
      forWeekStarting: "2026-08-31",
      verticalSlug: "real-estate",
      days: [
        {
          date: "2026-08-31",
          channel: "instagram",
          topic: "142 Peachtree twilight shots",
          hook: "The light at seven is the whole argument.",
        },
      ],
    },
    expect: ["Four posts this week", "142 Peachtree twilight shots", "whole argument"],
  },
  COMPLIANCE_DIGEST: {
    payload: {
      body: "Two drafts tripped a rule this week; both have a suggested rewrite attached.",
      forDate: "2026-08-29",
      approvalsScanned: 41,
      matches: [
        {
          ruleSeverity: "high",
          ruleLabel: "Fair-housing — familial status",
          approvalKind: "BUYER_INQUIRY_REPLY_DRAFT",
          excerpt: "perfect for a young family",
          suggestedReplacement: "well suited to the neighbourhood",
          rewriteSource: "learned",
          rewriteCitation: "counsel redline #7",
        },
      ],
    },
    expect: [
      "Two drafts tripped a rule",
      "Fair-housing — familial status",
      "well suited to the neighbourhood",
    ],
  },
  FINANCE_PULSE: {
    payload: {
      body: "Receivables are down to eleven thousand outstanding, the lowest since June.",
      forWeekStarting: "2026-08-24",
      recommendations: ["Chase the two invoices past sixty days."],
      internal: { invoiceChaseDrafts: 4, monthEndCloseDrafts: 1 },
      quickbooks: { connected: true, summary: { openInvoices: 9, overdueInvoices: 2 } },
      llmComposed: true,
    },
    expect: ["eleven thousand outstanding", "past sixty days", "2026-08-24"],
  },
  ACTIVATION_DRAFT: {
    payload: {
      subject: "Welcome — next steps on your search",
      body: "Thanks for reaching out. Here are three homes that fit what you described.",
      recordTitle: "Demo lead: Priya Raman",
      partyName: "Priya Raman",
      toEmails: ["priya@example.com"],
      savedMinutes: 12,
    },
    expect: ["priya@example.com", "three homes that fit", "Priya Raman"],
  },
  DOCUSIGN_SEND_ENVELOPE: {
    payload: {
      emailSubject: "Listing agreement — 142 Peachtree Ave",
      source: "template",
      templateId: "tpl_listing_agreement_v4",
      recipientEmails: ["seller@example.com"],
      documentNames: ["Listing agreement.pdf"],
    },
    // A closed-loop artifact is a record of the ACTION. It names the
    // envelope, the template and the signer — never the card's "Nothing has
    // been sent" promise, which is false the moment this is copyable.
    expect: [
      "Listing agreement — 142 Peachtree Ave",
      "tpl_listing_agreement_v4",
      "seller@example.com",
      "DocuSign — send for signature",
    ],
  },
  DOCUSIGN_VOID_ENVELOPE: {
    payload: {
      envelopeId: "env_9f3a2c",
      voidedReason: "The seller changed the commission split before signing.",
    },
    expect: [
      "env_9f3a2c",
      "changed the commission split",
      "DocuSign — void envelope",
    ],
  },
  CONNECTOR_WRITE_ACTION: {
    payload: {
      connector: "follow-up-boss",
      action: "create-note",
      detail: { personId: "fub_44812", note: "Toured 142 Peachtree on Saturday." },
    },
    expect: ["Follow Up Boss", "fub_44812", "Toured 142 Peachtree on Saturday."],
  },
  VOICE_CALL_ACTION_ITEM: {
    payload: {
      title: "Call back the Riverside caller",
      summary: "A caller asked whether the Riverside unit allows a large dog.",
      priority: "high",
      intent: "leasing-question",
      sentiment: "neutral",
      callbackNumber: "+1-405-555-0142",
      suggestedNextSteps: ["Confirm the pet policy weight limit before calling back."],
    },
    expect: [
      "Riverside unit allows a large dog",
      "Confirm the pet policy weight limit",
      "Call back the Riverside caller",
    ],
  },
  VOICE_RECORDING_CONSENT: {
    payload: { retentionDays: 45, requireTwoPartyConsentPrompt: true },
    // The retention window and the disclosure rule ARE the terms being
    // consented to, so they must survive. "Recording stays off until you
    // approve it here." is NOT in this list and must not be: it is a promise
    // about the card's pending state, and the artifact only exists after the
    // owner approved. See the dedicated regression test below — this fixture
    // used to assert that sentence was present, which locked the defect in.
    expect: [
      "Approving this turns on call recording for your workspace.",
      "kept for 45 days",
      "two-party-consent states",
    ],
  },
  PORTAL_CLIENT_MESSAGE: {
    payload: {
      toClientEmail: "client@acme.example.com",
      body: "Your quarterly statement is posted in the portal — happy to walk it line by line.",
    },
    expect: ["client@acme.example.com", "walk it line by line"],
  },
};

/** The enum, read off the generated Prisma client — never hand-listed. */
const ALL_KINDS = Object.keys(WorkApprovalKind) as Array<
  keyof typeof WorkApprovalKind
>;

test("every WorkApprovalKind in the generated enum has a fixture", () => {
  assert.ok(ALL_KINDS.length > 0, "Prisma did not export WorkApprovalKind");
  const missing = ALL_KINDS.filter((k) => !FIXTURES[k]);
  assert.deepEqual(
    missing,
    [],
    `A WorkApprovalKind was added without an artifact fixture: ${missing.join(", ")}`,
  );
  const stale = Object.keys(FIXTURES).filter(
    (k) => !(ALL_KINDS as string[]).includes(k),
  );
  assert.deepEqual(
    stale,
    [],
    `Fixture for a kind that no longer exists: ${stale.join(", ")}`,
  );
});

for (const kind of ALL_KINDS) {
  test(`artifact for ${kind}: real content, a filename, and at least one handoff mode`, () => {
    const fixture = FIXTURES[kind];
    assert.ok(fixture, `no fixture for ${kind}`);

    const rendered = renderApprovalPayload(WorkApprovalKind[kind], fixture.payload);
    const artifact = buildApprovalArtifact(WorkApprovalKind[kind], rendered);
    const text = renderArtifactText(artifact);

    // 1. Non-empty blocks.
    assert.ok(artifact.blocks.length > 0, `${kind}: artifact has no blocks`);

    // 2. No block is merely a renderer fallback placeholder. A green test
    //    over "No body attached." is a green test over an empty artifact.
    for (const block of artifact.blocks) {
      assert.equal(
        isRendererFallbackBlock(block),
        false,
        `${kind}: block is a renderer fallback placeholder: ${JSON.stringify(block)}`,
      );
      assert.ok(block.trim().length > 0, `${kind}: empty block`);
    }

    // 3. The payload's real content survived into the derived text. This is
    //    the assertion that "non-empty" alone cannot make.
    for (const needle of fixture.expect) {
      assert.ok(
        text.includes(needle),
        `${kind}: artifact text lost payload content ${JSON.stringify(needle)}\n---\n${text}`,
      );
    }

    // 4. Filename + modes.
    assert.ok(artifact.filename.length > 0, `${kind}: empty filename`);
    assert.match(artifact.filename, /^plaino-[a-z0-9-]+\.txt$/, `${kind}: bad filename`);
    assert.ok(artifact.modes.length >= 1, `${kind}: no handoff mode`);
    assert.ok(artifact.modes.includes("copy"), `${kind}: copy is always available`);

    // 5. Model vendor is invisible on customer surfaces.
    assert.doesNotMatch(text, VENDOR_RE, `${kind}: artifact text names a model vendor`);

    // 6. Text is DERIVED from the structure, not the other way round.
    for (const block of artifact.blocks) {
      assert.ok(text.includes(block), `${kind}: block missing from derived text`);
    }
  });
}

test("the five closed-loop kinds get copy only — no competing handoff", () => {
  for (const kind of ALL_KINDS) {
    const rendered = renderApprovalPayload(
      WorkApprovalKind[kind],
      FIXTURES[kind]!.payload,
    );
    const artifact = buildApprovalArtifact(WorkApprovalKind[kind], rendered);
    if (CLOSED_LOOP_KINDS.has(kind)) {
      assert.deepEqual(artifact.modes, ["copy"], `${kind} redeems on approval`);
      assert.equal(artifactMailtoHref(artifact), null, `${kind} must not offer mailto`);
    } else {
      assert.ok(artifact.modes.includes("download"), `${kind} needs a download`);
    }
  }
  // DocuSign send carries a real address and is still copy-only — the mode
  // rule is about redemption, not about whether an address exists.
  assert.equal(CLOSED_LOOP_KINDS.size, 5);
});

test("mailto is offered only when a real address was parsed", () => {
  const withAddress = buildApprovalArtifact(
    WorkApprovalKind.BUYER_INQUIRY_REPLY_DRAFT,
    renderApprovalPayload(
      WorkApprovalKind.BUYER_INQUIRY_REPLY_DRAFT,
      FIXTURES.BUYER_INQUIRY_REPLY_DRAFT!.payload,
    ),
  );
  assert.ok(withAddress.modes.includes("mailto"));
  assert.equal(withAddress.recipient, "jane@buyer.example.com");
  const href = artifactMailtoHref(withAddress);
  assert.ok(href?.startsWith("mailto:jane%40buyer.example.com?"));

  const noAddress = buildApprovalArtifact(
    WorkApprovalKind.PROCESS_DOC_DRAFT,
    renderApprovalPayload(
      WorkApprovalKind.PROCESS_DOC_DRAFT,
      FIXTURES.PROCESS_DOC_DRAFT!.payload,
    ),
  );
  assert.equal(noAddress.recipient, undefined);
  assert.equal(noAddress.modes.includes("mailto"), false);
  assert.equal(artifactMailtoHref(noAddress), null);
});

// ── The recipient line is never parsed ───────────────────────────────────
//
// `extractRecipients` used to sit here as a "legacy" fallback. It is gone —
// see the note in lib/approvals/artifact.ts. These two tests are what make
// the absence loud rather than merely quiet: a rendered approval that shows
// an addressee but does not STATE it discretely gets no recipient at all,
// and no mailto. Failing closed is the point; a 31st kind whose author
// forgets `recipients` loses a feature visibly instead of silently
// re-opening the subject-line injection the field was added to close.

test("a rendered approval that states no recipients gets none — the line is never parsed", () => {
  const rendered = {
    kindLabel: "Buyer inquiry reply",
    title: "142 Peachtree Ave",
    // Shows an addressee AND carries a stranger's address in the subject —
    // exactly the shape the deleted parser used to mine.
    recipientLine:
      "To: jane@buyer.example.com    Re: please cc mallory@evil.example.com",
    body: ["Hi Jane — 142 Peachtree is still on the market."],
  } as unknown as Parameters<typeof buildApprovalArtifact>[1];

  const artifact = buildApprovalArtifact(
    WorkApprovalKind.BUYER_INQUIRY_REPLY_DRAFT,
    rendered,
  );

  assert.equal(
    artifact.recipient,
    undefined,
    "an address was mined out of the display line — the parse path is back",
  );
  assert.equal(artifact.modes.includes("mailto"), false, "mailto without an address");
  assert.equal(artifactMailtoHref(artifact), null);
  // There is no To: line at all — not the real addressee, not the stranger.
  const text = renderArtifactText(artifact);
  assert.doesNotMatch(text, /^To: /m);
  assert.doesNotMatch(text, /^To:.*jane@buyer/m);
  // The stranger's address appears ONLY in the quoted subject, which is the
  // one place it is allowed: quoting their words back is correct, addressing
  // them is not. It must never appear anywhere else in the artifact.
  assert.match(text, /^Subject: please cc mallory@evil\.example\.com$/m);
  assert.equal(
    text.split("\n").filter((l) => l.includes("evil.example.com")).length,
    1,
    "the stranger's address escaped the subject line",
  );
  // The work product itself is untouched.
  assert.match(text, /still on the market/);
});

test("every kind that shows an addressee states it discretely, and only from that field", () => {
  let addressed = 0;
  for (const kind of ALL_KINDS) {
    const r = renderApprovalPayload(WorkApprovalKind[kind], FIXTURES[kind]!.payload);
    const artifact = buildApprovalArtifact(WorkApprovalKind[kind], r);

    if (artifact.recipient) {
      addressed += 1;
      assert.ok(
        Array.isArray(r.recipients) && r.recipients.length > 0,
        `${kind}: artifact has a recipient that did not come from the discrete field`,
      );
      // Every address on the artifact is one the renderer named explicitly.
      for (const addr of artifact.recipient.split(", ")) {
        assert.ok(
          r.recipients!.includes(addr),
          `${kind}: ${addr} is on the To: line but the renderer never named it`,
        );
      }
    }
    if (r.recipientLine && /^\s*To\b/i.test(r.recipientLine)) {
      assert.ok(
        Array.isArray(r.recipients),
        `${kind}: shows an addressee but does not expose it discretely`,
      );
    }
  }
  assert.ok(addressed > 0, "no kind produced a recipient — the assertion proved nothing");
});

test("an empty payload yields the empty notice — never a fallback dressed as content", () => {
  const rendered = renderApprovalPayload(WorkApprovalKind.BUYER_INQUIRY_REPLY_DRAFT, {});
  assert.deepEqual(rendered.body, ["No draft body was attached."]);

  const artifact = buildApprovalArtifact(
    WorkApprovalKind.BUYER_INQUIRY_REPLY_DRAFT,
    rendered,
  );
  assert.deepEqual(artifact.blocks, [ARTIFACT_EMPTY_NOTICE]);
  assert.ok(isRendererFallbackBlock(ARTIFACT_EMPTY_NOTICE));
  assert.ok(artifact.filename.length > 0);
});

// ── The fallback guard, anchored to the PRODUCER ─────────────────────────
//
// The previous version of this test compared RENDERER_FALLBACK_BLOCKS against
// isRendererFallbackBlock — the module's own list against the module's own
// matcher. It passed no matter what either of them said, and it duly stayed
// green while one entry carried a mojibake em dash (U+00E2 U+20AC U+201D in
// place of U+2014) and therefore never matched the renderer's real output.
// "Plaino is still drafting — refresh shortly." shipped into artifacts.
//
// Both directions are now checked against renderApprovalPayload itself.

/** Lines the renderer emits for an EMPTY payload that are legitimately not
 *  placeholders. Each is scaffolding or fixed consent copy that carries real
 *  meaning; anything else appearing here means the module missed a fallback. */
const STRUCTURAL_EMPTY_LINES: readonly RegExp[] = [
  // INBOX_TRIAGE labels the classification it made; the label is scaffolding
  // and the value beside it is real.
  /^Priority: /,
  // PLAINO_INSTRUCTION heading above the customer's own words.
  /^Customer instruction:$/,
  // VOICE_RECORDING_CONSENT is a fixed-copy consent card: these two lines ARE
  // the terms being agreed to, not a stand-in for missing content.
  /^Approving this turns on call recording for your workspace\./,
  /^A recording disclosure is spoken whenever/,
];

test("every placeholder the RENDERER emits for an empty payload is recognised here", () => {
  const unrecognised: Array<{ kind: string; line: string }> = [];

  const probe = (kindName: string, rendered: { body: string[] }) => {
    for (const raw of rendered.body) {
      const line = raw.trim();
      if (line.length === 0) continue;
      if (isRendererFallbackBlock(line)) continue;
      if (isCardChromeBlock(kindName, line)) continue;
      if (STRUCTURAL_EMPTY_LINES.some((re) => re.test(line))) continue;
      unrecognised.push({ kind: kindName, line });
    }
  };

  for (const kind of ALL_KINDS) {
    probe(kind, renderApprovalPayload(WorkApprovalKind[kind], {}));
  }
  // The renderer's `default:` arm, which only a not-yet-rendered enum value
  // reaches in production. Its line is a placeholder too.
  probe(
    "«unhandled kind»",
    renderApprovalPayload("A_KIND_THE_RENDERER_DOES_NOT_KNOW" as WorkApprovalKind, {}),
  );

  assert.deepEqual(
    unrecognised,
    [],
    "renderApprovalPayload emits a line for an empty payload that the artifact " +
      "would happily copy to the customer as if it were their work product",
  );
});

test("every fallback string this module carries still exists in the renderer", () => {
  // Read the producer's source rather than a copy of it. Some fallbacks sit
  // on defensive branches that no payload can reach (FINANCE_PULSE's
  // "No body attached." among them), so emitted-output alone cannot confirm
  // the whole list — but a typo, a re-worded placeholder, or a mojibake byte
  // sequence all fail right here.
  const source = readFileSync(RENDERER_SOURCE_PATH, "utf8");
  const missing = RENDERER_FALLBACK_BLOCKS.filter((line) => !source.includes(line));
  assert.deepEqual(
    missing,
    [],
    "these strings are not in renderApprovalPayload.ts, so nothing they claim " +
      "to strip is actually being stripped",
  );

  // And the module's own matcher agrees with its own list, which is the only
  // thing the old version of this test proved.
  for (const line of RENDERER_FALLBACK_BLOCKS) {
    assert.ok(isRendererFallbackBlock(line), `not rejected: ${line}`);
  }
  assert.equal(
    isRendererFallbackBlock("Hi Jane — the house is still available."),
    false,
  );
});

test("no artifact block is a renderer placeholder, for any kind, empty or full", () => {
  for (const kind of ALL_KINDS) {
    for (const payload of [{}, FIXTURES[kind]!.payload]) {
      const artifact = buildApprovalArtifact(
        WorkApprovalKind[kind],
        renderApprovalPayload(WorkApprovalKind[kind], payload),
      );
      const isEmptyProbe = Object.keys(payload).length === 0;
      for (const block of artifact.blocks) {
        assert.equal(
          isCardChromeBlock(kind, block),
          false,
          `${kind}: card chrome reached the artifact: ${JSON.stringify(block)}`,
        );
        if (isEmptyProbe && block === ARTIFACT_EMPTY_NOTICE) continue;
        assert.equal(
          isRendererFallbackBlock(block),
          false,
          `${kind}: placeholder reached the artifact: ${JSON.stringify(block)}`,
        );
      }
    }
  }
});

test("structure is first-class: text is derived from blocks, not parsed back out", () => {
  const artifact = buildApprovalArtifact(
    WorkApprovalKind.SUPPORT_HANDLER_REPLY_DRAFT,
    renderApprovalPayload(
      WorkApprovalKind.SUPPORT_HANDLER_REPLY_DRAFT,
      FIXTURES.SUPPORT_HANDLER_REPLY_DRAFT!.payload,
    ),
  );
  // Provenance stays STRUCTURED on `refs` — a later unit turns this into
  // durable graph nodes and must not re-parse a flattened blob.
  //
  // And the retrieval score is GONE. The on-screen renderer labels citations
  // "(similarity 0.91)", which is a fine debugging affordance on a card and
  // machine exhaust on a surface the customer pastes into a client email.
  assert.deepEqual(
    artifact.refs.map((r) => r.label),
    ["Owner statements — export path", "Reports tab overview"],
  );
  for (const ref of artifact.refs) {
    assert.doesNotMatch(ref.label, /similarity/i, "retrieval score is not copyable");
  }
  assert.doesNotMatch(renderArtifactText(artifact), /similarity/i);
  const text = renderArtifactText(artifact);
  assert.match(text, /Based on:/);
  assert.match(text, /Subject: Cannot export the owner statement/);
});

// ── Recipient integrity ──────────────────────────────────────────────────
//
// `recipientLine` is a DISPLAY string that concatenates the addressee and the
// subject: "To: jane@buyer.example.com    Re: <subject>". On every reply-draft
// kind that subject arrived in an email a stranger sent. The artifact used to
// run a global address regex over the whole line, so a stranger who wrote an
// address into their subject was silently added to the customer's To: header
// — the customer approves a reply to Jane, opens their mail app, and sends it
// with an outsider on the line.

/** The `to` part of a mailto: href, before the query string. */
function mailtoTo(href: string): string {
  const m = /^mailto:([^?]*)/.exec(href);
  return decodeURIComponent(m?.[1] ?? "");
}

test("an address in the SUBJECT never becomes a recipient", () => {
  const rendered = renderApprovalPayload(WorkApprovalKind.BUYER_INQUIRY_REPLY_DRAFT, {
    to: "jane@buyer.example.com",
    subject: "Please copy my agent bob@attacker.example.com on this",
    draft: "Hi Jane — 142 Peachtree is still on the market.",
  });
  // The display line does carry the address, because the subject does.
  assert.match(rendered.recipientLine ?? "", /bob@attacker\.example\.com/);

  const artifact = buildApprovalArtifact(
    WorkApprovalKind.BUYER_INQUIRY_REPLY_DRAFT,
    rendered,
  );
  assert.equal(artifact.recipient, "jane@buyer.example.com");

  const href = artifactMailtoHref(artifact);
  assert.ok(href);
  assert.equal(
    mailtoTo(href),
    "jane@buyer.example.com",
    "a stranger's address reached the mailto To: line",
  );
  assert.doesNotMatch(
    renderArtifactText(artifact),
    /^To: .*attacker/m,
    "a stranger's address reached the To: line of the copied text",
  );
  // The subject itself still reads as the stranger wrote it — quoting their
  // words back is correct; addressing them is not. This is the ONE place the
  // string is allowed to appear.
  assert.match(href, /subject=[^&]*attacker/);
});

test("a header-injection subject never reaches the recipient or the mailto To:", () => {
  for (const subject of [
    "Renewal%0ABcc: evil@attacker.example.com",
    "Renewal\r\nBcc: evil@attacker.example.com",
    "Renewal\nTo: evil@attacker.example.com",
  ]) {
    const artifact = buildApprovalArtifact(
      WorkApprovalKind.CHIEF_OF_STAFF_REPLY_DRAFT,
      renderApprovalPayload(WorkApprovalKind.CHIEF_OF_STAFF_REPLY_DRAFT, {
        subject,
        body: "We are good to renew at the current terms.",
        toEmails: ["ops@vendor.example.com"],
      }),
    );
    assert.equal(
      artifact.recipient,
      "ops@vendor.example.com",
      `subject ${JSON.stringify(subject)} altered the recipient`,
    );

    const href = artifactMailtoHref(artifact)!;
    assert.equal(mailtoTo(href), "ops@vendor.example.com");
    // Nothing raw survives into the addressee: no second address, no bare
    // CR/LF, and no naked %0A a mail client could read back as a header break.
    const to = /^mailto:([^?]*)/.exec(href)![1]!;
    assert.doesNotMatch(to, /attacker/);
    assert.doesNotMatch(to, /[\r\n]|%0[AaDd]/);
    // And the encoded subject cannot break out of its own parameter either.
    const subjectParam = /[?&]subject=([^&]*)/.exec(href)?.[1] ?? "";
    assert.doesNotMatch(subjectParam, /[\r\n]/);
  }
});

test("the renderer hands over discrete recipients; the artifact does not re-parse", () => {
  const rendered = renderApprovalPayload(WorkApprovalKind.FOLLOW_UP_NUDGE, {
    subject: "Re: proposal — cc backup@attacker.example.com",
    body: "Circling back on the Riverside proposal.",
    toEmails: ["sam@riverside.example.com"],
  });
  assert.deepEqual(rendered.recipients, ["sam@riverside.example.com"]);
  assert.equal(
    buildApprovalArtifact(WorkApprovalKind.FOLLOW_UP_NUDGE, rendered).recipient,
    "sam@riverside.example.com",
  );

  // Every kind that shows an addressee now states it discretely. A kind that
  // shows "To: …" without a `recipients` array has re-opened the parse path.
  for (const kind of ALL_KINDS) {
    const r = renderApprovalPayload(WorkApprovalKind[kind], FIXTURES[kind]!.payload);
    if (r.recipientLine && /^\s*To\b/i.test(r.recipientLine)) {
      assert.ok(
        Array.isArray(r.recipients),
        `${kind}: shows an addressee but does not expose it discretely`,
      );
    }
  }
});

// ── Provenance is for the customer, not for their counterparty ───────────
//
// "Why this was drafted: The vendor asked for a renewal decision by end of
// week." is useful in the customer's own copy and is the fleet's internal
// note about the vendor. It used to ride along in the mailto body, which is
// a pre-filled email TO that vendor.

/** The decoded `body=` parameter of a mailto: href. */
function mailtoBody(href: string): string {
  const m = /[?&]body=([^&]*)/.exec(href);
  return decodeURIComponent((m?.[1] ?? "").replace(/\+/g, "%20"));
}

test("no provenance block reaches the mailto body, for any kind", () => {
  let checked = 0;
  for (const kind of ALL_KINDS) {
    const artifact = buildApprovalArtifact(
      WorkApprovalKind[kind],
      renderApprovalPayload(WorkApprovalKind[kind], FIXTURES[kind]!.payload),
    );
    const href = artifactMailtoHref(artifact);
    if (!href) continue;
    checked += 1;
    const body = mailtoBody(href);
    for (const block of artifact.provenanceBlocks) {
      assert.equal(
        body.includes(block),
        false,
        `${kind}: internal provenance is in the outbound draft: ${JSON.stringify(block)}`,
      );
    }
    assert.doesNotMatch(body, /^Why this was drafted:/m, `${kind}: rationale leaked`);
    assert.doesNotMatch(body, /^In reply to:/m, `${kind}: inbound summary leaked`);
  }
  assert.ok(checked > 0, "no kind produced a mailto — the assertion proved nothing");
});

test("provenance stays in the customer's own copy and download", () => {
  const artifact = buildApprovalArtifact(
    WorkApprovalKind.CHIEF_OF_STAFF_REPLY_DRAFT,
    renderApprovalPayload(
      WorkApprovalKind.CHIEF_OF_STAFF_REPLY_DRAFT,
      FIXTURES.CHIEF_OF_STAFF_REPLY_DRAFT!.payload,
    ),
  );
  assert.deepEqual(artifact.provenanceBlocks, [
    "Why this was drafted: The vendor asked for a renewal decision by end of week.",
  ]);

  // Copy / download: the customer's own record, rationale included.
  const copyText = renderArtifactText(artifact);
  assert.match(copyText, /Why this was drafted: The vendor asked/);
  assert.match(copyText, /end of week/);

  // Outbound: the same work product, none of the reasoning.
  const outbound = renderArtifactText(artifact, { includeProvenance: false });
  assert.match(outbound, /good to renew at the current terms/);
  assert.doesNotMatch(outbound, /end of week/);
  assert.doesNotMatch(mailtoBody(artifactMailtoHref(artifact)!), /end of week/);

  // `blocks` is untouched — the structure keeps everything; only the
  // audience-specific flattening drops it.
  assert.ok(artifact.blocks.includes(artifact.provenanceBlocks[0]!));
  assert.deepEqual(
    artifactBodyBlocks(artifact, false),
    artifact.blocks.filter((b) => b !== artifact.provenanceBlocks[0]),
  );
});

// ── Closed-loop kinds are a record of the ACTION, not of the card ────────
//
// "Awaiting your approval — Plaino will send this envelope … Nothing has been
// sent." is the right thing under a pair of approve/reject buttons. Copied
// out of an artifact AFTER approving, it is UI chrome and it is false.

test("closed-loop artifacts carry the action, never the card's pending promise", () => {
  for (const kind of ALL_KINDS) {
    if (!CLOSED_LOOP_KINDS.has(kind)) continue;
    const artifact = buildApprovalArtifact(
      WorkApprovalKind[kind],
      renderApprovalPayload(WorkApprovalKind[kind], FIXTURES[kind]!.payload),
    );
    const text = renderArtifactText(artifact);
    assert.doesNotMatch(text, /Awaiting your approval/, `${kind}: card chrome copied`);
    assert.doesNotMatch(text, /Nothing has been sent/, `${kind}: stale promise copied`);
    assert.doesNotMatch(text, /Nothing has been voided/, `${kind}: stale promise copied`);
    assert.match(
      artifact.blocks[0] ?? "",
      /^Action: /,
      `${kind}: artifact does not say what was authorised`,
    );
  }
});

test("a thin closed-loop payload yields an honest artifact, not card chrome", () => {
  // Before: DOCUSIGN_SEND_ENVELOPE's only block was the pending-state promise,
  // and copying it handed the customer a sentence about the card.
  const thin = buildApprovalArtifact(
    WorkApprovalKind.DOCUSIGN_SEND_ENVELOPE,
    renderApprovalPayload(WorkApprovalKind.DOCUSIGN_SEND_ENVELOPE, {}),
  );
  assert.deepEqual(thin.blocks, ["Action: DocuSign — send for signature"]);
  assert.doesNotMatch(renderArtifactText(thin), /Awaiting your approval/);

  // With substance, the artifact is about the envelope.
  const real = buildApprovalArtifact(
    WorkApprovalKind.DOCUSIGN_SEND_ENVELOPE,
    renderApprovalPayload(
      WorkApprovalKind.DOCUSIGN_SEND_ENVELOPE,
      FIXTURES.DOCUSIGN_SEND_ENVELOPE!.payload,
    ),
  );
  const text = renderArtifactText(real);
  assert.match(text, /Subject: Listing agreement — 142 Peachtree Ave/);
  assert.match(text, /To: seller@example\.com/);
  assert.match(text, /From template: tpl_listing_agreement_v4/);
});

// ── …and the chrome strip never eats the customer's own words ────────────
//
// The first fix for the above over-corrected. `/^Awaiting your approval\b/`
// was applied to every block of all 30 kinds, so any customer paragraph that
// happened to OPEN with those four words was deleted from the copy, the
// download and the mailto. There is no visual signal when it happens:
// ApprovalHandoff keeps the artifact text in an off-screen <textarea>, so the
// customer sees a green checkmark over a message with a paragraph missing.
//
// Silent content loss on a customer surface is worse than the chrome it was
// removing, so these are the tests that hold the line.

test("a client message that OPENS with 'Awaiting your approval' keeps that paragraph", () => {
  const body =
    "Awaiting your approval on the revised scope, we are holding the crew until Friday.\n\nLet me know.";

  const artifact = buildApprovalArtifact(
    WorkApprovalKind.PORTAL_CLIENT_MESSAGE,
    renderApprovalPayload(WorkApprovalKind.PORTAL_CLIENT_MESSAGE, {
      toClientEmail: "client@acme.example.com",
      body,
    }),
  );
  const text = renderArtifactText(artifact);

  assert.ok(
    artifact.blocks.includes(
      "Awaiting your approval on the revised scope, we are holding the crew until Friday.",
    ),
    `the customer's first paragraph was deleted. blocks: ${JSON.stringify(artifact.blocks)}`,
  );
  assert.match(text, /holding the crew until Friday/);
  assert.match(text, /Let me know\./);

  // The card's OWN pending promise is still gone — this kind is closed-loop.
  assert.doesNotMatch(text, /your client sees this reply only after you approve/);
  assert.doesNotMatch(text, /Nothing has been sent/);
  assert.equal(artifact.blocks[0], "Action: Message to your client");
});

test("no kind loses a body paragraph merely for opening with the chrome's first words", () => {
  // Reachable on the reply-draft kinds too, where there is not even an
  // "Action:" line to cushion the loss — the paragraph just vanishes.
  const opener =
    "Awaiting your approval on the revised scope, we are holding the crew until Friday.";

  const reply = buildApprovalArtifact(
    WorkApprovalKind.BUYER_INQUIRY_REPLY_DRAFT,
    renderApprovalPayload(WorkApprovalKind.BUYER_INQUIRY_REPLY_DRAFT, {
      to: "jane@buyer.example.com",
      subject: "Revised scope",
      draft: `${opener}\n\nLet me know.`,
    }),
  );
  assert.ok(
    reply.blocks.includes(opener),
    `BUYER_INQUIRY_REPLY_DRAFT dropped the paragraph: ${JSON.stringify(reply.blocks)}`,
  );
  assert.match(renderArtifactText(reply), /holding the crew until Friday/);

  // And the mailto the customer's mail client opens carries it as well —
  // this is the surface the counterparty actually reads.
  const href = artifactMailtoHref(reply)!;
  assert.ok(href, "no mailto to check");
  assert.match(mailtoBody(href), /holding the crew until Friday/);

  // The predicate itself is gated: identical text, chrome only where the
  // renderer actually emits chrome.
  assert.equal(isCardChromeBlock("BUYER_INQUIRY_REPLY_DRAFT", opener), false);
  assert.equal(isCardChromeBlock("PORTAL_CLIENT_MESSAGE", opener), false);
});

// ── The consent card does not promise a state it has already left ────────
//
// VOICE_RECORDING_CONSENT's artifact carried "Recording stays off until you
// approve it here." — a sentence that is true on the card and false in the
// artifact, because the artifact only exists once the owner approved. The
// fixture above used to positively assert its presence, so the suite locked
// the defect in rather than catching it.

test("the recording-consent artifact keeps the terms and drops the pending promise", () => {
  const artifact = buildApprovalArtifact(
    WorkApprovalKind.VOICE_RECORDING_CONSENT,
    renderApprovalPayload(
      WorkApprovalKind.VOICE_RECORDING_CONSENT,
      FIXTURES.VOICE_RECORDING_CONSENT!.payload,
    ),
  );
  const text = renderArtifactText(artifact);

  // The false sentence is gone from the structure AND the derived text.
  assert.equal(
    artifact.blocks.some((b) => b.includes("Recording stays off until you approve")),
    false,
    `a promise that is false once copied survived: ${JSON.stringify(artifact.blocks)}`,
  );
  assert.doesNotMatch(text, /Recording stays off until you approve/);

  // The substantive terms — what was consented to — all survive.
  assert.match(text, /Approving this turns on call recording for your workspace\./);
  assert.match(text, /Recordings are kept for 45 days, then deleted\./);
  assert.match(text, /In two-party-consent states/);

  // Still a record of the action, and still copy-only.
  assert.equal(artifact.blocks[0], "Action: Call recording consent");
  assert.deepEqual(artifact.modes, ["copy"]);

  // The CARD keeps the sentence — it is correct there, under the buttons.
  const rendered = renderApprovalPayload(
    WorkApprovalKind.VOICE_RECORDING_CONSENT,
    FIXTURES.VOICE_RECORDING_CONSENT!.payload,
  );
  assert.ok(
    rendered.body.includes("Recording stays off until you approve it here."),
    "the fix removed the sentence from the CARD, where it is true and useful",
  );
});
