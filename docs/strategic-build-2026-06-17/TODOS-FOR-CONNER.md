# TODOs for Conner — strategic build 2026-06-17

> One file, appended to by each strategic-build wave. If a parallel wave already
> created this file, these entries merge in; resolve any conflict by keeping all
> sections.

## Data-minimization positioning (marketing + product + legal surfaces)

PR: `feat(positioning): data-minimization commitment across marketing, product,
and legal surfaces` (branch `feat/data-minimization-positioning-2026-06-18`).

- [ ] **Counsel review of new Privacy + ToS + DPA language.** The new
  data-minimization sections on `/privacy`, `/terms`, `/security`, the new
  `/data` and `/dpa` pages, and the DPA template at
  `docs/legal/dpa-template-2026-06-17.md` are written from production
  architecture but are **not** counsel-reviewed. The DPA template is marked
  DRAFT — do not send for signature until reviewed.
- [ ] **Decide: do we offer the DPA on Solo/Regular tier, or only Partner+?**
  The `/dpa` page deliberately does not name a tier yet. Recommendation:
  **offer it on request at every tier** (it's the same standard document; the
  marginal cost is counsel's one-time review, not per-signature), and reserve
  *bespoke* terms for Custom engagements. This makes "your data stays yours" a
  true, universal promise rather than an upsell.
- [ ] **Pick the marketing tagline for the data-minimization stance.** Used as
  the `/data` hero subhead and reusable site-wide (lives in
  `lib/marketing/data-commitments.ts → DATA_STANCE_TAGLINE`). Options:
  1. **"Your data stays yours. We process it; we don't hoard it."** *(currently
     wired — recommended: it's plain, it's a promise, and it's literally true.)*
  2. "Plaino works on your data. He doesn't keep it."
  3. "We do the work — not a copy of your business."
  4. "Read what's needed. Keep what's yours. Train on nothing."

### Truth-wave note carried out of this wave
- The original brief suggested a Plaino-chat reminder ("this conversation
  auto-deletes in 23 hours unless you save it"). **That claim is false on the
  current architecture** — workspace chat is persisted (the closure cascade in
  `lib/customer-data` deletes `chat` only on workspace close, not on a timer).
  I did **not** ship that copy. If the parallel data-minimization *architecture*
  session adds a chat TTL, wire the reminder then — and add the guarantee to
  `lib/marketing/data-commitments.ts` so the page picks it up.
- Per-connector disclosures and the `/data` "what we store" list are written to
  match what the product does **today**. If the architecture session tightens
  retention (e.g. ingested-document TTL, ephemeral task buffers), update
  `lib/marketing/data-commitments.ts` and `lib/integrations/data-flow.ts` — both
  are single-source so the copy follows the truth automatically.
