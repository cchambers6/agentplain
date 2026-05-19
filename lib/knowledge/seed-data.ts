/**
 * lib/knowledge/seed-data.ts
 *
 * Static seed corpus for the knowledge substrate. Four buckets land at
 * install time (SKILL / VERTICAL / COMPLIANCE / CROSS_CUSTOMER):
 *
 *   * SKILL — documentation for the five PR-C value-loop skills
 *     (read / categorize / coordinate / schedule / draft), PLUS
 *     architecture chunks from `docs/skills-architecture.md` and
 *     `docs/knowledge-substrate.md` so any skill agent can query
 *     "how does the value loop work" or "how do I call the substrate"
 *     and get authoritative answers.
 *
 *   * VERTICAL — chunked content from each of the 10 locked verticals
 *     in `lib/verticals/<slug>/content.ts`. Hero, JTBD per role, ROI,
 *     claims, integrations, value loop each become their own row so
 *     search can target a specific chunk. Plus a richer per-role JTBD
 *     synthesis (sourceType='jtbd') that joins JTBD rows with the
 *     vertical's claims + integrations + value-loop example so a single
 *     "what does a CPA tax preparer do all day" query returns the full
 *     picture.
 *
 *   * COMPLIANCE — original real-estate fair-housing fixtures (HUD +
 *     ECOA + GA broker disclosure + material-fact disclosure) PLUS the
 *     verified entries from the per-vertical sentinel corpus at
 *     `lib/agents/sentinel/corpus/<vertical>/`. Entries flagged
 *     `unverified: true` are intentionally skipped — they ship as
 *     placeholder text under `[UNVERIFIED — needs counsel]` and would
 *     poison live queries until counsel red-lines them.
 *
 * Every row carries a stable `sourceId` so the seed script is idempotent
 * (replaying the seed updates rows in place; it does not duplicate).
 *
 * Per `project_knowledge_substrate.md`: CUSTOMER stays empty at seed
 * time (fills as workspaces connect tools). CROSS_CUSTOMER seeds with
 * the platform-wide doctrine ratified offline between 2026-05-11 and
 * 2026-05-18 — positioning, pricing, brand semantics, MCP-first
 * architecture, mission, design language, readiness audit, build
 * handoffs. Future anonymized fleet learnings land in the same kind
 * via a separate offline pipeline; this seed is the doctrine baseline.
 *
 * Per `feedback_no_guesses_no_estimates.md`: every entry's body is
 * derived from a real file path (cited in metadata.source). Unverified
 * compliance entries are skipped, not fabricated.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file produces typed
 * `KnowledgeUpsertInput` rows. The store + embedder construction stays
 * inside `lib/knowledge/`; nothing here touches OpenAI or pgvector.
 */

import type { KnowledgeUpsertInput } from './types';
import { getAllVerticals, getAllVerticalsIncludingOnRamps } from '../verticals';
import type { VerticalContent } from '../verticals/types';
import { listCorpusVerticals, loadCorpusFor } from '../agents/sentinel';
import { tierDisplayName, type TierName } from '../pricing/tiers';

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

// ── Architecture-doc corpus (shipped under SKILL kind) ──────────────────
//
// The user spec referenced `docs/mcp-first-migration.md` +
// `docs/skills-mcp-contract.md`, but those docs have not shipped. The
// real architecture artifacts in the repo today are
// `docs/skills-architecture.md` and `docs/knowledge-substrate.md` —
// both authored as part of the PR-C / knowledge-substrate work. We seed
// these so any skill agent can query "how does the value loop compose"
// or "what's the embedding dimension" and get a grounded answer from a
// committed artifact rather than the LLM's prior knowledge.

interface ArchDoc {
  slug: string;
  title: string;
  body: string;
  source: string;
  section: string;
}

const ARCHITECTURE_CORPUS: ArchDoc[] = [
  {
    slug: 'skills-architecture:loop-overview',
    title: 'Skills architecture — the five-skill value loop',
    body: `The agentplain value loop is one runner over five composable skills. A WebhookEvent flows
read → categorize → (noise | transactional | vendor | lead | scheduling-needed | draft-needed). Noise,
transactional, vendor, and lead intents terminate. Scheduling-needed routes coordinate → schedule →
draft. Draft-needed routes coordinate → draft. Every skill is a small adapter under the
ISkill<TInput, TOutput> contract; skills do not know about each other. lib/skills/runner.ts owns the
conditional logic. Outputs: read → ParsedMessage[], categorize → Categorization (intent + confidence +
reason), coordinate → ThreadContext (summary + cross-thread refs), schedule → SchedulingProposal,
draft → DraftReply (subject + body + Gmail draft id).`,
    source: 'docs/skills-architecture.md',
    section: 'The loop',
  },
  {
    slug: 'skills-architecture:adapter-ports',
    title: 'Skills architecture — adapter ports (provider-neutral)',
    body: `Three swappable ports keep lib/skills/ provider-neutral per feedback_no_silent_vendor_lock.md
and project_living_portable_architecture.md.

LlmProvider (lib/llm/types.ts): production AnthropicProvider (lib/llm/anthropic-provider.ts); test
TestLlmProvider (lib/llm/test-provider.ts) with canned + heuristic outputs. getLlmProvider() reads
LLM_PROVIDER env (test forces test mode) and ANTHROPIC_API_KEY presence.

MessageFetcher (lib/skills/types.ts): production GmailMessageAdapter (lib/skills/gmail-fetcher.ts)
calling gmail.users.history.list + gmail.users.messages.get; test FixtureMessageFetcher reading from
tests/fixtures/webhook-events/.

DraftPersister (lib/skills/types.ts): production GmailMessageAdapter (same class implements both ports);
test RecordingDraftPersister captures calls in memory.

The two-implementation rule per feedback_runner_portability.md is satisfied for each port — new
providers (M365, OpenAI) slot in without touching skill code.`,
    source: 'docs/skills-architecture.md',
    section: 'Adapter ports',
  },
  {
    slug: 'skills-architecture:no-outbound-contract',
    title: 'Skills architecture — the no-outbound contract',
    body: `Per project_no_outbound_architecture.md, lib/skills/ produces proposals; the customer's
system executes. The contract is enforced at three layers:

1. Interface shape. DraftPersister.persistDraft is the ONLY write method. There is no send. Adding
one would require an interface change visible in code review.

2. Schedule skill. Returns SchedulingProposal — no calendar method on its surface.

3. Draft skill. Persists via gmail.users.drafts.create. The GmailMessageAdapter deliberately does not
expose gmail.users.messages.send.

The e2e test (tests/skills-loop-e2e.test.ts) asserts the recording persister sees zero calls for
noise / transactional / vendor / lead intents, and that low-confidence drafts (< 0.5) are generated
but not persisted.`,
    source: 'docs/skills-architecture.md',
    section: 'The no-outbound contract',
  },
  {
    slug: 'knowledge-substrate:context-kinds',
    title: 'Knowledge substrate — the five context kinds + RLS rules',
    body: `The substrate has five context kinds with strict workspaceId rules enforced at both the
Postgres CHECK and the application layer:

SKILL — platform-wide, workspaceId NULL. The read/categorize/coordinate/schedule/draft docs.
CUSTOMER — one workspace, workspaceId REQUIRED. This customer's pipeline notes, prefs, history.
VERTICAL — platform-wide, workspaceId NULL. Real-estate vs CPA JTBD, ROI, claims, value-loop chunks.
CROSS_CUSTOMER — platform-wide, workspaceId NULL. Anonymized fleet learnings; populated offline.
COMPLIANCE — platform-wide, workspaceId NULL. Fair-housing, ECOA, state-by-state advertising rules.

Customer queries read their own rows (workspaceId matches GUC) AND every non-customer-scoped row
(workspaceId IS NULL). Operator queries read everything. Writes are operator-only at the policy level.
The store wraps each method in withRls(ctx, ...) from lib/db/rls.ts which sets app.user_id,
app.workspace_id, and app.is_operator GUCs inside a transaction.`,
    source: 'docs/knowledge-substrate.md',
    section: 'The five context kinds',
  },
  {
    slug: 'knowledge-substrate:ports-and-embedding',
    title: 'Knowledge substrate — two-impl ports + embedding model',
    body: `IEmbeddingProvider port: production OpenAIEmbeddingProvider (text-embedding-3-small, 1536
dims, $0.02/1M tokens per OpenAI pricing read 2026-05-12); test TestEmbeddingProvider (deterministic
SHA-256 → unit-norm float[]).

IKnowledgeStore port: production PgvectorKnowledgeStore (pgvector ivfflat cosine, RLS); test
TestKnowledgeStore (in-memory).

Selection rules in lib/knowledge/index.ts: KNOWLEDGE_EMBEDDING_PROVIDER (test forces test; unset +
OPENAI_API_KEY present → openai; unset + no key → test fallback). KNOWLEDGE_STORE (pgvector default;
test for in-memory). The test fallback when OPENAI_API_KEY is unset mirrors lib/llm/index.ts so the
chain stays exercisable on mock data until prod keys land.

Dimension mismatch between provider and column is detected at write time (DIMENSION_MISMATCH error).
The MCP route (app/api/knowledge/mcp/route.ts) exposes knowledge.search, knowledge.upsert, and
knowledge.delete via JSON-RPC 2.0 with x-agentplain-mcp-key header auth and an optional
x-agentplain-workspace-id header for CUSTOMER-scoped operations.`,
    source: 'docs/knowledge-substrate.md',
    section: 'Architecture',
  },
];

// ── COMPLIANCE corpus (real-estate fair-housing — original 5) ───────────

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

/**
 * Per-role JTBD synthesis. One row per (vertical × role) that joins the
 * JTBD rows with the vertical's claims + integrations + value-loop
 * example. This is a different sourceType ('jtbd') from `chunkVertical`'s
 * per-role chunks so a query like "what does a CPA tax preparer do all
 * day" lands a full-picture row rather than just the bare JTBD table.
 *
 * The structure follows the user spec's primaryGoal / dailyStruggles /
 * toolsTheyUse / workAgentplainReplaces / workAgentplainIntegrates /
 * workAgentplainAugments / exampleScenario shape, synthesized from the
 * data the content.ts file actually exposes (JTBD rows + claims +
 * integrations + value-loop example). Keeping the synthesis here means
 * we don't touch the source files — per the source-files-are-read-only
 * constraint.
 */
function buildJtbdSynthesisRows(v: VerticalContent): KnowledgeUpsertInput[] {
  const out: KnowledgeUpsertInput[] = [];
  const toolsAll = [
    ...v.claims.integrate,
    ...v.integrations.planned.map((i) => `${i.name} (${i.category})`),
  ];
  const dedupedTools = Array.from(new Set(toolsAll));
  const augments = v.claims.augment;
  const replaces = v.claims.replace;
  const integrates = v.claims.integrate;
  const example = v.valueLoopExample;

  for (const table of v.jtbdTables) {
    const primaryGoal = table.rows[0]?.job ?? '(no primary goal listed)';
    const dailyStruggles = table.rows.map((r) => r.today).filter((s) => s && s.length > 0);
    const rowReplaces = table.rows.map((r) => `${r.job} → ${r.withAgentplain}`);
    const sourceId = `jtbd:${v.slug}:${slugifyRole(table.role)}`;

    const bodyParts: string[] = [
      `Vertical: ${v.name} (slug=${v.slug}). Recommended tier: ${tierDisplayName(v.tier as TierName)} per project_stripe_both_surfaces.md (2026-05-15 three-tier ratification).`,
      `Role: ${table.role}.`,
      `Mission audience: ${v.missionSubject ?? v.name}.`,
      ``,
      `Primary goal: ${primaryGoal}.`,
      ``,
      `Daily struggles (without agentplain):\n${dailyStruggles.map((s) => `- ${s}`).join('\n')}`,
      ``,
      `Tools they use: ${dedupedTools.join(', ')}.`,
      ``,
      `Work agentplain REPLACES (role-specific):\n${rowReplaces.map((s) => `- ${s}`).join('\n')}`,
      ``,
      `Work agentplain REPLACES (vertical-wide):\n${replaces.map((s) => `- ${s}`).join('\n')}`,
      ``,
      `Work agentplain INTEGRATES with:\n${integrates.map((s) => `- ${s}`).join('\n')}`,
      ``,
      `Work agentplain AUGMENTS:\n${augments.map((s) => `- ${s}`).join('\n')}`,
    ];

    if (example) {
      bodyParts.push(
        ``,
        `Example scenario: ${example.scenario}`,
        `Before agentplain: ${example.before}`,
        `After agentplain: ${example.after}`,
        `Outcome: ${example.outcome}`,
      );
    }

    out.push({
      contextKind: 'VERTICAL',
      workspaceId: null,
      verticalSlug: v.slug,
      sourceType: 'jtbd',
      sourceId,
      title: `${table.role} in ${v.name}`,
      body: bodyParts.join('\n'),
      metadata: {
        chunk: 'jtbd',
        role: table.role,
        verticalSlug: v.slug,
        tier: 'regular',
        tools: dedupedTools,
        draft: table.draft ?? false,
        source: `lib/verticals/${v.slug}/content.ts`,
      },
    });
  }

  return out;
}

function slugifyRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Per-vertical sentinel compliance corpus ─────────────────────────────

/**
 * Walks every registered sentinel corpus and emits one
 * KnowledgeUpsertInput per VERIFIED ComplianceRule. Unverified rules
 * (literal text under [UNVERIFIED — needs counsel]) are intentionally
 * skipped — they'd poison live queries with placeholder text. Counsel
 * red-line flips `unverified` to false; a re-seed then picks them up.
 *
 * Returns the rows plus a count of how many entries were skipped, so
 * the seed script + PR description can report coverage accurately.
 */
export interface ComplianceCorpusBuild {
  rows: KnowledgeUpsertInput[];
  skippedUnverified: number;
  verifiedByVertical: Record<string, number>;
  unverifiedByVertical: Record<string, number>;
}

export function buildComplianceCorpus(): ComplianceCorpusBuild {
  const rows: KnowledgeUpsertInput[] = [];
  let skippedUnverified = 0;
  const verifiedByVertical: Record<string, number> = {};
  const unverifiedByVertical: Record<string, number> = {};

  for (const slug of listCorpusVerticals()) {
    const bundle = loadCorpusFor(slug);
    if (!bundle) continue;
    verifiedByVertical[slug] = 0;
    unverifiedByVertical[slug] = 0;
    for (const rule of bundle.rules) {
      if (rule.unverified) {
        skippedUnverified += 1;
        unverifiedByVertical[slug] += 1;
        continue;
      }
      verifiedByVertical[slug] += 1;
      const scope = rule.scope;
      const scopeLabel =
        scope.kind === 'federal'
          ? 'federal'
          : scope.kind === 'state'
            ? `state:${scope.state}`
            : `professional-body:${scope.body}`;

      rows.push({
        contextKind: 'COMPLIANCE',
        workspaceId: null,
        sourceType: 'compliance-corpus',
        sourceId: `${slug}:${rule.ruleId}`,
        title: rule.title,
        body: `${rule.summary}\n\nLITERAL TEXT:\n${rule.literalText}\n\nCITATION: ${rule.citation.source} (read ${rule.citation.accessedAt}).${
          rule.drafterNotes ? `\n\nDRAFTER NOTES: ${rule.drafterNotes}` : ''
        }`,
        sourceUrl: rule.citation.url,
        verticalSlug: slug,
        metadata: {
          verticalSlug: slug,
          ruleId: rule.ruleId,
          statute: rule.citation.source,
          jurisdiction: rule.jurisdiction,
          scope: scopeLabel,
          status: bundle.metadata.status,
          counselReviewer: bundle.metadata.counselReviewer,
          lastReviewedAt: bundle.metadata.lastReviewedAt,
          source: `lib/agents/sentinel/corpus/${slug}/${rule.ruleId}`,
        },
      });
    }
  }

  return { rows, skippedUnverified, verifiedByVertical, unverifiedByVertical };
}

// ── DOCTRINE corpus (CROSS_CUSTOMER kind) ───────────────────────────────
//
// Platform-wide doctrine ratified between 2026-05-11 and 2026-05-18 that
// did not previously land in the substrate. The CROSS_CUSTOMER context
// kind is the right surface per `docs/knowledge-substrate.md` and the
// 2026-05-14 refresh report — "anonymized fleet learnings derived
// offline." These rows let customer-facing skills retrieve the CURRENT
// answer to questions like "what's your pricing?" or "is plain
// pronounced plane?" instead of the model's training-prior generic.
//
// Per `feedback_no_guesses_no_estimates.md`: every body is derived from
// a real memory file. The metadata.source field cites the file path so a
// future reader can re-pull the canonical text. Sources live in the agent
// memory dir; this file replays the load-bearing extracts so the seeded
// substrate stays self-contained and idempotent.
//
// Per `feedback_no_silent_vendor_lock.md`: still produces typed
// `KnowledgeUpsertInput` rows; nothing here imports OpenAI or pgvector.
//
// Per `project_knowledge_substrate.md`: CROSS_CUSTOMER is platform-wide,
// `workspaceId` = NULL, enforced by the `validateContextWorkspaceFit`
// check in `lib/knowledge/pgvector-store.ts`.

interface DoctrineDoc {
  slug: string;
  title: string;
  body: string;
  source: string;
  ratified: string;
}

const DOCTRINE_CORPUS: DoctrineDoc[] = [
  {
    slug: 'mission-vision-tagline',
    title: 'agentplain mission, vision, tagline (locked 2026-05-11)',
    body: `Mission: "We lift up local businesses by doing the work that takes their time and money away from the people they serve."
Vision: "Local businesses can thrive through access to affordable, best-in-class tools and services."
Tagline: "Intelligence rooted in reality."

Audience language: "local businesses", "local business owners", "entrepreneurs". BANNED: "SMB" (corporate-speak; doesn't fit local), "knowledge workers" (too generic), "white-collar workers" (off-tone). Mechanism term: "capable AI partners" or "the fleet" — never a specific agent count.

The tagline carries the brand thesis. Intelligence = the AI / the fleet. Reality = our expertise built on actual business processes; we know local business owners, their struggles, what they need; we run this same fleet model in production today (flatsbo brokerage, ~35 cron-fired agents); not magic, not ethereal, not vapor — real product, real operators, real outcomes.

Banned variants: "Replace your team with AI", "Automate everything", "AI assistant" (too generic), "Magic" / "AI magic" / "ethereal" / "intelligent automation" (contradicts the tagline). Pricing framings that lose "affordable" are banned — affordable access IS the vision.`,
    source: 'memory/project_agentplain_mission_and_positioning.md',
    ratified: '2026-05-11',
  },
  {
    slug: 'nine-questions-every-surface',
    title: 'The nine questions every customer-facing surface must answer',
    body: `Each customer-facing surface (page, deck, video, screen) must address SOME subset of these. Homepage + pricing must address ALL. Vertical pages must address Q1-Q5 + Q7-Q9. App empty states + onboarding must address Q3-Q5.

Q1. Why do we exist? — Professional services people spend 60-70% of their week on systematic work. agentplain fixes that ratio; the fleet does the systematic work; the human does the relationship work.
Q2. What is agentplain? — AI ops layer that runs as a fleet of agents inside your professional services firm. CRITICAL: page 1 of any marketing surface mentions ALL 10 verticals (real estate, mortgage, insurance, property management, title & escrow, recruiting, home services contractors, CPAs, law firms, RIAs). Don't lose a CPA on page one because the hero only said "for realtors."
Q3. What does the app do? Can everyone use it? — One unified product. 1-seat solo to N-seat workspace.
Q4. What makes it unique? — Vertical-aware; you stay in control (drafts, never auto-sends); integrates with what you already use; built BY agents; compliance-first.
Q5. How easy is it to use? — Sign up free, pick your vertical, connect Gmail or CRM in 60 seconds, see drafts within minutes.
Q6. Why should anyone believe us? — Eat-our-own-cooking; counsel-reviewed compliance corpus; flatsbo brokerage v0; ROI math anchored in concrete per-vertical examples (15-107x).
Q7. ROI? — 15-107x per realtor anchored in $2,900-$10,600/mo value vs $99-$499/mo subscription.
Q8. Future of work? — Humans focus on what only humans can do; AI handles what AI is better at.
Q9. Why now? — Models got good enough in 2025; vendor APIs stabilized; compliance frameworks clear; demand real.`,
    source: 'memory/project_agentplain_mission_and_positioning.md',
    ratified: '2026-05-11',
  },
  {
    slug: 'service-partnership-positioning',
    title: 'Service partnership positioning — agentplain sells the partner who runs AI for you',
    body: `LOCKED 2026-05-15 in response to Anthropic's Claude for Small Business launch (2026-05-13).

agentplain is not selling AI. agentplain is selling THE PARTNER WHO RUNS AI FOR YOU.

- Anthropic Claude for SMB: "Here's the toolkit. 15 workflows, 15 skills, 8 connectors. Free with your Claude license. Go run it." → DIY AI ops.
- agentplain: "We install. We run. We customize. You stay focused on serving your customers." → Managed AI ops.

This is not a marketing slogan — it's the operational shape of the product, the pricing justification, and the moat against Anthropic's free-tier commoditization of the tool layer.

Why this is the right answer:
1. Anthropic commoditized the TOOL, not the SERVICE. Anthropic isn't a services company.
2. SMB owners are time-starved, not budget-starved. $99-$199/seat is a rounding error vs. the time cost of learning to be an AI ops person.
3. Aligns with the locked mission verbatim — "doing the work" IS service partnership.
4. Vertical-specific knowledge substrate IS the codified service expertise.
5. /custom engagements are the natural extension of the service relationship.

Acceptable framings: "the platform we run for you", "managed AI ops", "your AI ops team", "we install, run, and customize", "service partnership with embedded technology". BANNED: "Self-serve AI platform", "DIY agentic workflows", "Run AI agents in your business" (without "we run them for you"), "Try our tool". We do NOT introduce a freemium tier — that's a tool-company response, not a service-company response.`,
    source: 'memory/project_service_partnership_positioning.md',
    ratified: '2026-05-15',
  },
  {
    slug: 'pricing-three-tier-2026-05-15',
    title:
      "agentplain pricing — three customer-facing tiers (Regular / Partner / Max), ratified 2026-05-15",
    body: `LOCKED 2026-05-15. Supersedes the 2026-05-12 simplified Regular-only model.

THREE customer-facing tiers + a separate /custom path:

REGULAR — $99-$199/seat (ladder by volume). Standard managed AI ops + onboarding bundled in. "We install. We run. We customize standard skills for you."
PARTNER — $199-$299/seat (ladder by volume). Named-service-partner with 4 hrs/mo reserved time. "Same as Regular, plus your named partner with reserved hours each month for skill iteration, deeper integration, and monthly business review."
MAX — AD-HOC quote-based. High-intensity service / multi-state ops / white-label / dedicated team. NOT a fixed published price-per-seat.

Plus /custom for bespoke capability builds ($5K-$15K + $200-$500/mo maintenance). /custom and Max differ in shape: Max = MORE SERVICE INTENSITY at standard skill scope; /custom = BUILD NEW CAPABILITIES we don't have yet. A customer can be on Max AND have a /custom engagement.

Per-tier ladder (verbatim from lib/pricing/tiers.ts):
| Volume      | Regular | Partner | Max   |
| 1 seat      | $199    | $299    | quote |
| 2-9 seats   | $179    | $279    | quote |
| 10-24 seats | $149    | $249    | quote |
| 25-49 seats | $119    | $219    | quote |
| 50-99 seats | $99     | $199    | quote |
| 100+ seats  | enterprise quote | enterprise quote | quote |

First month free across Regular + Partner. Month-to-month from day one. NO per-vertical pricing differentiation. NO freemium tier.

Stripe schema: zero changes required. Regular + Partner Products + Prices already provisioned. Max bills via Stripe Invoices using the existing /custom Products as the invoicing path.

BANNED FRAMINGS: 3-column tier comparisons that mention a "vertical→tier" mapping (the 2026-05-12 simplified model is superseded). Single-tier-Regular-only is also superseded. Always cite the 2026-05-15 ratification when referencing pricing.`,
    source: 'memory/project_stripe_both_surfaces.md',
    ratified: '2026-05-15',
  },
  {
    slug: 'pricing-low-friction-over-margin',
    title: 'Pricing companion rule — low friction over margin (no nickel-and-diming)',
    body: `Companion rule to the three-tier pricing lock. Don't price per-unit on things that cost agentplain pennies. Bundle into the seat fee. Add-ons that have real human-cost are OK; AI-feature paywalls aren't.

Two principles:
1. AI features cost cents — listing copy, room staging, contract drafting, mortgage Q&A, etc. Marginal cost sub-dollar → bundle into the flat seat fee. Use "included" or "free with your seat". Do NOT use per-room / per-photo / per-disclosure unit pricing.
2. Real human services CAN have add-on fees. Pro photography, escrow handling, attorney/title services, premium MLS upgrades, paid social spend — these have real cost-per-unit. Add-on pricing is fine here, transparent, opt-in.

Banned phrases in customer-facing copy: "$X per room" / "$X per photo" / "$X per disclosure" / "Premium feature" / "Upgrade to unlock" for sub-dollar-cost AI capabilities.

Audit checklist for any price-mentioning surface: "is this a real human-cost service or a sub-dollar AI feature?" If AI → bundle into seat fee OR make explicitly free. If human service → add-on, but always opt-in.`,
    source: 'memory/feedback_low_friction_over_margin.md',
    ratified: '2026-04-27',
  },
  {
    slug: 'pricing-max-friction-reduction',
    title: 'Pricing companion rule — max friction reduction for trials',
    body: `Companion rule to the three-tier pricing lock. At the current stage (pre-PMF, hunting for first 20 paid customers), every pricing decision passes the "does this make 'try it' easier or harder?" test. If harder, kill it unless load-bearing for unit economics or compliance.

Locked decisions:
1. NO pilot fees. Period. The $1,500/$2,750/$4,500 pilot model was killed 2026-05-09. Don't propose them again until past 20 paid customers.
2. First month free across all three tiers. Card on file at signup, $0 charged month 1, per-seat kicks in month 2.
3. Month-to-month from day one. No annual lock-in required. Annual SKUs exist as a discount choice, not a default.
4. Self-serve signup, no sales call required.
5. NO credit-card-required-to-see-pricing. Pricing is on the public marketing page.
6. NO minimum-seat requirement. Solo realtor = 1 seat workspace = supported.
7. NO setup fees, NO implementation fees, NO professional services fees for standard onboarding.

Load-bearing (don't kill): per-seat pricing, tier differentiation (Regular/Partner/Max), annual discount, /custom SKU.`,
    source: 'memory/feedback_max_friction_reduction_for_trials.md',
    ratified: '2026-05-09',
  },
  {
    slug: 'brand-plain-not-plane',
    title:
      "Brand meaning — agentplain = agent + the PLAINS (where things take root), never 'plane'",
    body: `LOAD-BEARING 2026-05-15. The brand is agent + the PLAINS — open prairie, heartland, where things take root. The tagline "Intelligence rooted in reality" is the literal metaphor: AI planted in actual local-business soil, not floating in abstract cloud-tech space.

Wrong reads (both rejected):
- "agent + airplane (plane)" — WRONG; never the brand
- "agent + plainspoken/clear/unadorned (plain)" — PARTIAL truth, captures heritage feel but misses the place-and-rooted meaning.

CORRECT: agent + the plains (where things take root). The brand is about AI that is GROUNDED — planted in the actual reality of local business life, in the heartland, in the small towns and cities that aren't Silicon Valley.

Visual marks: default to plains/rooted imagery — horizon line, prairie grass, wheat, lone tree, sunrise over flat horizon, soil cross-section with roots, grain silo, plowed rows, single seed, big sky over flat ground. BANNED: sleek tech logos, abstract gradients, aerial-only imagery, anything that floats away from earth.

Copy voice: heritage, grounded, patient. Say "we put down roots in your business" not "we deploy at scale." Plains/agriculture/heartland metaphors generously: rooted, planted, ground, soil, season, harvest, yield, tend, cultivate, weather, deep. AVOID: cloud, scale, deploy, ship, accelerate, viral, hypergrowth.

Banned framings: "agentplane" (wrong word), "Airplane" / "aviation" / "aircraft", "Plainspoken" as the SOLE meaning, "Cloud-based AI" / "deploy in the cloud" / "scale to the cloud", sleek tech aesthetic visual marks, "Disruption" / "hypergrowth" / "blitzscale", floating / aerial / soaring as standalone metaphors.

Acceptable: "agentplain — AI ops rooted in your reality", "We put down roots in your business", "Intelligence with its feet on the ground", "AI that knows your local ground", "Built for the heartland of small business", "Patient, grounded, partner-style AI ops".`,
    source: 'memory/feedback_brand_is_plain_not_plane.md',
    ratified: '2026-05-15',
  },
  {
    slug: 'mcp-first-integration-architecture',
    title: 'MCP-first integration architecture — every integration is an MCP server',
    body: `LOCKED 2026-05-12. Every customer-facing integration in agentplain is an MCP (Model Context Protocol) server scoped to a customer workspace. Customer clicks "Connect" in the marketplace UI → OAuth flow handled by the per-MCP server → callback wires the credential into a customer-scoped MCP instance. Skills call MCP tools (mcp.call('gmail', 'list_messages', ...)) instead of importing vendor SDKs directly.

The customer experience: "as easy as clicking the plug in in Claude" — Claude's integration model (MCP) is the model. User browses a marketplace, clicks Connect, OAuth happens, done. No per-tool engineering visible to the customer.

What this locks:
1. Skills consume MCP tools, NOT vendor SDKs.
2. Each integration is a separately-scoped MCP server per customer. When customer X connects Gmail, a Gmail MCP instance is provisioned with their OAuth credentials. Customer X's skills call X's Gmail MCP; customer Y's call Y's. No credential sharing across workspaces.
3. The customer-facing marketplace UI (\`app/(app)/workspace/[id]/integrations\`) is the front door.
4. OAuth + credential storage stays in agentplain. \`IntegrationCredential\`, \`WebhookSubscription\`, renewal cron all per PR-B.
5. Adding a new integration = define MCP server tools + register URL + scopes + OAuth config + add marketplace tile + ship. No new agentplain core code per provider.

Migration sequencing:
- Phase A — Convert Gmail to MCP (PR-D scope; shipped).
- Phase B — Outlook + M365 MCP (shipped).
- Phase C — Marketplace UI v1 (shipped 2026-05-17).
- Phase D — Third-party MCP servers (later).
- Phase E — Customer-built MCPs (post-PMF; becomes /custom upsell path).

Banned framings: "We're building 50 OAuth adapters" (wrong; marketplace of MCP servers), "Per-integration engineering" (wrong; new integrations are config + MCP server), "OAuth complexity is what slows us down" (wrong post-marketplace).
Acceptable: "agentplain has a marketplace of MCP-based integrations", "Click Connect → OAuth → done", "Every integration is an MCP server scoped to your workspace", "Built on MCP, the open standard for connecting AI tools to services."`,
    source: 'memory/project_mcp_first_integration_architecture.md',
    ratified: '2026-05-12',
  },
  {
    slug: 'general-on-ramp-coverage',
    title: 'Vertical coverage — 10 ratified verticals + /general on-ramp, never an 11th',
    body: `agentplain serves TEN ratified verticals: real estate, mortgage, insurance, property management, title & escrow, recruiting, home services contractors, CPAs, law firms, RIAs. The ten-vertical lock is policy: adding an eleventh requires a memory ratification, not a code change (\`feedback_no_new_verticals_finish_locked.md\`).

For local businesses OUTSIDE the ten — dentists, salons, restaurants, gyms, plumbers-who-aren't-trades-fleet-shaped, etc. — the on-ramp is \`/general\`. The /general page is honest: same service partnership, lighter scaffolding. The page makes the trade-off explicit:
- REPLACES the universal admin work — inbox triage, scheduling, follow-up, basic documentation.
- INTEGRATES with the tools every local business already runs (Gmail, Outlook, Google Calendar, QuickBooks).
- AUGMENTS the owner's review on every customer-facing draft.
- NO vertical-specific compliance corpus. If you need one, we scope it as a /custom engagement.

Acceptable response patterns when a prospective customer asks "do you serve dentists / salons / restaurants / [non-listed vertical]?":
- "Not as a named vertical, but we have an on-ramp at /general — same service partnership, lighter scaffolding."
- "We serve ten ratified verticals — real estate, mortgage, insurance, property management, title & escrow, recruiting, home services contractors, CPAs, law firms, RIAs — plus a /general on-ramp for local businesses outside those."

BANNED: "We'd love to discuss it!" / "Reach out to talk about it!" — that's a hedging response. The /general on-ramp is the honest answer. If the prospect wants vertical depth that /general doesn't have, route to /custom.`,
    source: 'memory/project_vertical_tier_mapping.md + lib/verticals/general/content.ts',
    ratified: '2026-05-15',
  },
  {
    slug: 'product-design-language',
    title: 'Product UI design language — calm, dense, present-progressive (2026-05-17)',
    body: `Product surface voice (vs. marketing voice): calm, dense, specific, second-person, present-progressive. The visitor has signed up — they don't need to be sold to. They need to feel that their service team is at work for them.

Voice contrasts (marketing → product):
- Subject: "agentplain" / "we" / "the fleet" → "your service team" / "your fleet" / "we" (acting on user's behalf).
- Tense: aspirational present → present-progressive ("Your fleet is drafting the morning replies right now").
- Stance: pitching → reporting + handing back.
- Tempo: long lede → two-line stat + one-line context.
- Punctuation: em dashes earn their keep → same, periods dominate.
- Volume: confident → quiet confident.

One-line test: if a sentence on a product screen would also belong in a homepage hero, it's marketing voice and doesn't belong.

Empty states (ApRootedEmptyState pattern): one image cue, one sentence reporting reality, one sentence telling the user what changes that, one CTA. No exclamation points. No "All clear!" No emoji. ✅ "No drafts in the queue. Your fleet is reading inbox traffic; the first batch usually lands by 9:14am ET. Connect another tool →" ❌ "All caught up! 🎉"

Success messages: report what's been handed off — never celebrate. ✅ "Approved. Three drafts now sit in your Gmail outbox awaiting your send." ❌ "Success!"

Error messages: what failed → what we're doing about it → what the user can do. ✅ "Gmail OAuth expired. We've paused inbound reads; reconnect from Settings → Integrations to resume." ❌ "Oops! Something went wrong."

Loading states: drop "Loading…". Say what is actually happening — "Reading the last 24 hours of inbox traffic…"`,
    source: 'docs/product-design-language-2026-05-17.md',
    ratified: '2026-05-17',
  },
  {
    slug: 'product-readiness-audit-2026-05-17',
    title: 'Product readiness audit 2026-05-17 — DONE bar gated by wiring, not engineering',
    body: `Audit of \`origin/main\` @ 63a966b against the DONE bar: "Customer can sign up → land in branded workspace → connect Gmail → see read/categorize/coordinate/schedule/draft value loop on real inbox → add payment via Stripe."

Status as of 2026-05-17:
- Sign-up, branded workspace, Stripe trial provisioning, OAuth connect, MCP servers — BUILT and shippable.
- Three-tier sign-up + billing settings (Regular/Partner/Max) — BUILT.
- The middle of the loop is DEAD in production: \`processWebhookEventFn\` is the only Inngest function that drains \`WebhookEvent\` rows and invokes the skill chain, but it is (a) NOT registered in \`app/api/inngest/route.ts\` and (b) has no cron trigger.
- Onboarding lets customers finish without connecting anything — \`connect_integration\` step does NOT link to /integrations.
- Approvals page has UI but \`workApprovalQueueItem.create\` has ZERO callers; queue is permanently empty.
- Agents page hardcodes realty fleet — not vertical-aware (a CPA workspace sees realty agent slugs).
- Marketing /pricing on agentplain.com is BEHIND main — still showing the 2026-05-12 single-tier surface; the 3-tier landed in code but hasn't deployed.

Smallest PR that closes the DONE bar (~50 lines): (1) register \`processWebhookEventFn\` in the Inngest serve route, (2) add a cron trigger (every 2 minutes is the natural Gmail Pub/Sub freshness floor), (3) wire \`HandoffLogEntry\` writers in the runner so the workspace overview's "What's running now" populates. After that the value loop runs on real inbound mail, drafts land in Gmail Drafts, and the customer can verify with their own eyes.

The DONE bar is gated by WIRING, not engineering. The hard work — auth, OAuth, MCP servers, skill chain, billing, schema, RLS, vertical fleet of prompts — is done.`,
    source: 'docs/product-readiness-audit-2026-05-17.md',
    ratified: '2026-05-17',
  },
  {
    slug: 'overnight-product-build-2026-05-18',
    title:
      'Overnight product build 2026-05-18 — Waves A→D shipped; value loop closes on live preview',
    body: `Overnight build status as of 2026-05-18 (branch \`feat/product-overnight-2026-05-17\` @ ad48a33 + Wave D docs):

The customer-facing product surface is now whole: marketing → /app/sign-up (vertical + tier picker) → magic-link → workspace landing → onboarding → integrations → activity → approvals → settings/billing all render on a single Wave-A2 design-system foundation (Ap* primitives) with Wave-B service-partnership voice applied across every surface and Wave-C polish on empty states, errors, loaders, mobile and a11y.

Wave status:
- A1 (close end-to-end value loop — Inngest cron + handoff/approval writers + onboarding link + approvals UI) — merged.
- A1-fix-a (move /app/verify to a Route Handler so writeSession can set cookies) — on branch.
- A1-fix-b (tighten verify error classifier so 'Invalid or expired link' resolves to 'invalid') — on branch, verified live.
- A2 (visual foundation — 10 Ap* primitives + canonical chrome) — on branch.
- B (apply Ap* primitives + service-partnership voice across every customer surface) — on branch.
- C (rooted empty states, calm errors, contextual loaders, mobile + a11y sweep) — on branch.
- D (E2E verification on Vercel preview + handoff doc + screenshots) — shipped.

The auth flow's verify cookie-write bug from earlier in the week (digest 2234350772) is FIXED: verify is now a Route Handler and the error classifier correctly resolves "Invalid or expired link" to ?reason=invalid. Sign-up form submission against the live Vercel preview creates the WorkspaceMember and queues a real magic-link send — proving the end-to-end value loop is wired.

3-tier picker is the same shape on sign-up and settings/billing. Regular / Partner / Max — Max routes to /custom?type=max.`,
    source: 'docs/overnight-product-build-handoff-2026-05-18.md',
    ratified: '2026-05-18',
  },
];

// ── Public assembly ─────────────────────────────────────────────────────

export interface SeedAssembly {
  skill: KnowledgeUpsertInput[];
  vertical: KnowledgeUpsertInput[];
  compliance: KnowledgeUpsertInput[];
  /** Platform-wide doctrine: positioning, pricing, brand, MCP-first
   *  architecture, mission, design-language, readiness audit, build
   *  handoffs. CROSS_CUSTOMER kind per `docs/knowledge-substrate.md`. */
  crossCustomer: KnowledgeUpsertInput[];
  /** Diagnostics carried through for the seed script + tests. */
  diagnostics: {
    skippedUnverifiedCompliance: number;
    verifiedComplianceByVertical: Record<string, number>;
    unverifiedComplianceByVertical: Record<string, number>;
  };
}

export function buildSeedAssembly(): SeedAssembly {
  const skill: KnowledgeUpsertInput[] = [
    ...SKILL_CORPUS.map<KnowledgeUpsertInput>((s) => ({
      contextKind: 'SKILL',
      workspaceId: null,
      sourceType: 'skill_doc',
      sourceId: `skill:${s.slug}`,
      title: s.title,
      body: s.body,
      metadata: { skillSlug: s.slug },
    })),
    ...ARCHITECTURE_CORPUS.map<KnowledgeUpsertInput>((a) => ({
      contextKind: 'SKILL',
      workspaceId: null,
      sourceType: 'architecture-doc',
      sourceId: `architecture:${a.slug}`,
      title: a.title,
      body: a.body,
      metadata: { doc: a.source, section: a.section },
    })),
  ];

  // Include the /general on-ramp so a customer query like "do you serve
  // dentists?" can retrieve the on-ramp answer rather than a generic
  // miss. The registry separates on-ramps from `getAllVerticals()` for
  // surface enumeration reasons; for substrate ingest we want both.
  const vertical: KnowledgeUpsertInput[] = [];
  for (const v of getAllVerticalsIncludingOnRamps()) {
    vertical.push(...chunkVertical(v));
    vertical.push(...buildJtbdSynthesisRows(v));
  }

  const corpusBuild = buildComplianceCorpus();

  const compliance: KnowledgeUpsertInput[] = [
    ...COMPLIANCE_CORPUS.map<KnowledgeUpsertInput>((c) => ({
      contextKind: 'COMPLIANCE',
      workspaceId: null,
      sourceType: 'compliance_doc',
      sourceId: `compliance:${c.verticalSlug}:${c.slug}`,
      title: c.title,
      body: c.body,
      sourceUrl: c.sourceUrl,
      verticalSlug: c.verticalSlug,
      metadata: { complianceSlug: c.slug },
    })),
    ...corpusBuild.rows,
  ];

  const crossCustomer: KnowledgeUpsertInput[] = DOCTRINE_CORPUS.map<KnowledgeUpsertInput>(
    (d) => ({
      contextKind: 'CROSS_CUSTOMER',
      workspaceId: null,
      sourceType: 'doctrine-doc',
      sourceId: `doctrine:${d.slug}`,
      title: d.title,
      body: d.body,
      metadata: { doc: d.source, ratified: d.ratified, slug: d.slug },
    }),
  );

  return {
    skill,
    vertical,
    compliance,
    crossCustomer,
    diagnostics: {
      skippedUnverifiedCompliance: corpusBuild.skippedUnverified,
      verifiedComplianceByVertical: corpusBuild.verifiedByVertical,
      unverifiedComplianceByVertical: corpusBuild.unverifiedByVertical,
    },
  };
}

export const SEED_COUNTS = (() => {
  const a = buildSeedAssembly();
  return {
    SKILL: a.skill.length,
    VERTICAL: a.vertical.length,
    COMPLIANCE: a.compliance.length,
    CUSTOMER: 0,
    CROSS_CUSTOMER: a.crossCustomer.length,
  };
})();
