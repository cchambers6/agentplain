# Copy-reframe guidance for in-flight tasks (2026-05-15)

**Source:** copy-reframe worktree `kind-shirley-103c34`
**Branch landing:** `feat/copy-reframe-service-partnership-2026-05-15-kind-shirley`
**Trigger:** Service-partnership lock + three-tier pricing ratified 2026-05-15.
**Audience:** any worktree touching customer-facing marketing copy that lands AFTER this PR.

## Why this doc exists

This worktree reframes the customer surface around two locks ratified 2026-05-15:

1. **Service-partnership lock.** agentplain is a service partnership that installs, runs, and customizes AI ops — NOT a self-serve AI platform.
2. **Three-tier pricing.** Regular (standard partnership), Partner (named-partner overlay), Max (ad-hoc partnership). /custom remains a separate engagement track for bespoke work outside the tier ladder.

Other worktrees in flight at the same time are working on adjacent surfaces. To keep the marketing surface coherent when those PRs land, the changes below describe what to apply, what to NOT touch in their files (because we own it), and where to find the canonical copy.

## In-flight worktrees and their files

| Worktree | Owns | Status when this PR landed |
|---|---|---|
| `local_93d46579` | `app/(marketing)/custom/page.tsx` | In flight — touches /custom hero + body |
| `local_6a551300` | `app/(marketing)/[vertical]/page.tsx` | In flight — touches per-vertical pages |
| `local_1b9780b8` | `components/CustomInquiryForm.tsx` | Shipped to its branch |
| (shipped) | `app/(operator)/operator/inquiries/*` | Shipped (operator-side) |
| (shipped) | `lib/custom-inquiry/*` | Shipped |
| (shipped) | `prisma/schema.prisma` Inquiry model | Shipped |

## What changed on the customer surface (this PR)

If your branch is rebasing onto a base that includes this PR, you will see these files diverged:

- `app/(marketing)/page.tsx` — full service-partnership reframe + three-tier pricing block + Q9 second CTA
- `app/(marketing)/about/page.tsx` — service-partnership thesis + flatsbo dogfood reframe + "not a self-serve AI platform" entry
- `app/(marketing)/pricing/page.tsx` — full rewrite under three-tier service-partnership lock
- `app/(marketing)/verticals/page.tsx` — light reframe (hero + Section copy)
- `components/FAQ.tsx` — 5 new entries, 8 rewritten, 2 unchanged
- `components/Footer.tsx` — brand paragraph + bottom-strip micro-copy

We did NOT touch:

- `app/(marketing)/custom/page.tsx` (you own this)
- `app/(marketing)/[vertical]/page.tsx` (you own this)
- `components/CustomInquiryForm.tsx` (just shipped)
- `app/(operator)/operator/inquiries/*` (just shipped)
- `lib/custom-inquiry/*` (just shipped)
- `prisma/schema.prisma` Inquiry model (just shipped)

## Required edits in the in-flight files

### `app/(marketing)/custom/page.tsx` (worktree `local_93d46579`)

Last-seen content at audit time included:

- Line 54: "Adds a managed-service overlay on top of the standard **self-serve product**."
  - Replace "self-serve product" with "Regular service partnership."
  - Rationale: under the service-partnership lock, the standard product is itself a service partnership. There is no self-serve product to overlay onto.
- Line 138: "Regular ($199 → $99 per seat) covers **plug-and-play** across all ten verticals."
  - Replace "plug-and-play" with "standard service partnership."
  - Rationale: "plug-and-play" is the retired single-tier framing; the new framing is partnership tiers (cadence + dedication), not self-install vs. managed.

Additional guidance for /custom hero/body:

- /custom is **engagement** work — written spec, 4–6 week build, fixed price, then handoff.
- /custom is **NOT** a fourth tier. The three tiers are Regular / Partner / Max; /custom sits orthogonal to all three.
- Clarify the contrast with Max in copy. Recommended one-liner: "Max is a service-partnership tier with non-standard scope. /custom is engagement work against a written spec. You can be on Regular or Partner AND have a /custom engagement at the same time."

### `app/(marketing)/[vertical]/page.tsx` (worktree `local_6a551300`)

Vertical pages must surface three tiers, not one. Wherever the page currently says "Regular per-seat plan" or "$199 → $99 covers every vertical," update to:

- "Three service-partnership tiers cover every vertical — Regular $199 → $99 / Partner $299 → $199 / Max quoted to scope."
- The tier choice is **about cadence and depth of partnership, not which vertical you're in**. (Same per-vertical content; different per-tier service shape.)

Banned framings to remove from every vertical page:

- "self-serve" / "DIY" / "configure your agents" (customer-as-operator)
- "plug-and-play" as the framing of standard
- Single-tier "Regular per-seat plan" without naming Partner and Max

Required additions:

- A short sentence framing the service partner for that vertical. E.g. "Your service partner brings the [vertical-specific compliance corpus / integration set / case archetypes] to the install — you don't load it yourself."

### `components/CustomInquiryForm.tsx` (worktree `local_1b9780b8`)

Shipped — should already be using service-led intake language. If any form copy still says "Try our platform" or "Configure your fleet," route it through the audit rubric in `docs/customer-surface-audit-2026-05-15.md`.

## Canonical source-of-truth (for any future copy work)

- **Mission / Vision / Tagline** — `memory/project_agentplain_mission_and_positioning.md`. Locked verbatim. Do not rewrite.
- **Service-partnership lock** — spec passed to worktree `kind-shirley-103c34` 2026-05-15 (memory file `project_service_partnership_positioning.md` NOT yet written; flag this as a memory PR before any further reframe).
- **Three-tier pricing** — `memory/project_stripe_both_surfaces.md`. Note: the file's CURRENT section still describes the simplified single-tier model from 2026-05-12. The HISTORICAL section maps Regular / Plus / Max to the per-seat numbers. The 2026-05-15 ratification re-promotes the three-tier surfacing with Plus → Partner as a label change. Update the file when canonical text is written.
- **Audit rubric** — `docs/customer-surface-audit-2026-05-15.md` (this PR).

## What "aligned" looks like

A customer-facing surface aligned to the lock will:

1. Lead with the service partnership before describing the fleet's behavior.
2. Name a service partner / service team somewhere on the surface (hero, body, or CTA).
3. Surface three tiers wherever pricing is referenced — never one tier alone.
4. Frame /custom as engagement work, not as a fourth tier.
5. Use "we install, we run, we customize" / "your AI ops team" / "managed AI ops" — not "self-serve" / "DIY" / "configure your".
6. Preserve mission/vision/tagline verbatim.

## Open questions for the next memory PR

These should be ratified as memory before the next copy reframe, so future agents have a canonical source instead of a spec-in-flight:

1. Locked Partner per-seat ladder. This PR uses $299 / $269 / $239 / $219 / $199 derived from the HISTORICAL Plus tier. Conner-ratified value owed.
2. Locked Max framing. This PR uses "Quoted per engagement" + sales-led mailto. Should there be a quoted price band?
3. Cadence cadence. Regular = monthly review, Partner = weekly review per this PR. Confirm or revise.
4. Header nav. Should /custom and a separate "Talk to a partner" link both surface in nav, or does the existing Custom nav-item carry both functions?
5. Plus → Partner rename. Schema-side: Tier enum stays Plus (unchanged); display label is Partner. Confirm or migrate.

---

## Reference (preserved from sibling branch `feat/copy-reframe-service-partnership-2026-05-15`)

The sibling rebase landed the same lock with the same scope; the lists below were the most reusable artifacts from that branch's guidance doc and are preserved here as the canonical reference table for any future copy reframe that needs to cite the lock at a glance.

### The positioning shift (2026-05-15 lock)

| BEFORE | AFTER |
|---|---|
| agentplain is a platform for SMBs to use AI agents in their business | agentplain is the SERVICE PARTNERSHIP that installs, runs, and customizes AI ops for local businesses |
| Customer is the AI OPERATOR | Customer is the SERVED PARTY |
| "Sign up, pick your vertical, connect your tools" | "Sign up, your service partner reaches out, the install happens inside two business days" |
| Self-serve onboarding implied | Managed onboarding by a named service partner |

If the visitor finishes a section thinking they will be operating AI agents themselves, the section is wrong. They should finish thinking we will be running it for them.

### Banned framings — replace on sight

These strings (or their close paraphrases) should not appear on any customer-facing surface:

- "self-serve AI platform" / "self-serve" anything customer-facing
- "DIY agentic workflows" / "DIY agents"
- "try our tool" / "try our platform"
- "configure your agents" (when customer is the actor)
- "set up your fleet" (when customer is the actor)
- "platform for SMBs" / "platform for small businesses"
- "AI tool for SMBs"
- Any phrasing that positions the CUSTOMER as the AI operator
- "Sign up and start using AI" (implies customer drives it)
- "Build your own workflows"
- "No code required" / "AI in minutes" (implies customer self-onboards)

Edge cases worth knowing:

- The word "self-serve" is still fine in INTERNAL contexts (e.g., `app/api/auth/oauth/google/connect/route.ts:42` and `app/(operator)/layout.tsx:7`) where it refers to operator/admin flows. Banned only on customer-facing copy.

### Required framings — use these patterns

The customer is the SERVED PARTY. We do the work; they do their business.

Acceptable lead-ins:

- "we run it for you"
- "managed AI ops"
- "your AI ops team — without hiring one"
- "your service partner"
- "we install, we run, we customize"
- "service partnership"
- "you decide on drafts; we run everything else"
- "the partnership is the product; the fleet is the mechanism"

Required verb patterns:

- For agentplain as actor: "install," "run," "customize," "tune," "monitor," "watch," "refresh," "scope"
- For the customer as actor: "sign up," "decide," "approve," "edit," "reject," "review" — never "configure," "set up," "wire up," "operate," "drive"
- For the fleet as mechanism: "drafts," "proposes," "categorizes," "schedules," "coordinates"

### Conflict-resolution rule

If anything in this doc conflicts with the locked memory files, the memory files win. Mission/vision/tagline are immovable. The service-partnership framing is the lens through which everything else is told.

## CHANGELOG

- 2026-05-15: Original doc landed via sibling branch `feat/copy-reframe-service-partnership-2026-05-15-kind-shirley` (PR #25). Captures the canonical service-partnership lock for the marketing surface.
- 2026-05-17: Rebase of `feat/copy-reframe-service-partnership-2026-05-15` appended the reference section (positioning shift table, banned framings, required framings) preserved from the sibling branch's alternate guidance doc.
