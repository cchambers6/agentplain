# Connector skill discipline — conversion template (2026-08-01)

HubSpot (`lib/integrations/hubspot-mcp/`) is the first connector converted to the
Chiron-style skill discipline. It is the template for the rest. This document is
the recipe.

## The discipline

A converted connector carries four things: **(a)** an explicit input contract as
a zod schema, **(b)** an explicit output contract as a zod schema, **(c)** a
validation test proving known input produces known output, and **(d)** whatever
idempotency it claims, asserted against what the code actually does.

The rule comes from Chiron's Integrator (`chiron/lib/agents/integrator/schema.ts`):
*nothing is persisted until it parses.* At a connector the boundary is a vendor
API rather than a model, but the failure mode is identical — the two values a
connector handles (agent-authored arguments going out, vendor JSON coming back)
are exactly the two values TypeScript never sees. Interfaces are erased at
runtime; they cannot stop an empty id, a `limit` of 500, a garbage timestamp, or
a HubSpot response whose shape changed last Tuesday. Runtime contracts can, and
they fail at the boundary instead of three layers downstream.

Requirement (c) exists because a typecheck proves the code compiles, not that it
works. A validation test asserts literal outputs for literal inputs, asserts that
invalid input never reaches the vendor, and asserts that the approval gate still
blocks outbound through the new surface.

Requirement (d) exists because "idempotent" is usually an assumption. Read the
gate/store source and assert the semantic that is really implemented. For the
connector approval gate the answer today is: `check()` validates workspace,
action, payload fingerprint, status and expiry, and does **not** consume the
grant — so an identical replay carrying the same token fires the write again.
The gate gives at-least-once authorization bound to an exact payload, not
at-most-once delivery. De-duplication, where a caller needs it, lives above the
seam.

## Before / after — hubspot-mcp

```
BEFORE                              AFTER
hubspot-mcp/                        hubspot-mcp/
  actions/                            actions/                  (untouched)
  auth.ts                             auth.ts                   (untouched)
  index.ts                            index.ts                  (+ skill exports only)
  server.ts                           server.ts                 (untouched)
  test-server.ts                      test-server.ts            (untouched)
  to-lead-record.ts                   to-lead-record.ts         (untouched)
  tools.ts                            tools.ts                  (untouched)
  types.ts                            types.ts                  (untouched)
  with-approval.ts                    with-approval.ts          (untouched)
  *.test.ts                           *.test.ts                 (untouched)
                                      skill/                    NEW
                                        contracts.ts            NEW
                                        skill.ts                NEW
                                        skill.validation.test.ts NEW
```

Plus one shared file outside the connector: `lib/integrations/skill-core.ts`.

Added: 15 action input schemas, 15 output schemas, three DTO schemas, a
discriminated-union envelope keyed on the same snake_case action names the
approval gate and tool registry already use, a single `runHubspotSkill` entry
point, and a validation test.

Not touched: every existing file above. The conversion is additive — the legacy
server shape keeps working, and callers migrate when they migrate.

## The shared core

`lib/integrations/skill-core.ts` is written once and reused by every conversion:

- `ConnectorSkillResult<T>` / `ConnectorSkillError` with four codes —
  `INVALID_INPUT`, `APPROVAL_REQUIRED`, `UPSTREAM_ERROR`, `CONTRACT_VIOLATION`.
- `parseContract(schema, value, 'input' | 'output')` — input failures become
  `INVALID_INPUT`, output failures become `CONTRACT_VIOLATION`. The message
  summarizes zod issues as `path: code` pairs only; received values are excluded
  because connector payloads carry PII and tokens and this message is logged.
- `fromMcpError(err)` — `APPROVAL_REQUIRED` passes through as its own code (a
  caller must be able to tell "a human has to approve this" from "the vendor is
  down"); everything else becomes `UPSTREAM_ERROR` with the original
  `McpErrorCode` in `reference`.

Do not fork this file per connector.

## Conversion checklist

Worked example for the next one: `lib/integrations/follow-up-boss-mcp/`
(11 methods: `listLeads`, `getLead`, `createNote`, `addTag`, `listPipelines`,
`getPipelineStage`, `listUsers`, `listLeadLists`, plus the gated
`createLead`, `sendTextTemplate`, `scheduleActionPlan`).

1. **Enumerate the server interface.** Every method on `FollowUpBossMcpServer`
   in `types.ts`, plus the write-action I/O types in `actions/index.ts`. The
   action-name strings come from the gate descriptors, not from new invention.
2. **Write `skill/contracts.ts`.** One input and one output schema per method,
   with the constraints the interfaces could not express (`z.string().min(1)`
   for ids, `z.number().int().min(1).max(100).optional()` for `limit`,
   `z.iso.datetime({ offset: true })` for instants, closed `z.enum` for the TS
   unions). Add the `Mutual<z.infer<typeof schema>, LegacyInterface>` drift
   guard per action so the runtime contract cannot diverge from the legacy
   interface while both exist. Close with the `action` + `params`
   discriminated-union envelope and its output twin. Leave objects in zod's
   default strip mode — unknown keys are then dropped before the server sees
   them.
3. **Write `skill/skill.ts`.** Parse input first (the server must be untouched
   on invalid input), exhaustive `switch` on the discriminant with a `never`
   check in `default`, map failures through `fromMcpError`, parse every success
   against that action's output schema before returning it.
   `build<Connector>Skill({ workspaceId, deps })` — the helper that closes over
   the connector's factory so the gated server is the only one obtainable
   through the skill — goes in the connector **barrel** (`index.ts`), beside the
   factory it wraps, NOT in `skill/skill.ts`: the barrel re-exports the skill,
   so a factory import from inside `skill/` would create a module cycle.
4. **Write `skill/skill.validation.test.ts`** (node:test + `assert/strict`,
   `INTEGRATIONS_PROVIDER=test`, in-memory gate + audit sink). Eight proof
   categories: known input → known output for a list; the same for a get; read
   idempotency; invalid input never reaches the server (plus one structural
   case, e.g. unknown action); the gate blocks an outbound action through the
   skill with zero recorded calls and an empty audit sink; an approved write
   runs, parses, and records the exact payload; the replay semantic asserted
   against the gate source; a malformed vendor response yields
   `CONTRACT_VIOLATION` and never leaks the unparsed value.
5. **Export from the connector barrel** — `run<X>Skill`, `build<X>Skill`,
   `<X>_SKILL_NAME`, the input schema, and the inferred input/output types.
   Append only; leave existing exports alone.
6. **Acceptance:** validation test green, `tsc --noEmit` green, and `git status`
   shows only the new files plus the barrel append. Any diff to an existing
   file that is not the barrel means the conversion stopped being additive.

## Non-goals

- No mass migration in one PR. One connector per PR.
- The old shape stays until every caller has moved. The skill surface is
  additive; deleting the legacy interfaces is a separate, later decision.
- Generating `tools.ts` JSON schemas from the zod contracts is an obvious
  follow-up (the two currently state overlapping constraints in two places) but
  it is **not** part of a conversion PR — it changes the shipped MCP tool
  surface, which is a different blast radius.
- No behavior changes to the connector while converting. If a contract exposes a
  real bug in the server, file it; do not fix it in the conversion PR.

## Inventory

Connector directories eligible for conversion, in `lib/integrations/`:

`appfolio-mcp`, `boldtrail-mcp`, `buildium-mcp`, `clio-mcp`, `docusign-mcp`,
`encompass-mcp`, `excel-mcp`, `ezlynx-mcp`, `follow-up-boss-mcp`, `gmail-mcp`,
`google-calendar-mcp`, `google-drive-mcp`, `hubspot-mcp` (done), `karbon-mcp`,
`kvcore-mcp`, `mycase-mcp`, `notion-mcp`, `onedrive-mcp`,
`outlook-calendar-mcp`, `outlook-mcp`, `qualia-mcp`, `quickbooks-mcp`,
`salesforce-mcp`, `sierra-mcp`, `slack-mcp`, `taxdome-mcp`, `teams-mcp`.

Suggested order: the connectors with live write actions and real customer
traffic first (`follow-up-boss-mcp`, `salesforce-mcp`, `docusign-mcp`,
`quickbooks-mcp`), scaffolds last.
