# `lib/skills/` — the agentplain value loop

PR-C scaffolding. Ships behind mock data; the moment Conner's Gmail is
OAuth-connected, the same chain runs against live `WebhookEvent` rows.

This doc explains:

1. The five skills that make up the value loop and how they compose
2. The adapter pattern (`MessageFetcher`, `DraftPersister`, `LlmProvider`)
3. How per-vertical prompts route the same email differently per workspace
4. How to extend the loop with new skills
5. How to swap prompts or providers without touching skill code

## The loop

```
WebhookEvent  →  read  →  categorize
                            │
                            ├──→ noise / transactional / vendor   →  mark processed
                            │
                            ├──→ lead                              →  mark processed
                            │       (surfaces to operator queue
                            │        without an auto-draft)
                            │
                            ├──→ scheduling-needed                 →  coordinate → schedule → draft
                            │
                            └──→ draft-needed                      →  coordinate → draft
```

Five skills, one runner. Each skill is a small adapter under the
`ISkill<TInput, TOutput>` contract. Skills do not know about each other;
`lib/skills/runner.ts` is the only file that owns the conditional logic.

| Skill | File | Output |
|---|---|---|
| read | `lib/skills/read.ts` | `ParsedMessage[]` (Gmail-shape decoded) |
| categorize | `lib/skills/categorize.ts` | `Categorization` (intent + confidence + reason) |
| coordinate | `lib/skills/coordinate.ts` | `ThreadContext` (summary + cross-thread refs) |
| schedule | `lib/skills/schedule.ts` | `SchedulingProposal` (proposed slots, business-hour-filtered) |
| draft | `lib/skills/draft.ts` | `DraftReply` (subject + body + Gmail draft id) |

## Adapter ports

Three swappable ports keep `lib/skills/` provider-neutral. Per
[`feedback_no_silent_vendor_lock.md`](../%7E/.claude/projects/C--agentplain/memory/feedback_no_silent_vendor_lock.md)
and [`project_living_portable_architecture.md`](../%7E/.claude/projects/C--agentplain/memory/project_living_portable_architecture.md):

### `LlmProvider` — `lib/llm/types.ts`
- Production: `AnthropicProvider` (`lib/llm/anthropic-provider.ts`)
- Test: `TestLlmProvider` (`lib/llm/test-provider.ts`) — canned + heuristic
- Selection: `getLlmProvider()` reads `LLM_PROVIDER` env (`test` forces test
  mode) and `ANTHROPIC_API_KEY` (presence routes to production). Absent both
  → heuristic test provider, so the loop is exercisable in any environment.

### `MessageFetcher` — `lib/skills/types.ts`
- Production: `GmailMessageAdapter` (`lib/skills/gmail-fetcher.ts`) — calls
  `gmail.users.history.list` + `gmail.users.messages.get`
- Test: `FixtureMessageFetcher` (`lib/skills/fixture-fetcher.ts`) — reads
  from the corpus in `tests/fixtures/webhook-events/`.

### `DraftPersister` — `lib/skills/types.ts`
- Production: `GmailMessageAdapter` (same class, implements both ports —
  shares the auth + client).
- Test: `RecordingDraftPersister` (`lib/skills/draft.ts`) — captures calls
  in memory; tests assert on `.calls`.

The two-implementation rule (per
[`feedback_runner_portability.md`](../%7E/.claude/projects/C--agentplain/memory/feedback_runner_portability.md))
is satisfied for each port; new providers (M365, OpenAI) slot in without
touching skill code.

## Per-vertical prompts

`lib/skills/prompts/` holds one bundle per locked vertical (10 total).
Each bundle is built from `lib/skills/prompts/shared.ts` templates +
vertical-specific inputs (audience noun, noise/lead/scheduling
signals, draft tone, grounding citation).

```ts
import { getPromptBundleByEnum } from '@/lib/skills/prompts/index';

const prompts = getPromptBundleByEnum(workspace.vertical); // → VerticalPromptBundle
```

The runner looks up by `workspace.vertical` (Prisma enum) on each fire.
The same inbound message → different categorization depending on the
workspace's vertical (see `tests/skills-loop-e2e.test.ts` divergence
assertion).

Per-vertical pieces:

| Vertical | File | Notable rules |
|---|---|---|
| Real estate | `real-estate.ts` | Casual tone; defers price specifics to operator |
| Mortgage | `mortgage.ts` | Formal; never quotes rates / APR / LTV in drafts |
| Insurance | `insurance.ts` | Formal; never quotes premium / coverage limits |
| Property management | `property-management.ts` | Casual; defers maintenance ETAs |
| Title / escrow | `title-escrow.ts` | Formal; wire-fraud guardrails baked in |
| Recruiting | `recruiting.ts` | Casual; never quotes comp / offer details |
| Home services | `home-services.ts` | Casual; emergency-aware acknowledgement |
| CPA | `cpa.ts` | Formal; never states tax position or refund amount |
| Law | `law.ts` | Formal; UPL-aware; deadlines acknowledged explicitly |
| RIA | `ria.ts` | Formal; never recommends specific securities |

## Extending the loop

### Add a new skill
1. Define inputs + outputs in `lib/skills/types.ts`.
2. Implement `ISkill<TInput, TOutput>` in `lib/skills/<name>.ts`.
3. Add the skill to the runner's chain in `lib/skills/runner.ts`.
4. Wire any new system prompt into `lib/skills/prompts/shared.ts` and
   the per-vertical bundles in `lib/skills/prompts/<slug>.ts`.
5. Add fixtures to `tests/fixtures/webhook-events/_corpus.ts` and
   assertions to `tests/skills-loop-e2e.test.ts`.

### Add a new vertical
1. Add the enum value to `prisma/schema.prisma` (`Vertical` enum).
2. Add the content file to `lib/verticals/<slug>/content.ts`.
3. Add the prompt bundle to `lib/skills/prompts/<slug>.ts`.
4. Register the bundle in `lib/skills/prompts/index.ts`.
5. Add at least one fixture per relevant category to the corpus.

### Swap LLM providers
1. Implement `LlmProvider` in `lib/llm/<provider>.ts`.
2. Branch in `buildProvider()` in `lib/llm/index.ts` on the env var.
3. Add a contract test that runs both implementations through the same
   assertions (mirrors `lib/integrations/__tests__/contract.test.ts`).

### Swap MessageFetcher / DraftPersister
1. Implement the interface in `lib/skills/<provider>-fetcher.ts`.
2. Wire it in `lib/inngest/functions/process-webhook-event.ts` (replace
   `GmailMessageAdapter`).
3. The skill chain is unchanged.

## The no-outbound contract

Per [`project_no_outbound_architecture.md`](../%7E/.claude/projects/C--agentplain/memory/project_no_outbound_architecture.md),
`lib/skills/` produces proposals; the customer's system executes. The
contract is enforced at three layers:

1. **Interface shape.** `DraftPersister.persistDraft` is the ONLY write
   method. There is no `send`. Adding one would require an interface
   change visible in code review.
2. **Schedule skill.** Returns `SchedulingProposal`. No calendar method
   on its surface.
3. **Draft skill.** Persists via `gmail.users.drafts.create`. The
   `GmailMessageAdapter` deliberately does not expose
   `gmail.users.messages.send`.

The e2e test asserts the recording persister sees zero calls for noise
/ transactional / vendor / lead intents, and that low-confidence
drafts (< 0.5) are generated but not persisted.

## Path from "PR lands" to "real value loop runs"

```
PR-C (this PR)                            ← scaffolding + mock validation
   │
   ├─ Conner sets ANTHROPIC_API_KEY in Vercel env
   │
   ├─ Conner completes Google Cloud Project setup
   │     (Pub/Sub topic, OAuth client, service account)
   │
   ├─ Conner OAuth-connects connerchambers6@gmail.com
   │     → IntegrationCredential row written, WebhookSubscription ACTIVE
   │
   ├─ First inbound email lands on the Gmail mailbox
   │     → Pub/Sub push → app/api/webhooks/google/route.ts
   │     → WebhookEvent row written (processed=false)
   │
   ├─ PR-D adds cron trigger to lib/inngest/functions/process-webhook-event.ts
   │     → Inngest fires every 5 minutes
   │     → reads unprocessed WebhookEvent rows
   │     → runs the skill chain (this PR's code)
   │     → writes JSONL log to agent-state/skill-runs/
   │
   └─ Functional acceptance test:
         24-hour dogfood run on connerchambers6@gmail.com,
         per-event pass/fail rows in agent-state/integrations_audit_log.md.
         When the read+categorize+coordinate+schedule+draft chain produces
         sensible output across the real inbox, PR-C's premise is validated.
```

## Run logs

`lib/skills/runner.ts` appends a JSONL row per run to
`agent-state/skill-runs/YYYYMMDD.jsonl`. Schema is `SkillRunRecord` in
`lib/skills/types.ts`. The operator audit log
(`agent-state/integrations_audit_log.md`) references these JSONL files
when the PR-D dogfood acceptance test is recorded.
