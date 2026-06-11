# Customer Support Audit — agentplain.com — 2026-06-11
**Date:** 2026-06-11 · **Lens:** Head of Customer Support/Success · **Mode:** read-only, live + origin/main
**Overall lens score: 2.5 / 5**

---

## 1. Executive summary

The *architecture* of agentplain's support is more thoughtful than most one-person SaaS — a named human partner (Plaino) model, an in-app `/help` form that drafts a first reply into an operator review queue, a live L1 triage layer (`customer-support-triage`, merged on origin/main as pfd-3) that escalates billing disputes >$200, legal/distress/vuln messages, and "I want a human" asks via `pageHuman` with a 24-hour deadline, and an honest no-outbound posture. But the *customer-facing reality today is broken at the front door*: the live Plaino chat is in its paused-spend degraded state ("Plaino's resting just now") on both the marketing widget AND the in-app support chat (verified live: `POST /api/chat` returns `degraded:true`), so the single most prominent help affordance on every page answers nothing and instead asks even a logged-in paying customer to "leave your email." There is **zero self-serve documentation or KB anywhere** (every `/help`, `/docs`, `/faq`, `/support`, `/kb`, `/status` route 404s — verified), the only contact channel is one shared `hello@agentplain.com` inbox handling sales, support, and security incidents alike, there is **no phone and no stated chat/email response SLA on any customer-facing surface**, and the response-time promises that *do* exist contradict each other (same-day vs 1 business day vs 2 business days). An upset customer — "your AI sent the wrong thing to my client" — has no findable emergency path: the chat is resting, there's no contact page, and the FAQ never addresses what to do when something goes wrong.

---

## 2. Top 5 issues (severity 1–5)

| # | Severity | Issue |
|---|---|---|
| 1 | **5** | **The primary help affordance is dead in prod.** The "chat with Plaino" bubble on every marketing page AND the in-app `/support` chat both return the paused degraded reply today (verified live: `{"degraded":true,"reply":"Plaino's resting just now…"}`). A confused or upset owner's first instinct — click the chat — yields a non-answer that pivots to email capture. First product touch and first-hour assistance are both effectively offline. Root cause = `ANTHROPIC_API_KEY` paused sentinel (Conner-gated, not a code bug). |
| 2 | **5** | **No self-serve docs/KB exists, and no help routes exist.** `/help`, `/docs`, `/faq`, `/support`, `/kb`, `/knowledge-base`, `/status`, `/help-center`, `/get-started`, `/onboarding`, `/resources`, `/guides` ALL 404 (probed live). The only self-serve content is the homepage FAQ anchor (`/#faq`, 20 Q&A). A stuck owner at 9pm has nothing to read and no one resting-Plaino to ask. |
| 3 | **4** | **One inbox for everything; no SLA stated to customers.** `hello@agentplain.com` is the sole channel for sales, support, AND security-incident reporting (`/security`). No phone. The in-app `/help` and `/support` surfaces promise only "we'll follow up by email" with **no timeframe**. A customer cannot tell whether a reply comes in an hour or a week. |
| 4 | **4** | **In-app degraded UX treats a paying customer like an anonymous lead.** When the LLM is paused, `/api/chat?mode=support` returns the *same* "Plaino's resting… leave your email below" copy and `expandLeadCapture:true` (route.ts → `complete()` → `PLAINO_PAUSED_REPLY`). A logged-in owner who already has a workspace and a named partner is asked to re-enter their email into a lead-capture box instead of being routed to the working `/help` form or told "message [partner] directly." Wrong mental model at the trust moment. |
| 5 | **3** | **Response-time promises contradict each other across surfaces.** `/custom` says "within two business days"; `/inquiry-received` and `/sign-up` checkout say "within one business day"; `/security` says "within one business day"; the degraded chat says "a person will follow up the same day"; in-app `/help` says only "follow up by email" (no window). The L1 triage layer internally uses a 24h (one-business-day) escalation deadline. No single source of truth; the customer hears a different promise depending on where they landed. |

---

## 3. Per-page / per-surface findings

### Marketing site (agentplain.com)
- **Header:** Verticals · How it works · Pricing · Custom · About · Sign in · Start free trial. **No Help/Support/Contact link in the header.** Help is discoverable only via the floating chat bubble (currently resting) or by scrolling to the footer.
- **Footer:** Company column ends with `hello@agentplain.com` (mailto). No `/help`, `/support`, `/contact`, `/docs`, `/status`. FAQ link points to `/#faq` anchor only.
- **Chat widget ("chat with Plaino"):** present bottom-right on every marketing route (mounted once in the marketing layout). **Live state today: paused/degraded.** A stuck visitor types a question and gets "Plaino's resting just now — but a person will follow up the same day. leave your email below and we'll be in touch." The copy is calm and in-voice (good), correctly avoids stack-trace jargon (`degraded-copy.ts` has a test enforcing this), and routes to lead capture — but it answers nothing. Findability of *real* help from the chat = 0 once it's resting.
- **`/#faq`:** 20 Q&A — genuinely useful on what/pricing/data/cancel. **Gaps (no FAQ covers):** how to get help, what to do if the AI makes a mistake, billing disputes, refunds, response times, error remediation. The upset-customer questions are exactly the ones missing.
- **`/custom`:** the only real contact *form* on the marketing site (inquiry type, name, business, vertical, seats, description, email). Honest copy: "We email one human; no drip… within two business days with a scoping-call invite." But this is framed as a *sales* form, not a support channel — an upset existing customer wouldn't think to use it.
- **`/security`:** vuln/incident reporting → `hello@agentplain.com`, "respond within one business day," contain in 24h / notify in 72h. Reasonable for the stage. **No SOC 2 / ISO** named (blocks regulated-vertical trust, flagged in Wave 1 too).
- **404 probes:** `/help /support /contact /faq /docs /kb /knowledge-base /status /help-center /get-started /onboarding /resources /guides` → all 404. Note: footer FAQ uses `/#faq` so there is no standalone, linkable, indexable help destination.

### app.agentplain.com
- Apex serves the **marketing homepage**, not the app (the real app lives under `/app/sign-in`, `/app/sign-up`, `/app/workspace/[id]/…`). Same resting chat widget. `/login` 404s (real route is `/app/sign-in`) — a returning customer who guesses `/login` hits a dead end.

### In-app (authenticated, `app/(product)/app/workspace/[id]/…`, read from origin/main)
- **Two help surfaces, both in the workspace nav:** `Support` (`/support`, Plaino chat) and `Help` (`/help`, form). Good redundancy in principle.
- **`/help` form (the resilient fallback):** server-action based (`sendSupportMessageAction`), does NOT depend on the LLM to submit. Persists a `SupportRequest`, shows a "under review by a human" status banner, voice is strong ("not a ticket queue, a partner who knows your ground"). **This is the surface that still works while Plaino is resting** — but nothing tells a customer to use *it* instead of the dead chat. **Gating gap:** both `/help` and `/support` require role `BROKER_OWNER` (`requireWorkspaceMember(..., ["BROKER_OWNER"])`) — a non-owner team member on the workspace has **no in-app way to ask for help.**
- **`/support` chat:** same `/api/chat` backbone → same paused degraded reply today, with the lead-capture pivot (see issue #4).
- **L1 triage (`lib/skills/customer-support-triage/`, MERGED on origin/main — wave2 ledger was wrong):** wired into `support-handler-on-create.ts` and runs *before* the draft path. Escalates legal/distress/vuln/deletion/human-ask and billing disputes >$200 to a human via `pageHuman` with a 24h deadline; auto-answers only high-KB-confidence (≥0.80) questions; bounded auto-resolve is OFF by default. This is a genuinely good design — but the auto-answer path depends on the KB classifier (LLM), so while the key is paused it correctly falls through to draft/escalation rather than auto-answering. Net effect today: support requests still land and escalate, but the "instant answer" value is dormant.
- **Support resolution loop (`lib/support/resolve-reply.ts`):** operator-gated send (no auto-send to customer), idempotent, send-then-persist ordering so a failed send stays retryable. Solid. But the *draft* the operator reviews is LLM-generated — paused today, so the operator gets the raw request to answer by hand.

---

## 4. Strategic gaps

1. **No "what to do when it goes wrong" surface anywhere.** The entire site is sell-side. There is no incident/help destination an *existing, upset* customer can find. The one scenario that most threatens a $500/mo relationship — "your AI drafted something wrong and it went to my client" — has no named path. (Note the product is draft-only/no-outbound, so the *true* worst case is "I approved a bad draft" — but the customer doesn't know that distinction in a panic, and there's nowhere to land.)
2. **The degraded state is a single point of failure for ALL real-time help.** Because one chat backbone powers both marketing and in-app support, when the Anthropic key pauses, *every* conversational help affordance dies simultaneously. There is no LLM-free help fallback surfaced to the user — the working `/help` form exists but is never advertised as the fallback, and the resting chat doesn't link to it.
3. **One inbox, one human, no triage visible to the customer.** The model is honest ("we email one human") but offers the customer no way to signal urgency. A billing dispute, a "cancel me," and a "your AI broke my client relationship" all land in the same `hello@` with the same invisible queue. The L1 triage *internally* prioritizes these — but that intelligence is invisible to the sender, who just sees silence.
4. **Response-time promise is un-owned.** Five surfaces, three different windows. For a service-partnership brand whose entire pitch is "a human who knows your ground," an inconsistent reply-window promise quietly undercuts the core differentiator.
5. **No status/uptime communication.** When Plaino is resting (today), there's no status page, no banner on the marketing site, no proactive "we're temporarily limited" notice. The customer infers "broken" from a resting-dog metaphor.

---

## 5. Quick wins (≤1h each)

1. **Add a header "Help" link → `/#faq`** (or a new lightweight `/help` page). Currently help is findable only via a resting chat bubble or footer scroll. One nav entry fixes findability on every page.
2. **State the response window once, consistently.** Pick "one business day" (matches the L1 triage 24h deadline and most surfaces) and apply it to `/help`, `/support`, the degraded chat, and `/custom`. Kill the "two business days" outlier on `/custom`.
3. **In-app degraded copy ≠ marketing degraded copy.** When `mode:support` is paused, return a support-specific line: "Plaino's resting — message your service partner directly via the Help tab and [partner] will follow up by [window]," and set `expandLeadCapture:false`. A paying customer should never be asked to re-enter their email into a lead box. (One-line branch in `route.ts` / `degraded-copy.ts`.)
4. **Link the resting chat to the working `/help` form.** The degraded reply (in-app) should deep-link to `/app/workspace/[id]/help` so the LLM-free fallback is one tap away when the chat can't answer.
5. **Drop role gate from `/help` (and `/support`) to any active member**, not just `BROKER_OWNER`. Anyone who can see the workspace should be able to ask for help.
6. **Add 3–4 FAQ entries for the upset-customer scenarios:** "What if the fleet drafts something wrong?" (answer: it's draft-only, nothing sends without your approval; here's how to flag it), "How do I dispute a charge?", "How fast will someone reply?", "What if I need a human right now?"
7. **Make the marketing chat, while resting, name the email channel inline** (it promises follow-up but doesn't show `hello@agentplain.com` — give the visitor the channel directly so they aren't stuck if they don't want to leave an email in a box).

---

## 6. Deep work (>1d)

1. **Restore/fund the Anthropic key (Conner-gated).** This is the single highest-leverage action — it un-rests Plaino on all four surfaces at once and reactivates the L1 triage auto-answer path. Pair with a budget alarm so a future pause is caught before customers see "resting."
2. **Build a real self-serve KB.** The `customer-support-triage` skill already has a `RepoKbLoader` + `PRODUCT_KB` substrate — surface that same content as a public, indexable `/help/[topic]` set. Doubles as the answer-engine/long-tail SEO surface Wave 1 also wanted, and gives the L1 triage a richer ground truth. Highest-ROI because it serves stuck customers AND deflects volume AND captures search intent.
3. **Status/degraded banner system.** A lightweight status surface (or a site-wide banner the key-pause sentinel can trigger) so that when Plaino is limited, customers see an honest "temporarily limited, here's how to reach us" message instead of inferring breakage from a resting metaphor.
4. **Customer-visible urgency signal.** Let the `/help` form carry an "is this urgent / is this about something already sent to a client?" flag that maps to the triage escalation path — so the customer's panic actually routes to `pageHuman` instead of sitting invisibly in `hello@`.
5. **Separate the security/abuse inbox from `hello@`.** A `security@agentplain.com` alias (even if it lands in the same place) signals seriousness on `/security` and avoids vuln reports drowning in sales inquiries.

---

## 7. What I'd cut

- **Cut the duality confusion between `/help` and `/support`.** Two in-app help surfaces (a chat and a form) doing overlapping jobs splits the customer's attention and doubles the maintenance surface. Keep ONE primary ("Get help") that *defaults* to the form (LLM-independent, always works) and *offers* chat when available — rather than two co-equal nav items that behave differently when the LLM is down.
- **Cut the lead-capture pivot from the in-app support degraded path** (covered in quick win #3) — it's the wrong instinct for an authenticated paying customer and should not exist on that surface.
- **Don't build phone support.** For a one-person-plus-fleet company, a stated phone number you can't reliably answer would damage trust more than no phone. The honest "one human, email, one-business-day" model is the right call — just make the window consistent and the channel findable.

---

## Customer-value bar — would a $10K/mo-problem owner feel blocked?

| Finding | Blocks a high-value owner? (1–5) | In body / appendix |
|---|---|---|
| Chat dead in prod (issue #1) | **5** — first instinct fails | Body |
| No KB / all help routes 404 (issue #2) | **4** — no after-hours self-help | Body |
| One inbox, no SLA (issue #3) | **4** — can't gauge if they're being handled | Body |
| In-app degraded = lead-capture (issue #4) | **4** — insulting at the trust moment | Body |
| Contradictory response windows (issue #5) | **4** — undercuts the human-partner pitch | Body |
| `/help` gated to BROKER_OWNER only | **4** — a team member can't get help | Body |
| No upset-customer FAQ path | **4** — "AI sent wrong thing" has no home | Body |
| `/login` 404 (real route `/app/sign-in`) | 3 — momentary friction | Appendix |
| No SOC 2 named on `/security` | 3 — trust, not support-blocking | Appendix (also Wave 1) |
| No status page during degraded state | 3 — annoyance, not a hard block | Appendix |

### Appendix (<4 — real but not blocking a $10K/mo problem)
- **`/login` 404.** A returning customer guessing `/login` gets a 404; the real route is `/app/sign-in`. Add a redirect.
- **No SOC 2/ISO on `/security`.** Trust gap for regulated verticals; not a support-channel block. (Cross-listed in Wave 1.)
- **No status/uptime page.** Today's resting-Plaino state has no honest status surface; an owner infers breakage. Covered in deep work #3.
- **Brand-at-handoff:** marketing ships the illustrated Plaino head-icon, the app still renders the geometric avatar (Wave 1 Design issue) — a support/success-relevant continuity nit but not a help-findability block.

---

## Evidence (all verified 2026-06-11)
- Live `POST https://agentplain.com/api/chat` (mode=marketing, correct `{role,body}` schema) → `{"ok":true,"degraded":true,"expandLeadCapture":true,"reply":"Plaino's resting just now…"}` (HTTP 200).
- Live route probes (curl `-o /dev/null -w %{http_code}`): `/help /support /contact /faq /docs /kb /knowledge-base /status /help-center /get-started /onboarding /resources /guides` → 404.
- `https://agentplain.com` header/footer + chat widget (WebFetch).
- `https://agentplain.com/custom`, `/security`, `/#faq`, `https://app.agentplain.com` (WebFetch).
- Repo `origin/main`: `app/api/chat/route.ts`, `lib/plaino/degraded-copy.ts`, `app/api/leads/capture/route.ts`, `app/(product)/app/workspace/[id]/help/{page,actions}.tsx`, `app/(product)/app/workspace/[id]/support/page.tsx`, `app/(product)/app/workspace/[id]/layout.tsx`, `lib/support/resolve-reply.ts`, `lib/skills/customer-support-triage/{index,config}.ts`, `lib/inngest/functions/support-handler-on-create.ts`.
- **Ledger correction:** Wave 2 synthesis says PR #221 (L1 support) is NOT merged. It IS on origin/main (commit `e3d8eca pfd-3: l1-support-triage`, `lib/skills/customer-support-triage/` wired into `support-handler-on-create.ts`). The triage layer is live but its auto-answer path is dormant while the Anthropic key is paused.


---

## Post-audit drift check (2026-06-11 EOD — main@47237e0, prod cabf36f)

- **STILL TRUE (all re-verified live today):** chat dead — `POST /api/chat` returns the identical paused reply (`degraded:true`, "Plaino's resting just now", `expandLeadCapture:true`); `/help /docs /status /contact /faq` all 404; `status.agentplain.com` unreachable; no support PR landed since the audit ref, so the response-window contradictions, BROKER_OWNER gate, and in-app lead-capture pivot stand as written.

## Estimated effort to clear backlog
- **Quick wins:** ~1 day, one front-door PR (header Help link, one response window everywhere, support-mode degraded copy + deep-link to the working /help form, role-gate drop, upset-customer FAQ entries, inline email channel in the resting chat).
- **Conner gate:** key restore (minutes) — revives all four conversational surfaces + L1 auto-answer at once.
- **Deep work:** public KB from the existing `RepoKbLoader`/`PRODUCT_KB` substrate 3–5d (doubles as the SEO surface); status/degraded banner system ~2d; urgency flag on /help ~1d.
- **Total: 1 PR + 1 Conner gate + ~1wk of deep work.** Lens 2.5 → ~3.5 on the PR + key; ~4 with the KB.
