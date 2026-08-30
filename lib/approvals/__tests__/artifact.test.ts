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
import { WorkApprovalKind } from "@prisma/client";
import { renderApprovalPayload } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";
import {
  ARTIFACT_EMPTY_NOTICE,
  CLOSED_LOOP_KINDS,
  RENDERER_FALLBACK_BLOCKS,
  artifactMailtoHref,
  buildApprovalArtifact,
  extractRecipients,
  isRendererFallbackBlock,
  renderArtifactText,
} from "@/lib/approvals/artifact";

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
    expect: ["ops@vendor.example.com", "countersigned copy Monday", "end of week"],
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
    expect: [
      "Listing agreement — 142 Peachtree Ave",
      "tpl_listing_agreement_v4",
      "Nothing has been sent",
    ],
  },
  DOCUSIGN_VOID_ENVELOPE: {
    payload: {
      envelopeId: "env_9f3a2c",
      voidedReason: "The seller changed the commission split before signing.",
    },
    expect: ["env_9f3a2c", "changed the commission split", "Nothing has been voided"],
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
    expect: [
      "Recording stays off until you approve it here.",
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

test("extractRecipients pulls every address out of a humanized recipient line", () => {
  assert.deepEqual(
    extractRecipients("To: jane@buyer.example.com    Re: 142 Peachtree Ave"),
    ["jane@buyer.example.com"],
  );
  assert.deepEqual(extractRecipients("To: a@x.example.com, b@y.example.com"), [
    "a@x.example.com",
    "b@y.example.com",
  ]);
  assert.deepEqual(extractRecipients("To your client: sam@acme.example.com"), [
    "sam@acme.example.com",
  ]);
  assert.deepEqual(extractRecipients("Re: no address here"), []);
  assert.deepEqual(extractRecipients(undefined), []);
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

test("every renderer fallback line this module knows about is actually rejected", () => {
  for (const line of RENDERER_FALLBACK_BLOCKS) {
    assert.ok(isRendererFallbackBlock(line), `not rejected: ${line}`);
  }
  assert.equal(
    isRendererFallbackBlock("Hi Jane — the house is still available."),
    false,
  );
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
  assert.deepEqual(
    artifact.refs.map((r) => r.label),
    [
      "Owner statements — export path (similarity 0.91)",
      "Reports tab overview (similarity 0.78)",
    ],
  );
  const text = renderArtifactText(artifact);
  assert.match(text, /Based on:/);
  assert.match(text, /Subject: Cannot export the owner statement/);
});
