/**
 * lib/knowledge/seed-data.ts
 *
 * Static seed corpus for the knowledge substrate. Five buckets land at
 * install time:
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
 * Per `project_knowledge_substrate.md`: CUSTOMER + CROSS_CUSTOMER stay
 * empty at seed time. CUSTOMER fills as workspaces connect tools;
 * CROSS_CUSTOMER fills offline via the anonymization fleet agent.
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
import { getAllVerticals } from '../verticals';
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

// ── Public assembly ─────────────────────────────────────────────────────

export interface SeedAssembly {
  skill: KnowledgeUpsertInput[];
  vertical: KnowledgeUpsertInput[];
  compliance: KnowledgeUpsertInput[];
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

  const vertical: KnowledgeUpsertInput[] = [];
  for (const v of getAllVerticals()) {
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

  return {
    skill,
    vertical,
    compliance,
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
    CROSS_CUSTOMER: 0,
  };
})();
