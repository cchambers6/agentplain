# Kaizen retro — Legal / Compliance (8/10)

Date: 2026-07-02. Ground truth: `origin/main` @ f928400, memory ledgers, and the
artifacts cited inline. Every claim below traces to a `file:line`, a PR, or a named
absence. This document surfaces gaps for counsel and for Conner; it is not legal
advice and proposes none.

Scope: Truth-Wave posture (both sites), ToS/AUP/DPA readiness (PR #296),
data-minimization architecture (PR #306), IP protection, the flatsbo legal predicate,
PAT security debt, CAN-SPAM, per-state voice consent, per-vertical compliance
(CPA / Law / PM), and knowledge-corpus ingestion (PR #295).

**Source-material note (per "don't fabricate"):** three memory files named in the
retro brief do not exist under those names in the memory directory
(`project_flatsbo_click_audit_2026_06_16`, `feedback_no_secrets_in_chat`,
`feedback_prod_anthropic_key_paused_is_policy`). The facts they were expected to
carry are corroborated from other artifacts and cited where used: the flatsbo legal
predicate from flatsbo memory (`conner_personal_tasks` — entity / GA salesperson
license / broker partnership all only-Conner and open), and the paused-prod-key
policy from the paused-key sentinel referenced in the finance/ops retro
(`lib/llm/paused.ts`, kaizen 07). Where an asserted fact could not be corroborated,
that is said explicitly rather than assumed (see friction 3 on the PAT).

---

## 10 things going well

1. **Compliance auto-rewrite is fail-closed for every vertical, with a durable
   two-layer counsel gate.** An env allow-list (`COMPLIANCE_CORPUS_COUNSEL_REVIEWED`)
   sits above a per-vertical DB sign-off row, and the old real-estate exemption was
   removed — no vertical drafts replacement legal language until counsel records a
   sign-off (`lib/agents/sentinel/counsel-signoff.ts:8-18`, `go-live-gate.ts`).

2. **A counsel-handoff packet generator exists.** `lib/agents/sentinel/counsel-packet.ts`
   builds the red-line deliverable per corpus — literal rules, trigger phrases,
   citations with `accessedAt` dates, and open questions — so engaging counsel is a
   hand-off, not a research project.

3. **A counsel-ready pre-launch legal risk map is already written.**
   `docs/launch/legal-risk-prelaunch-review.md` (2026-06-14) tiers every
   customer-facing surface 🔴/🟠/🟡, lists the required document set, and states the
   per-vertical sign-off asks (Circular 230/§7216 for CPA, UPL for Law,
   landlord-tenant + Fair Housing for PM). Counsel can start from page 1.

4. **Truth-Wave discipline is real and mechanical.** PR #290 audited ~120 marketing
   claims against code, fixed ~21 false ones, and made pricing derive from
   `lib/pricing/tiers.ts` (`tierLadderBands`) so numbers cannot hand-drift again.
   Present-tense compliance claims were cut back to the approval-gate truth.

5. **The published policy set exists and its drafts are honest about their status.**
   PR #296 shipped `/terms`, `/aup`, `/privacy` (all on main at
   `app/(marketing)/…`), and the markdown source of record flags every
   lawyer-needed section — `docs/legal/tos-2026-06-17.md` carries 7 explicit
   `[COUNSEL]` markers instead of pretending review happened.

6. **Data positioning is ratified, single-sourced, and self-checking.** The
   two-bucket commitment (Plaino memory persists; raw tool data is never copied)
   has a banned-phrase list preventing false "we store nothing" claims, and
   `lib/storage/data-categories.ts` has an invariant test that scans
   `schema.prisma` and fails when a workspace-scoped model is undisclosed.

7. **Voice recording defaults to the safe side.** Recording is OFF unless the
   workspace owner approves a `VOICE_RECORDING_CONSENT` card, the two-party
   disclosure prompt defaults ON, and a 14-state all-party-consent set is encoded
   with an explicit counsel-confirm note (`lib/voice/recording.ts:54-75`,
   `receivers.ts:127-136`).

8. **The knowledge corpus was built citation-first.** PR #295's 60 GA/US chunks each
   carry a source citation, ingestion is idempotent with supersede tombstones, a
   weekly refresh cron exists, and the reference corpus is deliberately independent
   of the marketing-claims counsel gate (`lib/agents/sentinel/corpus`,
   `scripts/corpus-ingest/`).

9. **Vertical readiness fails closed toward the waitlist, never toward taking
   money.** `lib/verticals/readiness.ts` only calls a vertical supported when its
   killer workflow demonstrably fires, and the unsupported-vertical leak path has an
   auto-refund design — consumer protection enforced by architecture (PR #219).

10. **Vendor invisibility and model privacy are enforced, not remembered.**
    Brand-gate R1 blocks Anthropic/Claude naming on customer surfaces in the
    pre-push pipeline (sole exception: the `/privacy` subprocessor list), and
    `privacyPreservingUserId()` sends the model vendor a SHA-256 workspace hash,
    never PII (`lib/llm/anthropic-provider.ts`, PR #296).

---

## 10 friction patterns

1. **Entity confirmation is still open, and everything legal is downstream of it.**
   `docs/legal/tos-2026-06-17.md` names no legal entity (no Inc./LLC anywhere in
   the document); the DPA, design-partner contracts, a Stripe descriptor, and the
   CAN-SPAM postal footer all need a real party name and address before they can be
   finished.

2. **The flatsbo legal predicate has been parked for weeks with no cadence.**
   flatsbo memory (`conner_personal_tasks`) tracks entity (A), GA salesperson
   license (B), and broker partnership (C) as "ACTIVE NOW" only-Conner items, yet
   none has closed; `project_agentplain_is_priority` makes the pause deliberate, but
   nothing reviews the predicate on a schedule, so it simply ages.

3. **The 06-09 PAT loop was never closed.** `PAT_UPDATE_CHECKLIST_2026-06-09.md`
   documents the expired fine-grained GitHub PAT and its rotation steps; Phase 5
   ("delete the old token") has no completion evidence 23 days later, and no
   artifact records whether rotation ever happened. (The retro brief calls the token
   "leaked"; no artifact found today confirms or refutes a leak — a working-tree
   scan for PAT-shaped strings came back clean. The debt is the unclosed
   revocation/rotation loop and the absence of any secret-rotation policy.)

4. **The DPA is blocked three ways.** The legal-risk review marks it 🔴-required for
   a processor; no `/dpa` route or template exists on main (the draft template lives
   on the unmerged `feat/data-minimization-positioning-2026-06-18` branch); and
   audit 10/10 (PR #330) found 9 client-portal models holding end-client PII with
   no RLS and no account-close deletion — processor commitments the runtime cannot
   currently honor.

5. **Per-state voice-consent language is a global constant, not per-workspace
   data.** `TWO_PARTY_CONSENT_STATES` and the disclosure behavior are hardcoded
   (`lib/voice/recording.ts:59-75`) with an in-code note that counsel should
   confirm the list; there is no per-workspace jurisdiction resolution for a
   business calling across states, and no counsel-reviewable data layer like the
   sentinel corpus has.

6. **Published legal documents have zero counsel sign-off.** `/terms`, `/aup`, and
   `/privacy` render on the live marketing site while their source of record still
   carries `[COUNSEL]` flags, and `docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md:89`
   states plainly: "None of it is counsel-reviewed."

7. **Clickwrap consent capture is not implemented.** Legal-risk item A4 (🔴) calls
   for affirmative, versioned, logged ToS acceptance; on main, only the terms page
   itself references agreement — no acceptance record is persisted at signup, so the
   enforceability spine for every downstream limitation is missing.

8. **CAN-SPAM postal address gap.** Outbound briefing email sets a
   `List-Unsubscribe` header (`lib/skills/briefing-generator/email.ts:65`) but no
   template in `lib/email/` or the briefing generator carries a physical postal
   address — partially blocked on friction 1, but the template seam for it also
   doesn't exist.

9. **Published data rights exceed tested runtime behavior.**
   `lib/storage/data-categories.ts:174` promises support tickets are "removed on
   account close" while audit 10/10 found they survive close; the same audit found
   the portal-table deletion/RLS invariant tests are wired into no CI workflow.
   This is exactly the failure mode the legal-risk review warns about in A11: a
   published right must match a real, tested path.

10. **Compliance posture is audited in waves but checked by nothing between
    waves.** The Truth Wave (06-16), the legal audits (06-11), and the full audit
    (07-02) were each one-shot; the `/security` absolutes flagged for review on
    06-16 ("zero rows regardless", "no admin can rewrite") are still live 16 days
    later (`app/(marketing)/security/page.tsx:76,116`). Claims drift back between
    audits because no standing check re-reads them.

---

## Top 5 process improvements

1. **A weekly compliance check, as a standing gate rather than a wave.** A small
   scheduled pass that re-verifies the known drift points: flagged absolutes still
   on `/security`, `[COUNSEL]` flag count per published doc, counsel sign-off row
   count, deletion-path invariant tests green, and days-since-rotation for each
   long-lived credential. Output lands in the INBOX like other kaizen signals; the
   Truth Wave found ~21 false claims precisely because nothing was watching weekly.

2. **A counsel-review cadence with a burn-down.** A monthly packet assembled from
   what already exists (`counsel-packet.ts` output for the next vertical plus the
   🔴 items in `legal-risk-prelaunch-review.md`), a target of one signed artifact
   per cycle, and a tracked `[COUNSEL]`-flag burn-down so "needs a lawyer" is a
   shrinking queue instead of a permanent caveat.

3. **A written secret-rotation policy with a dated credential inventory.** One page:
   rotation interval, revoke-on-replace as a hard rule, and an exposure playbook —
   plus an inventory (GitHub PAT, fleet app PEM, Vercel/Neon/Stripe/Resend keys,
   OAuth client secrets) with issue dates. The weekly check (improvement 1) flags
   any credential past its interval. The 06-09 PAT sat 23 days because no policy
   made anyone the owner of Phase 5.

4. **Per-state trigger rules as counsel-reviewable data, not TypeScript
   constants.** Move `TWO_PARTY_CONSENT_STATES` — and the coming per-state
   AI-disclosure triggers the legal-risk review anticipates — into a
   jurisdiction-keyed data layer with citations and `accessedAt` dates, resolved
   per workspace. The sentinel corpus already established this pattern; counsel
   red-lines a packet, not a source file.

5. **A per-vertical DPA template generated from the code's own disclosures.** One
   base DPA plus vertical annexes (CPA §7216 confidentiality, Law privilege/UPL
   posture, PM tenant PII) whose storage and subprocessor exhibits are generated
   from `lib/storage/data-categories.ts` and the subprocessor list, so the signed
   document always matches what the runtime stores. Sequenced after the portal
   RLS/deletion fixes from audit 10/10 — signing before that fix would warrant
   something untrue.

---

## Top 3 immediate Conner actions

1. **Revoke the 06-09 GitHub PAT today.** GitHub → Settings → Developer settings →
   Fine-grained tokens → delete the old token, whether or not it was ever exposed —
   a replaced token has no reason to stay live. Check off Phase 5 of
   `PAT_UPDATE_CHECKLIST_2026-06-09.md` with a date so the loop is visibly closed.

2. **Confirm the entity.** Decide and file (or confirm) the legal entity for
   agentplain, with a service/postal address. This single decision unblocks the ToS
   party name, the DPA, the CAN-SPAM footer, the Stripe descriptor, and
   design-partner paper (frictions 1, 4, 8).

3. **Name design partners inside a counsel-ready structure.** Engage counsel of
   record with the packet that already exists (`legal-risk-prelaunch-review.md` +
   the real-estate counsel packet), get the first durable sign-off row recorded,
   and let design-partner agreements reference reviewed documents instead of
   `[COUNSEL]`-flagged drafts. This is also the stated top GTM channel
   (`project_money_gtm_pack_2026_06_14`), so it compounds.

---

## Spend

No ceiling was set. Actual spend for this retro: **zero LLM API calls** — the work
was memory reads, repo greps against `origin/main` @ f928400, and one document. The
production Anthropic key remains paused per policy and was not touched. No billed
token usage was incurred by this task beyond the Claude Code session itself, which
is not meterable from this repo (the session-cost stamp seam is unwired; see the
finance/ops retro, kaizen 07).
