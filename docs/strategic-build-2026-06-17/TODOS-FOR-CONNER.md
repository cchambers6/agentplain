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
- [ ] **Pick the marketing tagline for the data stance.** Used as the `/data`
  hero subhead and reusable site-wide (lives in
  `lib/marketing/data-commitments.ts → DATA_STANCE_TAGLINE`). The dual-commitment
  direction is locked (Conner, 2026-06-18). Options:
  1. **"Your data is yours. Plaino is your partner."** *(currently wired —
     recommended: captures both buckets in one line.)*
  2. "Plaino remembers how you work. Your raw data stays in your tools."
  3. "A partner who remembers — without copying your data."

### Positioning ratified this wave (two-bucket model, Conner 2026-06-18)
- **Plaino's working memory of the customer's business persists for the life of
  the account** (chat history, preferences, voice, learned patterns, approved
  drafts, ongoing per-relationship context). This is a FEATURE — a service
  partner that forgot the business every day would be useless. It is hard-deleted
  on account closure. All copy now leads with this; the earlier
  "minimize / process-don't-hoard / nothing kept" framing was **removed** as
  false.
- **We do NOT keep copies of the customer's raw tool data** (CRM records, emails,
  files, end-client PII). Plaino reads them in-flight and leaves them in the
  customer's tools. This is the confidentiality pitch for CPA/Law/PM — their
  clients' data never lands on our servers.
- Both buckets are single-sourced in `lib/marketing/data-commitments.ts` and
  `lib/integrations/data-flow.ts`, so if retention rules change, the copy follows
  automatically. **Do NOT reintroduce any "auto-deletes after N hours" /
  "nothing stored" claim** — it contradicts the ratified persistence model.
