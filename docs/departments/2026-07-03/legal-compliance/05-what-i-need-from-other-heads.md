# What Legal needs from other heads — dated asks, smallest possible

Date: 2026-07-03. Every ask is scoped to the design-partner motion or an item that
blocks signature (doc 03). Nothing here is a new feature; most of it is applying
rulings that already exist.

## Marketing

**M1. Apply the /security softening ruling — by Mon Jul 6 (send day).**
`docs/copy-rulings/2026-07-03/security-page.md` (PR #354) contains the exact
replacement text for the incident-response absolutes and the personal-name
reference. Apply verbatim to `app/(marketing)/security/page.tsx`. One PR, no
drafting. Prospects will read this page the week outreach starts.

**M2. Apply the 7-item vendor-name scrub — same week.**
The vendor-invisibility ruling (PR #354) lists 7 customer-surface occurrences
(4 in `app/(marketing)/page.tsx`, 3 in `components/FAQ.tsx`) that name the model
vendor outside the subprocessor exception. The ruling says keep the positioning,
scrub the literal strings. Legal verifies after (doc 03, item 5).

**M3. Claims audit on anything Conner sends — standing.**
The outreach kit already labels the ROI figure as a model and cites the HUD
penalty basis — good. The standing rule: every quantified claim in a send-path
artifact is either measured-with-basis or labeled modeled; no compliance-rewrite
promise for any counsel-gated vertical; no absolute security/SLA claims. Voice-gate
doesn't scan `docs/outreach/` (known gap) — so this stays a manual A–E pass until
that changes.

**M4. `/terms` version + date visible — by Fri Jul 10.**
Doc 03 item 9: a visible version id and last-updated date on `/terms` (and
`/privacy`), so the future clickwrap record has a stable anchor.

## Product

**P1. Decide the support-ticket deletion direction — by Wed Jul 8.**
Doc 03 item 2, the one true signature-blocker owned outside legal: either the
runtime deletes support tickets on account close, or the published right in
`lib/storage/data-categories.ts:174` is softened to the truth. Legal is
indifferent between the two; legal is not indifferent to holding both.

**P2. AI-disclosure line on draft surfaces — spec this cycle, ship next.**
Prelaunch item A7: a persistent "AI-generated — review before sending" disclosure
on approval-queue drafts and both chat surfaces. Design partners are sophisticated
and briefed, so this is not a Monday blocker — but it must exist before any
partner's *staff* (who didn't sit the pitch) uses the queue. Small UI, big
statutory footprint (state bot-disclosure laws).

**P3. Clickwrap acceptance capture — spec handed now, ship before self-serve.**
Prelaunch A4: affirmative checkbox at signup, storing {user, ToS version,
timestamp}, durable and queryable. Not on the pilot critical path (partners sign
the short-form); on the critical path for the first self-serve dollar, and it has
eng lead time — so the spec goes to engineering now.

## Engineering

**E1. Portal deletion/RLS invariant tests into CI — by Fri Jul 17.**
Audit 10/10 found the portal-table tests wired into no workflow. Until they run in
CI, every data-rights sentence we publish is untested prose. This also gates any
future DPA (doc 06, stop #3).

**E2. Whichever branch of P1 is chosen, implement + test it — by Fri Jul 10.**
If "delete on close" wins: the deletion path plus a test proving it. If "soften
the right" wins: the copy change in `data-categories.ts` and the published page.

**E3. Account-deletion end-to-end check — by Fri Jul 17.**
Prelaunch A11: one verified pass of close-account → OAuth tokens revoked →
workspace data deleted per policy. A partner asking "what happens when I leave?"
gets an answer we've watched happen, not one we infer from code.

**E4. Neon PITR verification — 5 minutes, this week.**
The /security backup claim survives the softening pass only if PITR is actually
enabled (the ruling flags this). Check the Neon dashboard, note the result in the
M1 PR.

## Conner (restated from the packet so heads see the dependency)

- **Entity decision** — unblocks party names, postal footer, signature block
  (packet 1.4).
- **PAT revocation** — kaizen Conner-action #1; five minutes; closes a 24-day loop.
- **Counsel session against Batch 1** of the handoff packet this week — the
  short-form (doc 02) is item 1.

## Sequencing summary

| Deadline | Items |
|---|---|
| Mon Jul 6 (send) | M1 |
| Wed Jul 8 | P1 (decision) |
| Fri Jul 10 | M2, M4, E2, E4, counsel Batch 1 dispatched |
| Fri Jul 17 | E1, E3, P2 spec'd, P3 spec accepted |
