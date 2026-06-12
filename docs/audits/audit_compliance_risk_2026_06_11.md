# Compliance/Risk Audit — agentplain.com — 2026-06-11
**Date:** 2026-06-11 · **Lens:** Compliance / Risk Officer (vertical SaaS for regulated local businesses) · **Mode:** read-only, no repo changes
**Overall lens score: 4 / 5** — Strong, lawyer-defensible posture overall; one systemic claim/reality gap (vertical-page scanners described as active when 9 of 10 fire nothing) keeps it off a 5.

---

## 1. Executive summary

agentplain's compliance posture is, structurally, the right one and unusually well-built: the no-outbound architecture ("the fleet drafts and proposes; it never auto-sends, never moves money, never makes commitments" — homepage) genuinely transfers TCPA/CAN-SPAM/RESPA sender-of-record liability to the customer; the Terms and Privacy pages cleanly disclaim licensed activity ("We are not a licensed broker, lender, carrier, attorney, CPA, RIA… Liability for licensed activities… stays with you and your firm"); and the codebase backs the marketing claim with a real fail-closed go-live gate — only real-estate's HUD fair-housing literal scanner fires live; all 9 other verticals' corpora load as DRAFT and `isVerticalLiveAllowed()` returns false for them (`lib/agents/sentinel/index.ts`, `counsel-signoff.ts`). The homepage discloses this honestly ("compliance rules for non-real-estate verticals are loaded as drafts — they don't fire until counsel red-lines them"), and the in-app compliance surface is exemplary ("No rules fire on drafts in this vertical today"). **The single real exposure is that the individual vertical marketing pages contradict that honesty**: /ria, /insurance, /cpa, /property-management, and /law describe their compliance scanners in the present active tense ("the SEC Marketing Rule corpus flags them," "the fair-housing scanner flags it," "a fiduciary-aware compliance pass," "a privilege-aware compliance pass," "a Circular 230 slip is corrected at the draft stage") with no draft/not-yet-live qualifier — describing a control that does not run. Secondary: even the one live corpus (real-estate) is counsel-unreviewed by its own metadata, and Privacy is silent on IRC §7216 / attorney-client privilege despite selling to CPA and law firms.

---

## 2. Top 5 issues (severity 1–5)

| # | Severity | Issue |
|---|---|---|
| 1 | **5** | **Vertical pages describe compliance scanners as ACTIVE; for 9 of 10 verticals the scanner fires nothing.** The JTBD prose on /ria ("the SEC Marketing Rule corpus flags them, and a person approves before send"), /property-management ("the fair-housing scanner flags it"), /law ("a privilege-aware compliance pass," "drafts under the Model Rule 1.6 corpus"), /cpa ("a Circular 230 slip is corrected at the draft stage"), and /insurance ("a licensed human approves it") all imply a live scanner. In code, `runner.ts:481` gates the scan behind `isVerticalLiveAllowed()`, which is true ONLY for real-estate (`BASELINE_LIVE_VERTICALS = {"real-estate"}`) or env-listed slugs; `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` is an empty-default allow-list. So a CPA/RIA/PM/law/insurance customer gets a draft with **zero compliance flags ever**, while the page they bought from said the scanner protects them. This is a misrepresentation a plaintiff's lawyer or an E&O carrier would seize on if a fair-housing/§7216/Marketing-Rule violation slipped through. The homepage tells the truth; the vertical pages override it. |
| 2 | **4** | **The one corpus that DOES fire live (real-estate) is itself counsel-unreviewed.** `corpus/real-estate/_metadata.ts` carries `counselReviewer: null` and the note "Counsel should red-line the full list before flipping `status: COUNSEL_REVIEWED`." Real-estate is `BASELINE_LIVE` and exempt from the env gate, so a ~46-phrase HUD list ported from flatsbo is scanning live with no attorney having signed off on it. The customer-facing copy ("HUD enumerated-phrase scanner flags it") and the firm's own risk reduction rest on a list no lawyer has blessed. False negatives (a discriminatory phrase the literal list misses) become the broker's liability — and arguably agentplain's, because it marketed the scanner as the safeguard. |
| 3 | **4** | **Privacy/Terms are silent on IRC §7216 and attorney-client privilege while actively selling to CPA and law firms.** Privacy says "On the no-training API tier; your data is not used to train models" — good, and necessary — but never addresses §7216 (criminal/civil restrictions on a tax preparer disclosing return information to a third party; agentplain IS a third party in the data path) or how attorney-client privilege survives routing client communications through agentplain + Anthropic. The /cpa page makes NO §7216 claim (correctly cautious), but the absence of any §7216 / privilege handling language anywhere is a gap a CPA's or law firm's own compliance reviewer will flag at procurement and may block on. |
| 4 | **4** | **"Fiduciary-aware compliance pass" / "privilege-aware compliance pass" framing risks implying a standard of care agentplain cannot meet.** A "fiduciary-aware" pass (RIA) and "privilege-aware" pass (law) suggest the tool understands and applies the adviser's fiduciary duty / the attorney's privilege obligations. If a customer relies on that pass and a Marketing-Rule or privilege breach ships, the gap between "aware" (marketing) and "fires nothing today" (reality) is the heart of a negligent-misrepresentation theory. The words "aware" and "corpus flags them" do more work than the product delivers. |
| 5 | **3** | **No explicit "do not rely on AI output as professional advice" disclaimer at the point of output, and Terms lacks a no-warranty clause.** Terms disclaims licensed-party status and caps liability at trailing-12-month fees, but (per the page itself) contains no "no warranty," "do not rely," or indemnification language. For a product whose entire value prop is drafting regulated communications, the absence of an AS-IS / no-reliance disclaimer in the master terms — and the absence of a per-output "review before you rely on this; this is a draft, not advice" line in the app UX — is a standard E&O-driven gap. The draft-then-approve UX mitigates it; explicit language would close it. |

---

## 3. Per-vertical findings

### /real-estate — score 4/5 (the only live vertical)
- **Promise:** "the HUD enumerated-phrase scanner flags it, and a person approves it — so the violating sentence never reaches a portal" (`real-estate/content.ts:223`).
- **Reality:** This is the ONE vertical where the scanner actually fires (`BASELINE_LIVE`, real-estate-only). The claim is substantively true at the wiring level.
- **Risk:** (a) The HUD list is counsel-unreviewed (`_metadata.ts` `counselReviewer: null`) — issue #2. (b) A literal-phrase scanner catches enumerated phrases only; novel discriminatory phrasing passes. The copy "the violating sentence never reaches a portal" overstates a literal-match scanner's recall — it should read "flags known prohibited phrases." (c) Wave-2 found `/api/chat` degraded and the draft skill inert in prod on 2026-06-11; if no draft is produced, the scanner never runs even here.
- **Verdict:** Defensible if the HUD list gets counsel sign-off and the "never reaches a portal" absolute is softened.

### /mortgage — score 4/5
- **Promise:** "routes every one through human approval"; "TRID-clock-relevant events logged with timestamps the broker-of-record can defend"; names RESPA, ECOA, HMDA, TRID.
- **Reality:** Mortgage corpus is DRAFT — the named-framework scanner does NOT fire. BUT the /mortgage page is more careful than the worst offenders: its core claim is the **approval loop** ("the regulatory exposure a draft-then-approve loop takes off the table"), which IS real, not the scanner. It does not assert "the corpus flags them."
- **Risk:** "TRID-clock-relevant events logged with timestamps the broker-of-record can defend" implies a TRID-aware logging feature; confirm that event logging actually captures TRID-relevant events with defensible timestamps, or soften. No NMLS-licensing claim is made (good — agentplain is not an NMLS licensee).
- **Verdict:** Mostly honest because it sells the loop, not the scanner.

### /law — score 2/5 (highest UPL/misrepresentation risk)
- **Promise:** "AUGMENTS the partner's read… with a privilege-aware compliance pass" (`law/content.ts:128`); "agentplain drafts under the Model Rule 1.6 corpus and an attorney approves every client-facing draft, so a privilege breach or misleading line never leaves the firm" (`law/content.ts:271`).
- **Reality:** The law corpus (MRPC 1.6, 5.5 UPL, 7.1, etc.) is DRAFT — the "Model Rule 1.6 corpus" scans NOTHING. "Drafts under the Model Rule 1.6 corpus" describes a control that does not run. The absolute "a privilege breach… never leaves the firm" is unsupportable.
- **UPL angle:** The repeated "attorney approves every client-facing draft / the human still owns the decision" framing is the correct UPL-mitigation posture and does NOT claim agentplain practices law or supervises attorneys. That part is sound. The exposure is the false-scanner claim, not UPL per se.
- **Verdict:** Strong UPL framing undercut by a scanner claim the product doesn't honor. Needs the draft/not-live qualifier the homepage already uses.

### /cpa — score 3/5
- **Promise:** "a credentialed person approves before anything is sent or filed, so a Circular 230 slip is corrected at the draft stage" (`cpa/content.ts:270`).
- **Reality:** CPA corpus (IRC §7216, §6694, Circular 230, AICPA) is DRAFT — fires nothing. "A Circular 230 slip is corrected at the draft stage" implies the corpus catches the slip; it doesn't.
- **§7216 gap:** The page wisely makes NO §7216-safe-handling claim. But neither Privacy nor /cpa addresses that agentplain + Anthropic are third parties receiving taxpayer return information — a §7216 consent/handling question the CPA's own reviewer will raise (issue #3).
- **Verdict:** Cautious on the hardest claim (§7216), but the Circular-230 scanner framing overstates.

### /insurance — score 3/5
- **Promise:** "agentplain's fleet drafts the update and a licensed human approves it before it leaves"; cites NAIC Unfair Claims Settlement Practices Act, $1,000–$25,000/violation.
- **Reality:** Insurance corpus DRAFT, fires nothing. The page leans more on the approval loop than an active scanner (closer to /mortgage), which is honest. No state-DOI-license claim by agentplain (good).
- **Risk:** Citing specific penalty ranges ($25,000/violation) next to "agentplain's fleet drafts… a licensed human approves" implies agentplain's draft step reduces that specific exposure via review the product doesn't perform. The loop reduces it; the (non-firing) scanner doesn't.
- **Verdict:** Acceptable if framed as loop-not-scanner.

### /ria — score 2/5 (most internally inconsistent page)
- **Promise (prose):** "the SEC Marketing Rule corpus flags them, and a person approves before send — so an unsubstantiated claim never becomes a filed advertisement" (`ria/content.ts:281`); "a fiduciary-aware compliance pass" (`:128`).
- **Promise (honest, elsewhere on same page):** "the ADV, suitability, and Marketing Rule corpus is loaded; **draft scoring activates after counsel review**" (`ria/content.ts:66`).
- **Reality:** Corpus DRAFT, fires nothing. The page contradicts itself — the activity-snapshot string is truthful ("activates after counsel review"); the JTBD prose ("the corpus flags them… never becomes a filed advertisement") is not.
- **SEC Marketing Rule angle:** Naming Rule 206(4)-1 and 2024 enforcement settlements ($60k–$325k) next to "the corpus flags them" is the sharpest claim/reality gap in the audit — the named rule's scanner does not run.
- **Verdict:** Fix the prose to match line 66's honesty.

### /property-management — score 3/5
- **Promise:** "agentplain's fleet drafts the reply, the fair-housing scanner flags it, and a PM approves before it sends" (`property-management/content.ts:264`).
- **Reality:** PM corpus DRAFT — the "fair-housing scanner" does NOT fire (only real-estate's HUD scanner is live; PM's is a separate, gated corpus). Present-tense "the fair-housing scanner flags it" describes an inactive control.
- **Verdict:** Same defect as /ria — needs the draft qualifier.

### /title-escrow — score 4/5
- **Promise:** "every wire instruction draft cross-checked against verified-channel data"; "a closer approves before send, so a RESPA-implicating line never reaches a borrower."
- **Reality:** Corpus DRAFT. BUT the page is careful — it sells the approval loop and a "verification step within the draft workflow," not an autonomous scanner. Honest framing.
- **Risk:** "every wire instruction draft cross-checked against verified-channel data" implies an actual wire-verification feature; confirm it exists or soften — wire fraud is the highest-dollar exposure in title/escrow.
- **Verdict:** Among the more honest vertical pages.

### /home-services — score 4/5
- **Promise:** "the fleet drafts the message and a person approves the send against the consent record"; "a TCPA-violating text never goes out by machine."
- **Reality:** Corpus DRAFT; makes NO active-scanner claim. Sells the loop. This is the most honest vertical page — explicitly "agentplain does not auto-send… this is the structural safeguard, not a compliance scanner."
- **Verdict:** Model for how the others should read.

### /recruiting — score 4/5
- **Promise:** "an EEOC- or Ban-the-Box-violating message is caught as a draft" via human review.
- **Reality:** Corpus DRAFT; explicitly makes NO automated-scanning claim — frames compliance as human judgment in the approval loop.
- **Verdict:** Honest.

### /general — score 4/5 (homepage)
- The most honest surface in the entire product: "The sentinel runs a literal-phrase scan against HUD-prohibited fair-housing copy on every customer-facing draft" (true — real-estate) AND "compliance rules for non-real-estate verticals are loaded as drafts — they don't fire until counsel red-lines them." This is exactly the disclosure the vertical pages omit. **The vertical pages should inherit this sentence.**

---

## 4. Strategic gaps

- **The honesty gradient is inverted.** The homepage and the in-app compliance surface tell the truth ("loaded as drafts," "No rules fire on drafts in this vertical today"). The highest-intent, highest-conversion pages — the individual vertical pages a buyer reads right before signing — are the ones that overstate. The disclosure should be strongest where the purchase decision happens.
- **Loop vs. scanner conflation.** agentplain has two distinct compliance value props: (1) the **no-outbound approval loop** (real, live, fleet-wide, genuinely de-risking — this is the strong moat), and (2) the **per-vertical scanner** (real for real-estate, draft-only for 9 verticals). The vertical pages blur them, borrowing the credibility of (1) for the unfired (2). Separating them in copy would let the firm keep every honest claim and drop only the false ones.
- **§7216 / privilege procurement blocker.** CPA and law firms run vendor compliance reviews. With no §7216 handling language and no privilege-preservation statement, agentplain will hit a procurement wall at exactly the firms it's targeting. This is a sales blocker, not just a risk item.
- **No SOC 2.** /security describes a credible posture (AES-256-GCM, RLS, append-only audit log, MFA, 24h/72h incident SLA) but no SOC 2 attestation — which 6 of the regulated verticals' compliance officers will require. (Flagged in Wave 1; restated here from the risk lens: it's an E&O/procurement gate, not just a sales nicety.)
- **Counsel-unreviewed live corpus.** The firm built a rigorous fail-closed gate (`evaluateCounselGate`, durable sign-off rows, env kill-switch) for the 9 draft verticals — then exempted the one live vertical (real-estate) from it. The most-used scanner is the least-gated.

---

## 5. Quick wins (≤1h)

1. **Add the homepage's honesty sentence to every non-real-estate vertical page.** One line per page: "Your industry's compliance corpus is loaded and in counsel review; until it's signed off, Plaino flags nothing automatically — your licensed review is the safeguard today." Closes issues #1 and #4 across /ria, /law, /cpa, /insurance, /property-management. Pure copy edits in `lib/verticals/<v>/content.ts`.
2. **Change present-tense scanner verbs to conditional/future on the 5 offending pages.** "the SEC Marketing Rule corpus flags them" → "the SEC Marketing Rule corpus is loaded and will flag them once counsel signs it off"; same for "the fair-housing scanner flags it," "a Circular 230 slip is corrected at the draft stage," "drafts under the Model Rule 1.6 corpus." Reuse the truthful pattern already on `ria/content.ts:66`.
3. **Soften the absolutes.** "the violating sentence never reaches a portal," "a privilege breach… never leaves the firm," "an unsubstantiated claim never becomes a filed advertisement" → "…before a human sends it" framing. Absolutes are what a misrepresentation claim quotes back.
4. **Soften "never reaches a portal" recall claim for real-estate** to "flags known HUD-prohibited phrases" — a literal scanner doesn't catch novel phrasing, and the copy currently promises total recall.
5. **Add a one-line per-output disclaimer in the app draft surface:** "Draft for your review — not legal/tax/financial advice. Confirm compliance before you send." Addresses issue #5's UX half.

## 6. Deep work (>1d)

- **🔴 COUNSEL — Get the real-estate HUD list red-lined and sign off.** The one live corpus has `counselReviewer: null`. Run the existing `scripts/render-counsel-handoff-packets.ts` for real-estate, get counsel review, set the sign-off row + flip metadata. Closes issue #2. (The machinery already exists — `counsel-signoff.ts` — it just hasn't been exercised for the one live vertical.)
- **🔴 COUNSEL — §7216 + attorney-client-privilege language for Privacy/Terms and the /cpa, /law pages.** Needs tax/privilege counsel to draft: (a) a §7216 statement covering agentplain + Anthropic as third parties in the return-information path and what consent/handling applies; (b) a privilege-preservation statement for law-firm data. Closes issue #3 and the procurement blocker. Without this, do not market /cpa or /law as compliance-aware.
- **🔴 COUNSEL — Master-terms hardening:** add AS-IS / no-warranty, no-reliance ("do not rely on outputs as professional advice"), and a mutual indemnification clause. Closes issue #5's terms half.
- **Pursue SOC 2 Type II** (or at minimum a Type I + roadmap) — the posture is already built; the attestation gates 6 verticals' procurement.
- **Wire the §7216-style "third party in the data path" question into the no-outbound architecture doc** — the architecture removes sender-of-record liability beautifully, but receiving/processing regulated data is a separate liability surface the doc doesn't yet address.

## 7. What you'd cut (claims creating regulatory exposure)

Cut or rewrite — do not ship these as written:
- **"the SEC Marketing Rule corpus flags them… so an unsubstantiated claim never becomes a filed advertisement"** (`ria/content.ts:281`) — describes a scanner that does not run; names a specific SEC rule. Highest-exposure single sentence in the audit.
- **"the fair-housing scanner flags it"** (`property-management/content.ts:264`) — inactive control, present tense.
- **"a privilege-aware compliance pass"** + **"drafts under the Model Rule 1.6 corpus, so a privilege breach… never leaves the firm"** (`law/content.ts:128,271`) — implies a privilege control that fires nothing; absolute "never."
- **"a Circular 230 slip is corrected at the draft stage"** (`cpa/content.ts:270`) — implies the Circular 230 corpus catches the slip; it doesn't fire.
- **"a fiduciary-aware compliance pass"** (`ria/content.ts:128`) — "fiduciary-aware" overclaims a standard of care.
- **"the violating sentence never reaches a portal"** (`real-estate/content.ts:223`) — even on the live vertical, a literal scanner can't promise total recall.

Keep (these are honest and load-bearing — do NOT cut): every "the agent drafts; the human still owns the decision," "it never auto-sends, never moves money," "Liability for licensed activities stays with you and your firm," and the homepage "loaded as drafts — they don't fire until counsel red-lines them." The fix is to make the vertical pages sound like these, not to weaken the moat.

---

## Appendix — items below the customer-value bar (<4: would not, by itself, block a regulated owner / E&O carrier)

- **Privacy lacks health-data (HIPAA) language.** None of the 10 verticals is a covered entity in V1, so not a blocker today; revisit if healthcare opens.
- **Incident-response SLA (24h contain / 72h notify) has no stated regulatory-breach-notification mapping** (state breach laws vary). Reasonable for current scale; note for SOC 2.
- **Vector embeddings stored plaintext** (/security) — disclosed and defensible ("not directly reversible," workspace_id-gated). A sophisticated reviewer might ask about embedding-inversion risk on regulated text; low priority.
- **Backup retention (30 days encrypted) vs. 7-day soft-delete** — fine, but a §7216/privilege reviewer may ask whether deletion guarantees extend to backups. Folds into the issue-#3 counsel work.

---

### Evidence index (all read 2026-06-11)
- Live pages (WebFetch): agentplain.com/{verticals, security, terms, privacy, /, real-estate, mortgage, law, cpa, insurance, ria, property-management, title-escrow, recruiting, home-services}
- Repo (`git show origin/main:`): `lib/agents/sentinel/index.ts` (BASELINE_LIVE = real-estate only; `isVerticalLiveAllowed`), `lib/agents/sentinel/counsel-signoff.ts` (fail-closed two-layer gate, env empty-default), `lib/skills/runner.ts:461-501` (scan gated behind `isVerticalLiveAllowed`), `lib/env.ts:372-383` (`COMPLIANCE_CORPUS_COUNSEL_REVIEWED` empty default), `app/(product)/app/workspace/[id]/compliance/page.tsx` (honest in-app "no rules fire" surface), `lib/verticals/{ria,law,cpa,property-management,real-estate,insurance}/content.ts` (offending marketing strings, cited inline), `lib/agents/sentinel/corpus/real-estate/_metadata.ts` (`counselReviewer: null`).
- Cross-wave inputs: `wave1_synthesis_2026_06_11.md`, `wave2_synthesis_2026_06_11.md` (degraded `/api/chat`, only #216/#217/#218/#222 merged on origin/main).

---

## Post-audit drift check (2026-06-11 EOD — main@47237e0, prod cabf36f)

- **STILL TRUE:** the present-tense scanner claims survive verbatim — `ria/content.ts:281` ("the SEC Marketing Rule corpus flags them… never becomes a filed advertisement") and `law/content.ts:128` ("privilege-aware compliance pass") re-verified today; the real-estate HUD corpus still carries `counselReviewer: null`; §7216/privilege silence in Privacy/Terms unchanged; no counsel engagement landed.
- **CONTEXT IMPROVED:** #219's signup gate is now live — unsupported verticals waitlist honestly. But the worst offenders (/ria, /law, /cpa, /property-management) include supported or sales-routed verticals, so paying or quote-routed buyers still read claims about scanners that fire nothing.

## Estimated effort to clear backlog
- **Quick wins:** ~2h in the Truth-Wave PR (port the homepage honesty sentence to the offending pages, present→future tense on the 6 enumerated sentences, soften the absolutes, per-output draft disclaimer).
- **Deep work (🔴 COUNSEL):** red-line the live real-estate HUD list (machinery exists — `scripts/render-counsel-handoff-packets.ts`); §7216 + privilege language; AS-IS/no-warranty/indemnification terms. External engagement, ~1wk counsel time. SOC 2 = quarter-scale clock to start.
- **Total: 1 PR (~2h) + 1 counsel engagement.** Copy fixes hold the 4/5; counsel sign-off is what unlocks 5/5 and the regulated-vertical procurement path.
