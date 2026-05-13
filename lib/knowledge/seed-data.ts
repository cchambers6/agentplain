/**
 * lib/knowledge/seed-data.ts
 *
 * Static seed corpus for the knowledge substrate. Three context kinds
 * land at install time:
 *
 *   * SKILL       — documentation for the five PR-C value-loop skills
 *                   (read / categorize / coordinate / schedule / draft).
 *   * VERTICAL    — chunked content from each of the 10 locked verticals
 *                   in `lib/verticals/<slug>/content.ts`. Hero, JTBD,
 *                   ROI, claims, integrations, value loop each become
 *                   their own row so search can target a specific chunk.
 *   * COMPLIANCE  — real-estate fair-housing fixture (HUD + ECOA digest).
 *                   Other verticals' compliance corpora land in the
 *                   parallel compliance-pack PR per
 *                   `feedback_no_new_verticals_finish_locked.md`.
 *
 * Every row carries a stable `sourceId` so the seed script is idempotent
 * (replaying the seed updates rows in place; it does not duplicate).
 *
 * Per `project_knowledge_substrate.md`: CUSTOMER + CROSS_CUSTOMER stay
 * empty at seed time. CUSTOMER fills as workspaces connect tools;
 * CROSS_CUSTOMER fills offline via the anonymization fleet agent.
 */

import type { KnowledgeUpsertInput } from './types';
import { getAllVerticals } from '../verticals';
import type { VerticalContent } from '../verticals/types';

// ── SKILL corpus ────────────────────────────────────────────────────────

interface SkillDoc {
  slug: string;
  title: string;
  body: string;
}

const SKILL_CORPUS: SkillDoc[] = [
  {
    slug: 'read',
    title: 'Skill: read — fetch + parse Gmail messages off a WebhookEvent cursor',
    body: `The read skill is step 1 of the value loop. It resolves a WebhookEvent row's Pub/Sub envelope
(emailAddress + historyId) into one or more ParsedMessage records via a provider-neutral MessageFetcher
port. Production uses gmail.users.history.list + gmail.users.messages.get round-trips behind the
GoogleGmailMessageFetcher; tests use the FixtureMessageFetcher with canned messages keyed by historyId.

Output: ParsedMessage[] with provider message id, thread id, sender, subject, plain-text body, snippet,
references, in-reply-to, attachments, receivedAt, labels. Hand-off goes to the categorize skill.

Per project_no_outbound_architecture.md, this skill is read-only — it never asks Gmail to send anything.
Per feedback_no_silent_vendor_lock.md, googleapis stays inside lib/integrations/google/; the skill
sees only the MessageFetcher interface.`,
  },
  {
    slug: 'categorize',
    title: 'Skill: categorize — assign one intent label per message',
    body: `The categorize skill is step 2 of the value loop. It assigns exactly one of six intent labels
to an inbound message: lead, scheduling-needed, draft-needed, vendor, transactional, noise. Output
includes a 0–1 confidence and a one-sentence rationale.

Vertical-specific rules live in lib/skills/prompts/<vertical>.ts. Each vertical bundle injects
noiseSignals, leadSignals, schedulingSignals, draftSignals — patterns the prompt evaluates against the
inbound. Real estate vs CPA vs law each carry their own rules; the runner picks the bundle by
workspace.vertical.

Critical rule: when in doubt, prefer "noise" over a confident wrong category. Confidence below 0.6
demotes to noise. The cost of a false-positive "lead" greatly exceeds the cost of a missed-positive
"noise" — see the categorize prompt in lib/skills/prompts/shared.ts.`,
  },
  {
    slug: 'coordinate',
    title: 'Skill: coordinate — summarize the thread for the draft skill',
    body: `The coordinate skill is step 3 of the value loop. Given the newest message in a thread plus
prior messages, it produces a compact thread summary (≤ 800 chars) the downstream draft skill consumes.

Output includes the summary text, referencedThreadIds, and the prior messages in chronological order.
The skill reads but never writes; per project_no_outbound_architecture.md it does not call out, and per
feedback_no_silent_vendor_lock.md it speaks only the MessageFetcher port — not googleapis directly.

The runner invokes coordinate only when the categorize step returned scheduling-needed or draft-needed.
Other intents (noise, transactional, vendor, lead) terminate the loop without a coordinate pass.`,
  },
  {
    slug: 'schedule',
    title: 'Skill: schedule — propose 2–3 meeting slots that respect business hours',
    body: `The schedule skill is step 4 of the value loop, invoked only when the categorize step returned
scheduling-needed. Given the newest message and an optional SchedulingPreferences object
(businessHours, workDays, defaultDurationMinutes, bufferMinutes), it proposes 2–3 specific slots that
respect customer business hours, customer-stated preferences, and at least 15-minute buffer between
back-to-back meetings.

Output: needsResponse boolean, proposedSlots array (day, startLocal, endLocal), reasoning string,
confidence. The skill does NOT book the calendar event — per project_no_outbound_architecture.md the
customer's system executes outreach. agentplain produces proposals; the customer's operator reviews
and books.`,
  },
  {
    slug: 'draft',
    title: 'Skill: draft — produce a reply for operator review',
    body: `The draft skill is step 5 of the value loop. It produces a reply draft the operator reviews
before sending. Output: subject, body, tone (formal | casual | technical), confidence. The draft
persists to Gmail via the DraftPersister port (gmail.users.drafts.create) — never via messages.send.

Per project_no_outbound_architecture.md, draft creation is the explicit RECEIVE-shape carve-out:
agentplain creates the draft in Gmail's drafts folder; the customer's human still hits send.

Draft tone defaults to the vertical bundle's tone setting (real estate: casual; law: formal; CPA:
technical) but the model can adjust within the bundle's guidance. Low-confidence drafts
(confidence < 0.5) are generated but NOT persisted — they stay in the operator queue rather than
landing in the inbox where a hurried tap could send them.`,
  },
];

// ── COMPLIANCE corpus (real-estate fair-housing) ────────────────────────

interface ComplianceDoc {
  slug: string;
  title: string;
  body: string;
  sourceUrl: string | null;
  verticalSlug: string;
}

const COMPLIANCE_CORPUS: ComplianceDoc[] = [
  {
    slug: 'fha-protected-classes',
    title: 'Fair Housing Act — protected classes (HUD)',
    body: `The Fair Housing Act prohibits discrimination in the sale, rental, and financing of dwellings
based on race, color, national origin, religion, sex (including gender identity and sexual orientation
per the 2021 HUD memorandum), familial status, or disability. Listing copy, marketing materials, and
buyer-inquiry replies must avoid language that expresses a preference, limitation, or discrimination
based on any protected class. Steering buyers toward or away from a neighborhood based on the
demographic composition of that neighborhood violates the Act even when the language is
demographically neutral on its face.`,
    sourceUrl: 'https://www.hud.gov/program_offices/fair_housing_equal_opp/fair_housing_act_overview',
    verticalSlug: 'real-estate',
  },
  {
    slug: 'fha-advertising-words',
    title: 'Fair Housing Act — advertising words to avoid',
    body: `HUD-published guidance enumerates language patterns that, on their face, suggest a preference
or limitation under the Fair Housing Act. Examples include phrases like "perfect for a young family",
"adult community", "Christian preferred", "no children", "able-bodied applicants only", "exclusive
neighborhood", "restricted community", and descriptions that emphasize the demographic composition of
a neighborhood. Replacement-grade alternatives describe the property and the amenities rather than
the imagined occupant: "three-bedroom home with a fenced yard", "single-level layout", "quiet
cul-de-sac with mature trees". The sentinel agent flags any draft that includes a known-banned phrase
and proposes a substantively similar rewrite.`,
    sourceUrl: 'https://www.hud.gov/sites/dfiles/FHEO/documents/FHActGuide.pdf',
    verticalSlug: 'real-estate',
  },
  {
    slug: 'georgia-license-disclosure',
    title: 'Georgia broker-of-record disclosure',
    body: `Georgia O.C.G.A. § 43-40-25 requires every brokerage advertisement to identify the broker of
record. Customer-facing drafts that promote a listing — including emails, social posts, blog content,
and printed flyers — must include the brokerage name. Per-agent signature blocks on inbound replies
typically satisfy this when the brokerage name appears in the signature line; the sentinel flags
drafts that omit it. The Georgia Real Estate Commission's published advertising guidance is the
authoritative reference for which surfaces require disclosure.`,
    sourceUrl: 'https://grec.state.ga.us/wp-content/uploads/2022/04/Advertising-and-the-License-Law.pdf',
    verticalSlug: 'real-estate',
  },
  {
    slug: 'ecoa-equal-credit',
    title: 'Equal Credit Opportunity Act — lender referral language',
    body: `The Equal Credit Opportunity Act (15 U.S.C. § 1691) prohibits discrimination in any aspect of
a credit transaction on the basis of race, color, religion, national origin, sex, marital status, age
(provided the applicant has the capacity to contract), or because all or part of the applicant's
income derives from public assistance. Listing-agent drafts that introduce a buyer to a preferred
lender, recommend a specific loan product, or characterize a buyer's likely loan eligibility must
avoid language that ties eligibility to a protected class. Substitute amount-based phrasing
("pre-approved up to $X") for demographic phrasing ("a strong young couple").`,
    sourceUrl: 'https://www.consumerfinance.gov/rules-policy/regulations/1002/',
    verticalSlug: 'real-estate',
  },
  {
    slug: 're-disclosure-material-facts',
    title: 'Material-fact disclosure baseline (Georgia)',
    body: `Under Georgia case law (Bardin v. Brookwood Capital, 1992; Wilhite v. Mays, 1993) and the
Georgia BRRETA, a listing broker has a duty to disclose material facts that adversely affect the
property's value when the broker knows or reasonably should know them. Common examples: known
foundation issues, prior flooding, unpermitted additions, recent crime on or adjacent to the property,
HOA litigation, septic issues, and roof condition. Drafts replying to "is there anything I should
know?" inquiries must surface any known material facts the seller has disclosed; the sentinel flags
drafts that paper over a known disclosure.`,
    sourceUrl: 'https://grec.state.ga.us/license-law-rules/',
    verticalSlug: 'real-estate',
  },
];

// ── VERTICAL corpus chunker ─────────────────────────────────────────────

function chunkVertical(v: VerticalContent): KnowledgeUpsertInput[] {
  const base: Pick<KnowledgeUpsertInput, 'contextKind' | 'workspaceId' | 'verticalSlug'> = {
    contextKind: 'VERTICAL',
    workspaceId: null,
    verticalSlug: v.slug,
  };

  const chunks: KnowledgeUpsertInput[] = [];

  chunks.push({
    ...base,
    sourceType: 'vertical_content',
    sourceId: `vertical:${v.slug}:hero`,
    title: `${v.name} — hero & value proposition`,
    body: `Vertical: ${v.name}. Tier: ${v.tier}. Mission audience: ${v.missionSubject ?? v.name}.
Eyebrow: ${v.hero.eyebrow}
Headline: ${v.hero.headline}
Value prop: ${v.hero.valueProp}`,
    metadata: { chunk: 'hero', tier: v.tier },
  });

  for (const table of v.jtbdTables) {
    chunks.push({
      ...base,
      sourceType: 'vertical_content',
      sourceId: `vertical:${v.slug}:jtbd:${slugifyRole(table.role)}`,
      title: `${v.name} — ${table.role} jobs-to-be-done`,
      body: `JTBD table for ${table.role} in ${v.name}:\n${table.rows
        .map(
          (r) =>
            `- Job: ${r.job}\n  When: ${r.when}\n  Today: ${r.today}\n  With agentplain: ${r.withAgentplain}`,
        )
        .join('\n')}`,
      metadata: { chunk: 'jtbd', role: table.role, draft: table.draft ?? false },
    });
  }

  chunks.push({
    ...base,
    sourceType: 'vertical_content',
    sourceId: `vertical:${v.slug}:roi`,
    title: `${v.name} — ROI math`,
    body: `${v.roi.multiplier} return for ${v.name}. Input cost: ${v.roi.inputCost}. Output value: ${v.roi.outputValue}. Math: ${v.roi.math}. Cited inputs: ${v.roi.citation}`,
    metadata: { chunk: 'roi', multiplier: v.roi.multiplier },
  });

  chunks.push({
    ...base,
    sourceType: 'vertical_content',
    sourceId: `vertical:${v.slug}:claims`,
    title: `${v.name} — replace / integrate / augment claims`,
    body: `REPLACE: ${v.claims.replace.join(' | ')}
INTEGRATE: ${v.claims.integrate.join(' | ')}
AUGMENT: ${v.claims.augment.join(' | ')}`,
    metadata: { chunk: 'claims' },
  });

  chunks.push({
    ...base,
    sourceType: 'vertical_content',
    sourceId: `vertical:${v.slug}:integrations`,
    title: `${v.name} — integrations roadmap`,
    body: `Shipped integrations: ${
      v.integrations.shipped.length === 0
        ? 'none yet'
        : v.integrations.shipped.map((i) => `${i.name} (${i.category})`).join(', ')
    }. Planned (${v.integrations.plannedWindow}): ${v.integrations.planned
      .map((i) => `${i.name} (${i.category})`)
      .join(', ')}.`,
    metadata: { chunk: 'integrations', plannedWindow: v.integrations.plannedWindow },
  });

  if (v.valueLoopExample) {
    chunks.push({
      ...base,
      sourceType: 'vertical_content',
      sourceId: `vertical:${v.slug}:value-loop`,
      title: `${v.name} — day-in-the-life value loop`,
      body: `Scenario: ${v.valueLoopExample.scenario}\nBefore: ${v.valueLoopExample.before}\nAfter: ${v.valueLoopExample.after}\nOutcome: ${v.valueLoopExample.outcome}`,
      metadata: { chunk: 'value-loop' },
    });
  }

  return chunks;
}

function slugifyRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Public assembly ─────────────────────────────────────────────────────

export interface SeedAssembly {
  skill: KnowledgeUpsertInput[];
  vertical: KnowledgeUpsertInput[];
  compliance: KnowledgeUpsertInput[];
}

export function buildSeedAssembly(): SeedAssembly {
  const skill: KnowledgeUpsertInput[] = SKILL_CORPUS.map((s) => ({
    contextKind: 'SKILL',
    workspaceId: null,
    sourceType: 'skill_doc',
    sourceId: `skill:${s.slug}`,
    title: s.title,
    body: s.body,
    metadata: { skillSlug: s.slug },
  }));

  const vertical: KnowledgeUpsertInput[] = [];
  for (const v of getAllVerticals()) {
    vertical.push(...chunkVertical(v));
  }

  const compliance: KnowledgeUpsertInput[] = COMPLIANCE_CORPUS.map((c) => ({
    contextKind: 'COMPLIANCE',
    workspaceId: null,
    sourceType: 'compliance_doc',
    sourceId: `compliance:${c.verticalSlug}:${c.slug}`,
    title: c.title,
    body: c.body,
    sourceUrl: c.sourceUrl,
    verticalSlug: c.verticalSlug,
    metadata: { complianceSlug: c.slug },
  }));

  return { skill, vertical, compliance };
}

export const SEED_COUNTS = (() => {
  const a = buildSeedAssembly();
  return {
    SKILL: a.skill.length,
    VERTICAL: a.vertical.length,
    COMPLIANCE: a.compliance.length,
    CUSTOMER: 0,
    CROSS_CUSTOMER: 0,
  };
})();
