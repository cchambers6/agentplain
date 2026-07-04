# Legal & Compliance — 14-day executive plan

Date: 2026-07-03. Author: Head of Legal & Compliance (fleet). Ground truth:
`docs/kaizen/2026-07-02/08-legal-compliance.md`, `docs/launch/legal-risk-prelaunch-review.md`,
CEO Pass 1 open questions (PR #348), copy rulings (PR #354), outreach kit (PR #353).
**Source note:** the full-audit file `docs/audits/full-audit-2026-07-02/agentplain/08-legal-compliance.md`
does not exist on `origin/main` (audits 01–07, 09, 10 do); this plan proceeds from the
kaizen 08 retro and the prelaunch legal-risk review, which carry the same substance.
This is not legal advice; counsel reviews everything here.

## Frame (ratified 2026-07-03)

- **The lever:** Conner sends 5 design-partner emails Monday (2026-07-06). Legal's
  single job this cycle is that when a prospect says yes, nothing legal slows the
  yes down — and nothing sent creates exposure.
- **Counsel is engaged and reviewing ongoing** (Conner, direct). We do not hire or
  replace counsel; we make their review cheap by packaging decisions, not research.
- **Kill list holds:** no new legal-heavy features, no compliance claims that
  require funded hardening (KILL #7).
- **flatsbo stays live** per Conner override — so it gets a hygiene minimum
  (doc 04), not a rebuild and not a dark-out.
- Design FOR profitable: legal work is sequenced by what converts the design-partner
  motion into signed pilots (doc 07), not by abstract risk ranking.

## The one thing that must be counsel-ready before Monday

**The design-partner short-form agreement (doc 02).** Reasoning: the send itself
requires no signature, but a positive reply can put "send me something to sign" on
the table within 48 hours. Without a ready short-form, terms get improvised in an
email thread — the worst legal artifact this company could produce in July. The
short-form is one page, references no unfinished document, and is the only item on
the critical path of the CEO lever. Everything else (ToS flags, DPA, clickwrap)
can trail the send by days; the short-form cannot trail the first yes.

## 14-day plan

### Days 1–2 (Fri Jul 3 – Sat Jul 4) — signable before the send

1. **Design-partner short-form drafted** (doc 02, this PR) and routed to counsel as
   Batch 1, item 1 of the handoff packet (doc 01). Ask: red-line or bless within
   the ongoing review — it is deliberately one page to make that a small ask.
2. **Apply the /security softening** — the exact replacements are already ratified
   in `docs/copy-rulings/2026-07-03/security-page.md` (PR #354). This is a
   Marketing/Eng apply job (doc 05), not new drafting. Prospects read /security
   the week outreach starts; the 24-hour containment absolute must not be live on
   send day.
3. **Claims spot-check of the send package** (outreach kit, PR #353): the modeled
   ROI figure is labeled as a model (verified — the RE one-pager says "That's a
   model, not a customer result"), the HUD penalty figure carries its basis, no
   compliance-rewrite promise for any gated vertical. Log the check; fix by PR if
   anything drifted.

### Days 3–7 (Mon Jul 6 – Fri Jul 10) — the week of the send

4. **Counsel handoff packet live** (doc 01): Batches 1–3 indexed with the question
   presented per document, so Conner's counsel sessions dispatch items instead of
   opening research threads. Target: Batch 1 (short-form + ToS/Privacy deltas)
   dispositioned this week.
5. **ToS/Privacy update list executed to the extent unblocked** (doc 03): the four
   `[COUNSEL]` flags in `docs/legal/tos-2026-06-17.md` go to counsel as framed
   yes/no decisions; the data-rights drift (support-ticket deletion promise vs.
   audit 10 finding) gets resolved in one direction — fix the runtime or soften the
   published right — before any partner signs.
6. **Entity dependency surfaced, not blocked on.** Party name, notice address,
   CAN-SPAM postal footer, Stripe descriptor all wait on Conner's entity decision
   (CEO open question #2). Every draft in this pack uses a `[ENTITY]` placeholder
   so the day the entity exists, the fill is mechanical. Legal's job is to keep the
   placeholder discipline absolute — no document invents an entity name.
7. **flatsbo hygiene minimum dispatched** (doc 04): one-day scope, three changes,
   assigned to the flatsbo side, verified by screenshot.

### Days 8–14 (Jul 11 – Jul 17) — convert the first yes

8. **First signature path rehearsed:** short-form → DocuSign (or countersigned PDF)
   → stored with date + version. Target: a yes on any of the 5 sends reaches
   signature in under 48 hours.
9. **Clickwrap spec handed to Product/Eng** (doc 05): versioned, dated, logged
   affirmative acceptance at signup (prelaunch review item A4). Design partners
   sign the short-form, so clickwrap is not on the Monday critical path — but it is
   on the first-self-serve-dollar critical path and takes eng lead time.
10. **Counsel burn-down started:** `[COUNSEL]` flag count per published doc tracked
    week-over-week (kaizen improvement #2). Baseline today: 4 flags in the ToS
    source, zero sign-off rows recorded.
11. **Stop-doing list enforced** (doc 06): no non-RE vertical terms drafting, no
    DPA signing before the portal RLS/deletion fixes, no absolutes reintroduced on
    /security.

## What this plan does NOT do

- It does not draft a DPA for signature (blocked three ways per kaizen friction #4;
  premature signing would warrant untrue processor commitments).
- It does not build new compliance machinery (weekly-check automation is proposed
  in kaizen; it is not this cycle's spend).
- It does not touch the flatsbo product beyond the doc-04 minimum.
- It does not resolve entity, PAT revocation, or counsel-of-record scope — those
  are Conner-only (CEO open questions #2 and kaizen Conner-action #1) and are
  restated in doc 01 so counsel sessions surface them.

## Definition of done (day 14)

- Short-form: counsel-blessed or red-lined once, signable in one sitting.
- /security: ratified softening live in production; zero flagged absolutes.
- Counsel packet: Batch 1 dispositioned; burn-down chart has two data points.
- ToS/Privacy: update list (doc 03) either applied or explicitly parked with reason.
- flatsbo: three hygiene changes live.
- If any of the 5 sends converted: a signed short-form exists, on placeholder-free
  paper if the entity closed, on disclosed-sole-proprietor paper if not.
