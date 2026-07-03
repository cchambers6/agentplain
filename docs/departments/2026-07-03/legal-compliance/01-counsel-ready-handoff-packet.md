# Counsel-ready handoff packet — index and dispatch order

Date: 2026-07-03. Purpose: Conner's counsel review is ongoing; this index turns each
session into dispatch, not research. Every item states the document, where it lives,
its status, and the **question presented** — the one thing counsel must decide or
bless. Items are batched by what they block.

Standing context counsel should hold: agentplain is a draft-only service (agents
draft; the customer approves and sends from their own systems — the no-outbound
architecture). There are zero customers today; the first motion is 3–5 free
three-month design-partner pilots, real-estate/Georgia first. No entity is confirmed
yet; every draft uses `[ENTITY]` placeholders.

---

## Batch 1 — blocks the first signature (this week)

| # | Document | Location | Status | Question presented |
|---|----------|----------|--------|--------------------|
| 1.1 | **Design-partner short-form agreement** | `docs/departments/2026-07-03/legal-compliance/02-design-partner-short-form.md` | DRAFT, fleet-written, never reviewed | Bless or red-line as a one-page pilot agreement for 3–5 free design partners. Specific asks: liability cap enforceability at $0 fees; publicity/testimonial consent language; IP/feedback license scope; GA governing law. |
| 1.2 | **Terms of Service** | Published at `/terms`; source of record `docs/legal/tos-2026-06-17.md` | PUBLISHED, zero counsel sign-off, 4 `[COUNSEL]` flags | Resolve the four flags (each framed in doc 03 as a yes/no): data-residency statement, reverse-engineering carve-out, suspension escalation ladder, plus overall bless. |
| 1.3 | **Privacy Policy** | Published at `/privacy` | PUBLISHED, zero counsel sign-off | Confirm the two-bucket data description (assistant memory persists for account life; raw connected-tool data is pass-through, never copied) is accurately and safely stated; confirm subprocessor table completeness; confirm CCPA/GDPR rights language matches a real deletion path (see 1.5 caveat). |
| 1.4 | **Entity decision memo** | CEO Pass 1, open question #2 (`docs/ceo/2026-07-02/04-open-questions-for-conner.md`, PR #348) | OPEN — Conner-only | Not a review item; a prerequisite. Party name, notice address, CAN-SPAM postal footer, Stripe descriptor, and the short-form signature block all fill from this one decision. If a partner signs before the entity closes, counsel should advise on signing as a disclosed sole proprietor vs. holding for entity formation. |
| 1.5 | **Data-rights drift disclosure** | `lib/storage/data-categories.ts:174` vs. audit 10/10 (PR #330) | KNOWN DEFECT | The published policy says support tickets are "removed on account close"; the runtime does not delete them. Counsel should know we will resolve in one direction (doc 03, item 4) before any partner signs — flagging so no one warrants the current text. |

## Batch 2 — blocks the first self-serve dollar (next 2–4 weeks)

| # | Document | Location | Status | Question presented |
|---|----------|----------|--------|--------------------|
| 2.1 | **Clickwrap consent mechanism** | Not implemented (prelaunch review A4, 🔴) | SPEC ONLY (doc 05 hands to eng) | Bless the consent-capture design: affirmative checkbox, ToS version id, timestamp, durable log. Enforceability of every ToS limitation hangs on this. |
| 2.2 | **Acceptable Use Policy** | Published at `/aup` | PUBLISHED, zero sign-off | Bless; confirm downstream-of-model-provider usage-policy mirroring is adequate and per-vertical prohibited-automation list is right. |
| 2.3 | **AI Use Disclosure** | Required by prelaunch review (Section B); referenced from approval-queue and chat surfaces | NOT YET A STANDALONE DOC | Bless plain-language disclosure: output is drafted not sent, human-in-the-loop, no professional-advice guarantee. State bot-disclosure statutes (e.g. CA) apply. |
| 2.4 | **Subprocessor list** | `/privacy` + `/security` | PUBLISHED | Reconcile against vendors the code actually calls (model provider, Vercel, Neon, Stripe, Resend) — a list that omits a live vendor is a misrepresentation. Note: this is the sole surface where the model vendor may be named (ratified copy ruling, PR #354). |
| 2.5 | **Trial/renewal disclosures** | Pricing surfaces; billing code | BUILT (7-day default, 14-day CPA/Law, card at signup, 14-day money-back) | Confirm click-to-cancel / negative-option compliance and that disclosed terms match billing code per vertical. Not needed for free pilots; needed before self-serve. |

## Batch 3 — blocks scale, not the current motion (park until Batch 1–2 clear)

| # | Document | Location | Status | Question presented |
|---|----------|----------|--------|--------------------|
| 3.1 | **DPA + subprocessor flow-down** | Template on unmerged branch `feat/data-minimization-positioning-2026-06-18`; no `/dpa` route | BLOCKED (three ways per kaizen friction #4) | Do not review for signature yet. The runtime cannot honor processor deletion/RLS commitments for portal tables (audit 10/10). Sequenced after those fixes; doc 06 forbids signing before. |
| 3.2 | **Real-estate compliance corpus sign-off** | `lib/agents/sentinel/`; packet generator `lib/agents/sentinel/counsel-packet.ts` | Flag rules live; rewrite fail-closed behind sign-off row | Verify the HUD literal-rules corpus and record the first durable sign-off row. First vertical only; the other nine corpora stay DRAFT and unreviewed (doc 06). |
| 3.3 | **Voice-recording consent states** | `lib/voice/recording.ts:54-75` | HARDCODED, in-code counsel note | Confirm the 14-state all-party-consent list. Low urgency: voice is env-gated and not in the design-partner offer. |
| 3.4 | **flatsbo exposure** | `C:\flatsbo`; hygiene minimum in doc 04 | LIVE per Conner override | One session: given the site stays up, confirm the doc-04 minimum (privacy notice, no-brokerage disclaimer, entity-honest identification) is sufficient interim posture. |
| 3.5 | **Anthropic trademark/brand-use note** | Prelaunch review Section B (🟡) | MOOT-ISH | The vendor-invisibility ruling (PR #354) removes the model name from customer copy anyway; only the subprocessor-list use remains. Confirm that use is fine (it is nominative), then close. |

---

## How to run a counsel session against this packet

1. Open with Batch 1 in order; each item is a bless / red-line / decide, not a memo
   request.
2. Record outcomes as durable artifacts: a sign-off row where the machinery exists
   (`lib/agents/sentinel/counsel-signoff.ts`), a dated note in `docs/legal/`
   otherwise. The kaizen retro's burn-down metric is `[COUNSEL]` flags remaining
   (today: 4) and sign-off rows recorded (today: 0).
3. Anything counsel raises that is not in this index gets added here by PR — this
   file is the single queue, so nothing lives only in a meeting.

## Conner-only items restated (not counsel work, but counsel will ask)

- Entity formation + service/postal address (unblocks 1.4 and half of Batch 1).
- Revoke the 2026-06-09 GitHub PAT and date-stamp Phase 5 of
  `PAT_UPDATE_CHECKLIST_2026-06-09.md` (kaizen Conner-action #1).
- Confirm counsel-of-record scope covers both agentplain and the flatsbo question
  in one engagement (CEO open question #2 suggests it can).
