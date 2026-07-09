# 01 — The capture framework (reusable, every case study)

This is the framework every case study runs through, starting with design partner #1 and unchanged for #2 through #5 (slots defined in `docs/sales/deep-dive-2026-07-02/05-case-study-template.md`). The template file owns the *publish* format; this file owns what gets *collected* and under what agreement.

## 1. Consent framing — what the partner agrees to, on record

Consent is layered, and each layer is explicit. The design-partner letter grants the umbrella right; the working consent is re-earned in the moment, which is exactly why it builds trust instead of spending it.

**Layer 1 — the signed letter (Day 0).** The design-partner agreement includes case-study rights: we may develop a written case study from the engagement, subject to everything below. No letter, no capture.

**Layer 2 — the recording consent (every capture call).** Said out loud at the top of any call material may come from, in Conner's voice (week-1 runbook wording, reusable verbatim):

> "Part of our deal is the case study you approve word by word. I want to collect the raw material while it's fresh instead of reconstructing it in month three. This call is recorded; if you say something worth quoting I'll transcribe it, send it back in writing, and nothing gets used anywhere until you've approved that exact wording. If you'd rather a thing stay off the record, say 'off the record' and it's gone. Good?"

**Layer 3 — the specific approvals (logged, dated, in writing).** These are the partner's rights, stated plainly at signing:

- **Publication right:** nothing publishes — anywhere, in any form — without the partner's written approval of the exact final text. Not a summary, not "substantially similar." The exact text.
- **Edit right:** the partner can edit or strike anything in the draft, for any reason, no negotiation. Their edit is final.
- **Quote approval:** every quote is approved verbatim by the person named on it. Light grammar tidying happens in the version *sent for approval*; the approved tidied text becomes the verbatim of record.
- **Off-the-record right:** honored instantly and permanently, including retroactively.
- **Withdrawal:** the partner can pull the case study from active use at any time. We stop distributing; already-printed material is not clawed back, and that limit is stated up front.
- **End-client protection:** no buyer, seller, or lead of the partner is ever identifiable, directly or by inference. Names are scrubbed at capture time, not at publish time.
- **Logo and name:** separate checkbox each; a case study can run named-but-no-logo or (worst case) anonymized-with-permission, though an anonymized study is worth a fraction and we say so honestly when asking.

## 2. The 8 fields every case study needs

Nothing publishes with an unfilled field. The capture cadence (`03`) exists to fill these forward, not reconstruct them backward.

| # | Field | Source of record |
|---|---|---|
| 1 | **Partner name + brokerage** (person, business, location, size in agents) | Signed letter; named-use checkbox |
| 2 | **Vertical** | Engagement scope |
| 3 | **Before-workflow, with time cost** — the concrete Tuesday-night scene: what the owner personally did, how long it took, what slipped | Discovery-call recording, partner's own words; hours/week number stated by the partner, not assigned by us |
| 4 | **With-agentplain workflow, with time saved** — the same scene now: what lands in the queue, what the partner approves, what their systems send | Week 4–8 walkthrough recording + workspace instrumentation |
| 5 | **Quantified outcome + methodology footnote** — drafts landed, approval rate, hours reclaimed | Saved-time ledger + calibration table (`lib/guarantee/`); footnote written at capture time, verbatim format in `05` |
| 6 | **Verbatim quote, with approval** — the highest-value category is *why the approval gate satisfied them*; second is a concrete moment | Recorded call → transcription → written approval, dated |
| 7 | **Timeline** — signed → activated → first measurable outcome, with real dates | Capture files (dated at each event) |
| 8 | **What they'd tell another broker** — the peer-referral sentence, in their words | Week 8–12 call, the "what would you tell another broker" question |

## 3. What NOT to include — ever

- **Fabricated or synthesized numbers.** No estimated dollar impact, no "up to," no extrapolation from one week to a year. If the ledger didn't record it, it isn't a number.
- **Model or vendor names.** The service is agentplain and the named partner is Plaino. No underlying-provider names on any case-study surface — the sole exception in the whole company is the subprocessor lists on /privacy and /security, and a case study is not those pages.
- **Aspirational language.** The case study describes what happened, past tense, with dates. Roadmap, intentions, and "soon" belong nowhere in it.
- **Competitor bashing.** The partner's old workflow is the contrast, not another vendor. If the partner names a competitor negatively in a quote, that sentence doesn't make the cut.
- **Engineer vocabulary.** Customer vocab only: "Setting up," "Working," "Watching." No runtime labels, no internal workflow names.
- **End-client details.** Nothing that identifies a buyer, seller, or lead — including by inference (address + date + price is an identification).
- **Superlatives we put in their mouth.** If the partner didn't say "game-changer," the case study doesn't either. (If they did say it, we still prefer the concrete moment.)

## 4. Voice-gate compliance for the final draft

The final draft is written to pass the voice gate (`tools/brand/voice-gate.mjs`; catalog at `docs/brand/voice-guidelines-2026-06-19.md` §3) even though `docs/case-studies/` is not currently in its scan path — the published surface (`/customers/[slug]`, landing pull-quotes) *is* customer-facing, and the draft that feeds it is held to the same bar:

- Plain sentences, concrete nouns, past tense. The partner's words carry the story; our connective prose stays short and unadorned.
- No LLM-tell vocabulary from the catalog. If a sentence sounds like marketing wrote it, the partner's transcript almost certainly has a better version — use theirs.
- The control line appears once, naturally: the fleet drafts and proposes; the partner approves and sends.
- Cadence language, not live-magic language.
- Before the study ships to the site, run the draft through the voice gate manually and log the pass in the capture file.

**One exception to voice rules:** verbatim quotes are never edited to satisfy the gate. If a partner's approved quote contains a banned marketing word, the quote wins — it's their sentence, and its authenticity is the point.
