# Connections: what you bring vs what we bring

_Last updated: 2026-06-17_

agentplain plugs into a lot of moving parts. Some of them are **yours** — your
own software accounts that you already pay for. Others are **ours** — vendor
accounts we run on your behalf so you never have to think about them. The line
between those two is the single most important thing to be honest about, because
it decides **who pays**.

This document is the source of truth for that split. It maps to the code in
`lib/integrations/`:

| Concept | Code |
| --- | --- |
| The split itself (types, labels) | `lib/integrations/sourcing.ts` |
| Customer-Brought framework | `lib/integrations/byo/` |
| We-Bring framework | `lib/integrations/wb/` |
| Unified catalog + classifier | `lib/integrations/connection-catalog.ts` |
| Cost attribution (dashboard data) | `lib/integrations/cost-attribution.ts` |
| Migration / audit script | `scripts/classify-connections.ts` |

---

## The two buckets

### You bring (BYO — Customer-Brought)

**You own the account. You pay your own vendor. agentplain charges $0 for the
connection.**

You authorize the connection — either an OAuth grant or an API key you paste in
— and you keep your existing relationship (and bill) with that vendor. We read
what you point us at and write back drafts/notes/tags, always behind your
approval. If you disconnect, your grant and the data we ingested through it are
removed; your vendor account is untouched.

Examples: **Gmail, Google Calendar, Outlook; HubSpot, Salesforce, Notion,
Follow Up Boss, Sierra, Buildium, kvCORE, BoldTrail, AppFolio; QuickBooks,
TaxDome, Karbon; Clio, MyCase; DocuSign; your own Stripe account (for your
billing); a custom domain for a branded portal.**

Optional BYO power-user paths (Max / Custom, pending Conner): **your own
Anthropic/OpenAI key** (hosted-by-you reasoning) and **your own S3 bucket**
(bring-your-own memory storage).

Every BYO connection is, by definition, a **marketplace tile** — see
`lib/integrations/marketplace.ts`. The classifier enforces this: a tile can
never declare itself we-bring.

What the BYO framework gives each connection:

- **Scope grants** — you choose how much each connection may _do_: read-only,
  read + write back, or read + write with approval required. The default is the
  safe ceiling; nothing originates an outbound-shaped action before you opt in.
  (`lib/integrations/byo/scope-grants.ts`)
- **Auth state / health** — connected, renewing, reconnect-needed, disconnected.
  (`lib/integrations/byo/auth-state.ts`)
- **Rotation reminders** — pasted API keys get a 90-day nudge to rotate (OAuth
  refreshes itself, so it never needs one). (`lib/integrations/byo/rotation.ts`)
- **Revocation** — one tap removes the credential and the data we ingested; the
  audit trail stays. (`lib/integrations/byo/revocation.ts`)

### We bring (We-Bring)

**We own the vendor account. You never see a login.** Cost is one of two models:

- **Included** — absorbed into your subscription. You're never charged for usage;
  we surface usage on the costs page only for transparency. A high soft
  fair-use cap protects against pathological abuse (it flags a tier
  conversation, it does not bill you).
- **Pass-through** — metered onto your agentplain invoice at our cost, because
  the spend scales with how much _you_ use it, not with us. Today this is only
  **Twilio voice minutes + phone numbers**.

| Service | Cost model | Why |
| --- | --- | --- |
| Claude (reasoning / Anthropic API) | Included | Flat, predictable pricing; per-workspace token budgets guard runaway spend. Max tier _may_ pass through (pending Conner). |
| Search embeddings (OpenAI) | Included | Cheap relative to the LLM, roughly one-time per document. High soft cap catches re-index loops. |
| Voice synthesis (ElevenLabs) | Included | Shared brand voices keep onboarding zero-config; soft character cap flags outliers. |
| Phone & voice minutes (Twilio) | **Pass-through** | Real per-minute carrier cost that scales with the customer. Passed through so heavy callers pay their own way. |
| System email (Resend) | Included | Volume bounded by how much the product emails. You may attach your own domain at no cost. |
| Hosting & database (Vercel, Neon, Inngest) | Included | Fixed platform cost shared across all workspaces; not per-customer attributable. |
| Compliance & vertical knowledge corpora | Included | A built asset, not a per-use cost — a core reason agentplain exists on top of Claude. |
| Plaino & the orchestration runtime | Included | Our own software and persona; no external vendor cost. |

The We-Bring framework gives:

- **Per-customer usage meter** — Twilio minutes, ElevenLabs characters,
  embedding tokens, etc. (`lib/integrations/wb/meter.ts`)
- **Pass-through billing** — maps metered usage to Stripe meter events, at our
  cost (with an optional markup Conner sets). (`lib/integrations/wb/passthrough.ts`)
- **Fair-use limits** — soft caps on absorbed services.
  (`lib/integrations/wb/fair-use.ts`)
- **Observability** — which customer is burning which we-bring service.
  (`rankConsumers` in `lib/integrations/wb/meter.ts`)

---

## Why we drew the line here

The split is not arbitrary. A service is **we-bring** when one of these is true:

1. **The customer cannot reasonably own the account.** The reasoning model, the
   orchestration runtime, the knowledge corpora — these _are_ agentplain. There
   is no "your Claude account" to bring (unless you're a power user who wants to;
   that's the optional BYO-LLM path).
2. **Owning it would add friction with no benefit.** Making every customer
   create their own Resend/embedding account would wreck the zero-config promise
   for a few cents of cost.

A service is **pass-through** (rather than absorbed) when its cost **scales with
the individual customer's usage and is large enough to matter** — i.e. Twilio
minutes. Absorbing that would mean light callers subsidize heavy callers, and a
single heavy caller could erase our margin. So it rides the customer's own
invoice at our cost.

Everything else a customer already owns and pays for — their CRM, their email,
their accounting — stays **BYO**. We don't resell software; we make the software
you already have do more.

---

## Transparency promises

- **You always know who pays.** Every connection shows its bucket and cost model
  on the connections page; everything that can touch your invoice is itemized on
  the connection-costs page.
- **Included means included.** We never quietly bill you for an "included"
  service. If usage is ever high enough to matter, you get a tier conversation,
  not a surprise line item.
- **Pass-through means at cost** (unless we explicitly tell you a markup and
  why). The default is flat pass-through at our cost.
- **No fabricated numbers.** Services we run for you that don't yet have a
  per-customer meter show "no usage recorded yet" rather than an estimate.

---

## Migration / classification

`scripts/classify-connections.ts` prints the full unified catalog and runs the
classifier, which warns on misclassification (a tile tagged we-bring, an id
collision across the split, a we-bring vendor that leaked into the marketplace,
or an internally inconsistent cost model). The shipped catalog produces **zero
warnings**, enforced by `lib/integrations/connection-catalog.test.ts`. Run it any
time the catalog changes:

```bash
npx tsx scripts/classify-connections.ts
```
