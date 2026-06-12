# Legal Audit — agentplain.com — 2026-06-11
**Date:** 2026-06-11 · **Lens:** Technology / Privacy Attorney (issue-spotting, not legal advice) · **Method:** Live WebFetch of /privacy, /terms, /security, /pricing, /law, /cpa, / + verbatim policy source and behavior code on `origin/main` (read-only, no edits/PRs).

> **This is an issue-spotting audit, not legal advice. Items marked COUNSEL require a licensed attorney's sign-off before go-live.**

---

## 1. Executive summary

agentplain ships a genuinely above-average plain-language privacy/terms/security set for a pre-revenue startup — the architecture-grounded posture, the named-subprocessor list, the explicit "we don't train on your data," the Georgia venue clause, the §-liability cap, and a *real, code-backed* in-product export + soft-delete + hard-delete path (verified: `lib/customer-files/deletion.ts` `tearDownWorkspaceData`, `app/(product)/.../settings/data/page.tsx`, export route) put it ahead of most competitors. **But the policies make three factual accuracy claims the code contradicts, and that is the dangerous failure mode for a privacy policy** — a stale-but-confident policy is worse than a thin one, because each inaccuracy is a per-se deceptive-practice / FTC §5 and state-UDAP hook and, in regulated verticals, a misrepresentation a customer's own compliance officer will catch: (1) **OpenAI is an active, undisclosed subprocessor** receiving customer document text for embeddings (the privacy list names 7 processors, omits OpenAI — yet the homepage FAQ openly admits "OpenAI for retrieval embeddings"); (2) the security/privacy pages claim the **knowledge-substrate documents are AES-256-GCM encrypted at rest**, but `payload-crypto` is wired to approvals/handoff/chat only — `KnowledgeDocument.body` is **plaintext** in Postgres (Neon disk-layer only); (3) the security page claims email OAuth uses **"read-and-draft scopes"** while the configured scope is `gmail.readonly` (read-only). There is **no cookie-consent surface** (likely defensible today — no analytics/ad cookies found — but unverified and undocumented), **no CCPA/GDPR-specific rights language** (no "right to know/delete/opt-out," no "we don't sell," no DPA/SCC posture, no EU stance), and the policies are **self-described as un-reviewed by counsel** (the source comments literally say "Counsel review is a follow-up"). Vertical pages flirt with UPL/RESPA/§7216/GLBA edges but the "agent drafts, human owns the decision, you're the licensed party" framing is consistently applied and is the right defense — it just isn't yet backed by counsel-reviewed compliance corpora (only real-estate fires live). **Lens score: 2.5/5** — the bones are good; the policies currently misstate the product, and no document has had counsel eyes.

---

## 2. Top 5 issues (severity 1–5; customer-value bar in brackets)

| # | Sev | Issue | Evidence | Blocks owner/their lawyer? |
|---|-----|-------|----------|----------------------------|
| 1 | **5** | **Undisclosed subprocessor: OpenAI.** Customer document text is sent to OpenAI for embeddings (`lib/knowledge/openai-embedding.ts`, default provider when `OPENAI_API_KEY` set — `lib/knowledge/index.ts:53-58`). OpenAI is **absent** from the privacy-policy subprocessor list (7 named; OpenAI not among them). The homepage FAQ *itself* admits "OpenAI for retrieval embeddings" — so the legal doc contradicts the company's own marketing. A privacy policy that omits an active processor of customer content is a textbook FTC §5 / state-UDAP misrepresentation and breaks every "named subprocessors only" promise in /terms. | privacy page source vs `lib/knowledge/`; home FAQ | **Yes — 5/5.** A CPA/law-firm DPO will reject this on read. |
| 2 | **5** | **Encryption-at-rest overclaim on connected/uploaded documents.** /security + /privacy explicitly state "the knowledge substrate documents you connect or upload … are encrypted at rest using AES-256-GCM." Code: `payload-crypto` (AES-256-GCM) is applied to approvals, handoff log, plaino chat, OAuth tokens — **not** to `KnowledgeDocument.body`, which is stored plaintext (per `docs/data-privacy-file-storage-audit-2026-05-26.md` §TL;DR; no `encryptPayload` import in `lib/knowledge/` or `lib/customer-files/` on origin/main). The single most sensitive payload (the customer's actual emails/files) is the one NOT app-encrypted. | /security + /privacy source; `git grep payload-crypto` misses `lib/knowledge/`; 2026-05-26 audit | **Yes — 5/5.** This is the exact claim a security-review questionnaire pins them on. |
| 3 | **5** | **No counsel review on any legal document.** Source comments on all three pages: *"Counsel review is a follow-up."* No CCPA/CPRA, no Colorado/Virginia/Texas/etc. state-privacy-act language, no GDPR/EU stance, no DPA offered to business customers, no SCC posture, no "we do not sell/share" statement, no data-subject-rights enumeration. Regulated-vertical customers (CPA/law/mortgage/insurance) are themselves data controllers who need a DPA from their processor — agentplain offers none. | page source comments; absence in policy text | **Yes — 5/5.** A real-estate broker's E&O carrier / a law firm's risk partner requires a signed DPA. |
| 4 | **4** | **OAuth-scope misstatement + Drive write capability vs "we never request write scopes."** /security: email uses "read-and-draft scopes"; configured scope is `gmail.readonly` (`lib/integrations/google/oauth.ts:50-55`) — read-only, no draft. Separately /security: "We never request write scopes for files we don't author," but the Drive MCP server exposes `drive.files.create` (`lib/integrations/google-drive-mcp/server.ts:140,167`). Both are inaccuracies in a doc used in Google's OAuth-verification packet — a false scope description to Google is its own review risk. | /security source vs `lib/integrations/google*` | **Partial — 3/5** to the owner; **high** to Google review. |
| 5 | **4** | **Vertical-page pricing + tier mapping create warranty/contract-formation exposure (legal angle on the cross-wave finding).** /cpa, /law, /ria, /home-services render vertical→tier pricing that contradicts /pricing (Wave 1 #2, Wave 2 #4: `verticalTierFromContentTier` flows into billing). Two pages of conflicting price + "first month free / no commitment" vs code-default card-at-signup (Wave 2 #5) is a **classic deceptive-pricing UDAP pattern** and creates genuine ambiguity about the actual agreement at the moment of contract formation. ROI claims ("15x–50x," "$150,000/yr reclamation," "$2,900–$10,600/mo value") + "compliance corpus, counsel-reviewed" (only real-estate is) are **warranty-adjacent representations** with no disclaimer on /pricing (the /cpa "illustrative, your numbers vary" disclaimer is NOT applied site-wide). | /pricing, /law, /cpa fetches; Wave 1/2 synth | **Yes — 4/5** if a deal goes sour and the customer's lawyer reads the page back to you. |

---

## 3. Per-page findings (line-level scrutiny)

### /privacy (`app/(marketing)/privacy/page.tsx`) — score 2.5/5
- **"Subprocessors … a small set of named subprocessors": OpenAI MISSING.** [Issue #1, SEV 5]. The list (Anthropic/Neon/Vercel/Stripe/Resend/Sentry/Inngest) is otherwise good and unusually specific — but incomplete, which makes it worse than a generic list because it implies completeness.
- **"are encrypted at rest using AES-256-GCM" applied to "knowledge substrate documents you connect or upload":** [Issue #2, SEV 5] — false for `KnowledgeDocument.body`.
- **"We do not train any base model on your data … do not share your data with any AI model provider's training pipeline":** *defensible* — Anthropic commercial API is no-train by default and OpenAI API embeddings are no-train by default; but there is **no in-code ZDR / no-train header config** (no grep hit), so this rests on vendor commercial-terms default, not a configured control. Note in a DPA, don't assert as an engineered control.
- **"Anthropic … On the no-training API tier":** accurate-by-default but unverifiable in code; fine as written.
- **Retention:** 7-day soft-delete + 30-day backup roll-off — **specific and code-backed** (good; `getGraceDays()`, `DEFAULT_GRACE_DAYS`). This is the strongest part of the policy.
- **Rights:** export + closure "from inside the product" — **real and verified.** But framed as product features, **not as legal data-subject rights** — no "right to know/access/delete/correct/opt-out," no response-time commitment, no identity-verification process, no non-customer (data-subject of the *customer's* customers, e.g. a law firm's clients) path. A buyer's clients' PII flows through with no stated rights mechanism for those individuals.
- **No CCPA/GDPR/state-law section. No "we do not sell or share personal information"** (required verbatim-ish under CCPA/CPRA if any CA traffic). No effective-date change-log beyond "Last updated."
- **Missing:** children's data stance (N/A but usually stated), international-transfer stance (Anthropic/OpenAI/Vercel are US — fine, but EU visitors to the marketing site implicate GDPR Art. 13 notice).

### /terms (`app/(marketing)/terms/page.tsx`) — score 3/5
- **Liability cap "limited to the amount you paid us in the 12 months preceding the claim":** standard and reasonable. **But there is no exclusion of consequential/indirect damages, no disclaimer of warranties ("AS IS"), no cap carve-outs** (typically you carve out the cap for the customer's indemnity, IP infringement, confidentiality breach). For a product drafting into regulated workflows, the **absence of an "AS IS / no warranty of fitness, accuracy of AI output" disclaimer is the single biggest ToS gap** — AI drafts can be wrong (hallucinated local-rule cites, wrong meeting times, mis-categorized invoices) and nothing here disclaims output accuracy. [COUNSEL]
- **"first month is free … your card is captured at signup and charged at the start of your second month":** this is the **correct** statement — but it contradicts the marketing "/no commitment" framing AND the prod-actual behavior (Wave 2 #5 found prod silently runs add-card-later). The ToS is honest; the marketing isn't; and prod matches neither reliably. Pick one truth. [Issue #5]
- **AI-output disclaimer:** "agent drafts; you send from your own systems; liability for licensed activities stays with you" — **good framing, present in three places.** This is the right UPL/RESPA defense skeleton. It is a *responsibility allocation*, not an *output-accuracy warranty disclaimer* — both are needed.
- **"We are responsible for … our compliance corpora's regulatory citations (clearly labeled as draft vs. counsel-reviewed inside the product)":** this **affirmatively accepts responsibility for citation accuracy** — and only real-estate is counsel-reviewed; the other 9 corpora are DRAFT and fire nothing (per `project_compliance_corpus_lives_in_sentinel`). Accepting responsibility for corpora that are admittedly un-reviewed is a self-inflicted liability hook. Soften to "we strive for accuracy; corpora are labeled; not legal advice." [COUNSEL]
- **Acceptable use (CAN-SPAM/TCPA/GDPR/no-data-extraction):** solid, appropriate.
- **Governing law / venue (Georgia, Fulton County, exclusive):** clean. **No arbitration clause, no class-action waiver** — for a B2B SMB product that's a defensible choice, but most counsel would add at least a mutual arbitration + class waiver before scale. [COUNSEL — strategic choice]
- **No "entire agreement / severability / assignment / force majeure / no-waiver" boilerplate.** Thin but not dangerous.
- **No indemnification clause** (neither direction). For a product touching third parties' data via the customer, a customer→vendor indemnity for the customer's misuse is standard and currently absent. [COUNSEL]

### /security (`app/(marketing)/security/page.tsx`) — score 3/5
- **"read-and-draft scopes only" for email:** [Issue #4] false — `gmail.readonly`.
- **"never request write scopes for files we don't author":** [Issue #4] the Drive MCP has `files.create`. Either tighten the claim or the capability.
- **AES-256-GCM at rest "approval queue items, handoff log entries, the knowledge substrate documents … OAuth tokens":** the first, second, and fourth are true (payload-crypto); the **knowledge-substrate documents are NOT** [Issue #2]. The honest version: "approval items, handoff entries, and OAuth tokens are AES-256-GCM app-encrypted; the knowledge substrate relies on database-layer encryption (Neon)."
- **"Vector embeddings are stored plaintext … not directly reversible":** honest and accurate, good. (Note: the *source text* in `KnowledgeDocument.body` IS plaintext and IS reversible — that's the gap the AES claim papers over.)
- **RLS / workspace isolation "a query that omits the workspace filter returns zero rows":** strong claim, code-backed (FORCE-mode RLS verified in 2026-05-26 audit). Keep.
- **"MFA gates production access … workspace owner (Conner Chambers)":** fine; naming the individual is unusual but honest for solo-operator stage.
- **Incident response: 24h contain / 72h notify / post-mortem:** **good and specific — but these are contractual commitments** with no counsel review and no breach-notification-law alignment (state breach laws have their own clocks and AG-notice triggers; 72h is GDPR's number, not most US states'). If you can't meet 24h containment, this is a self-imposed SLA you'll breach. [COUNSEL]
- **"do not pursue legal action against good-faith security research":** good safe-harbor language.
- **Self-described "Counsel review is a follow-up"** in the source comment. The page is used in OAuth-verification packets — a doc with known inaccuracies (#2, #4) going to Google is a review-integrity risk.

### /pricing — score (legal lens) 2.5/5
- **ROI "15x–50x," "value $2,900–$10,600/mo," compliance "counsel-reviewed" (only RE is):** warranty-adjacent reps with **no disclaimer on this page** (Issue #5). The "/cpa illustrative" disclaimer must be applied site-wide.
- **"First month free … cancel anytime / month-to-month":** vs card-at-signup ToS vs prod behavior — UDAP pricing-consistency risk. [Issue #5]

### /law — score (UPL lens) 3.5/5
- **"the agent drafts; the human still owns the customer-facing decision," "ABA Model Rule 1.6 + 1.7 + 1.18 awareness," "Partner review on every privilege-sensitive draft":** the framing is the **correct UPL defense** — the firm/attorney remains the practitioner; agentplain is a drafting tool. Low UPL risk *as worded*.
- **Residual risk:** "local-rule citations" inserted into drafts is the riskiest single feature — if a citation is wrong and a filing relies on it, that's malpractice the firm owns, but the marketing implies reliability. The law corpus is DRAFT (fires nothing live) so today it's inert, but the *page* implies it's working. Don't market a capability that isn't counsel-reviewed-live. [COUNSEL]
- **Confidentiality:** routing privileged client matter through OpenAI (embeddings) + Anthropic without disclosing *to the attorney* that a subprocessor sees privileged content is a Rule 1.6 informed-consent issue for the attorney — and the privacy policy omitting OpenAI compounds it. [ties to Issue #1]

### /cpa — score 3.5/5
- **IRS §7216** governs tax-return-preparer disclosure/use of taxpayer info — a preparer using agentplain may need **§7216 consent from their clients** before taxpayer data flows to agentplain's subprocessors. The page doesn't flag this; agentplain isn't the preparer, but a §7216-aware "you must obtain your clients' consent" note + a DPA would protect both sides. Includes its own ROI disclaimer ("illustrative") — good, the only page that does.

### / (home) — UDAP lens
- FAQ honestly discloses "OpenAI for retrieval embeddings, Anthropic for drafting" — **the homepage is more accurate than the privacy policy.** Fix the policy to match the FAQ, not vice-versa.
- No cookie banner; no analytics/ad cookies found in marketing routes (`document.cookie`/consent grep = empty) — likely no consent obligation today, but undocumented.

---

## 4. Strategic gaps (vs what competent counsel requires before scale)
1. **A Data Processing Agreement (DPA)** offered to business customers — regulated-vertical customers are controllers and legally need one from their processor. None exists. [COUNSEL]
2. **Subprocessor list as a maintained, versioned artifact** with a change-notification mechanism (you already promise 30-day notice for policy changes; extend to subprocessors). Wire it so adding a vendor (you just added OpenAI silently) updates the list.
3. **State-privacy-law coverage:** CCPA/CPRA "do not sell/share," Colorado/Virginia/Connecticut/Texas/etc. consumer-rights language; a single "US State Privacy Rights" section covers most. GDPR Art. 13 notice if EU marketing-site traffic. [COUNSEL]
4. **Output-accuracy + no-warranty (AS IS) disclaimer** in ToS — the AI-product-specific gap. [COUNSEL]
5. **Breach-notification clause aligned to actual state laws**, not a self-set 24/72h SLA you may not meet. [COUNSEL]
6. **Indemnification + consequential-damages exclusion + cap carve-outs** in ToS. [COUNSEL]
7. **§7216 (CPA) + GLBA Safeguards (mortgage/insurance) posture** — GLBA's Safeguards Rule obligations may flow to agentplain as a service provider to financial institutions; needs a written information security program reference. [COUNSEL]
8. **Counsel sign-off on all four pages before any scale push** — the source comments admit none has had it.

## 5. Quick wins (≤1h)
- **Add OpenAI to the privacy subprocessor list** (one `<li>`). Closes Issue #1's disclosure gap immediately. **Do this first — it's a 5-minute fix for a SEV-5.**
- **Correct the AES-256-GCM claim** on /security + /privacy: scope it to approvals/handoff/tokens; state knowledge substrate uses DB-layer (Neon) encryption. (Issue #2 — fixes the lie without code change; real encryption of `KnowledgeDocument.body` is the deep-work version.)
- **Fix the OAuth-scope wording** on /security: `gmail.readonly` ("read-only — drafts land in the app, not your mailbox") and either drop "never write scopes for files" or qualify it for Drive. (Issue #4)
- **Add the "/cpa illustrative" ROI disclaimer site-wide** (footer of /pricing + homepage ROI blocks). (Issue #5)
- **Add a one-line cookie statement** to the footer/privacy ("We use only strictly-necessary cookies; no advertising or cross-site tracking") — closes the consent question cheaply if true.
- **Soften the "we are responsible for our compliance corpora's citations" line** in /terms to not accept liability for the 9 DRAFT corpora.

## 6. Deep work (>1d)
- **[COUNSEL] Full counsel review + rewrite of /privacy, /terms, /security** — non-negotiable before scale. Everything in §4.
- **[COUNSEL] Draft + publish a DPA** (with subprocessor exhibit + SCCs if any EU) and a customer-facing signing flow.
- **App-level encryption of `KnowledgeDocument.body`** (the real fix for Issue #2) — extend `payload-crypto` to the knowledge store, or formally adopt "DB-layer-only" and say so. Engineering, not legal.
- **[COUNSEL] State-privacy-act compliance build** (CCPA/CPRA + the multi-state patchwork): rights-request intake, "do not sell," response-time SLAs, data-subject path for the *customer's* end-customers.
- **[COUNSEL] AI-specific ToS additions:** output-accuracy disclaimer, no-warranty, indemnity, damages exclusion, arbitration/class-waiver decision.
- **[COUNSEL] Vertical regulatory memos:** §7216 (CPA), GLBA Safeguards (mortgage/insurance), RESPA §8 (real estate — ensure no "thing of value for referrals" framing), UPL-by-state (law). Tie to the sentinel corpus go-live gate.

## 7. What you'd cut (claims creating legal exposure)
- **"the knowledge substrate documents you connect or upload … are encrypted at rest using AES-256-GCM"** — cut/scope until true. (Issue #2)
- **"read-and-draft scopes"** for email — cut to read-only. (Issue #4)
- **"We never request write scopes for files we don't author"** — cut or qualify (Drive `files.create`).
- **"our compliance corpora's regulatory citations … we are responsible for [their accuracy]"** — cut the acceptance-of-responsibility for the 9 DRAFT corpora.
- **"compliance corpus, counsel-reviewed"** on /pricing — cut or qualify to "real-estate counsel-reviewed; others in review" (only RE is reviewed).
- **Bare ROI multipliers ("15x–50x," "$150,000/yr")** without the "illustrative, results vary" disclaimer — cut the bareness, keep the number with a disclaimer.
- **The "no commitment / first month free"** framing where it contradicts card-at-signup — reconcile to one truth across marketing + ToS + prod.

---

### Appendix (customer-value < 4 — real but not deal-blocking for an SMB owner)
- No "entire agreement / severability / assignment / force majeure" boilerplate in /terms (thin, not dangerous).
- No arbitration/class-waiver (strategic choice, not a defect).
- Naming Conner personally as the MFA-gated production-access holder (honest at solo stage; revisit at scale).
- "Last updated June 2, 2026" with no version history (minor).
- 72h breach-notification using GDPR's number for a US-only product (cosmetic until you meet/miss it).

### Evidence caveats
- Authenticated app surfaces (`/app/...`) inspected via source on `origin/main`, not a live logged-in walk. The export/closure flow is verified in code but not exercised end-to-end this wave.
- The no-train Anthropic/OpenAI assertion rests on vendor commercial-terms defaults (correct as of cutoff) — no ZDR header was found in code; treated as "defensible, not engineered."
- `KnowledgeDocument.body` plaintext finding cross-confirmed against `docs/data-privacy-file-storage-audit-2026-05-26.md` and absence of `payload-crypto` imports in `lib/knowledge/`/`lib/customer-files/` on origin/main; the deletion-path gap from that same audit IS now remediated (`tearDownWorkspaceData` exists), so treat the 2026-05-26 doc as partially superseded.

---

## Post-audit drift check (2026-06-11 EOD — main@47237e0, prod cabf36f)

All three accuracy-critical findings re-verified intact today:
- **Issue 1 STILL TRUE:** OpenAI absent from the live /privacy subprocessor list (live grep today: zero matches) while embeddings still default to OpenAI.
- **Issue 2 STILL TRUE:** /security:44-47 still claims "the knowledge substrate documents you connect or upload … are encrypted at rest using AES-256-GCM" (and /privacy:95 mirrors it); `KnowledgeDocument.body` remains plaintext.
- **Issue 4 STILL TRUE:** "read-and-draft scopes only" still at /security:90.
- **Issue 5 root cause STILL TRUE:** vertical→tier pricing live; trial/card contradiction unchanged.
- No counsel engagement has landed; no DPA exists.

## Estimated effort to clear backlog
- **Quick wins:** ~1h in the Truth-Wave PR (OpenAI subprocessor line, scoped AES claim, corrected scope wording, site-wide ROI disclaimer, cookie statement, soften the corpora-responsibility line).
- **Deep work:** counsel engagement (P1-10 packet — full policy review, DPA, state-privacy rights, AS-IS/no-warranty, §7216/privilege) = external, ~1wk of counsel time; `KnowledgeDocument.body` encryption 2–3d eng + migration.
- **Total: 1 PR + 1 counsel engagement + ~3 eng-days.** The copy trio alone removes the per-se FTC §5/UDAP exposure; lens 2.5 → ~3.5, counsel sign-off needed for 4+.
