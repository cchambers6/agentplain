# Copy Ruling — Model/vendor invisibility on customer surfaces

**Date:** 2026-07-03  
**Ruling:** Model vendor is invisible on every customer-rendered surface. No exceptions beyond the legal subprocessor disclosure already codified.  
**Load-bearing memory:** `feedback_model_vendor_invisible_on_customer_surfaces` (ratified 2026-06-11, shipped 2026-06-16, codified 2026-07-02)  
**Conflict resolved:** `project_sbm_wrapper_positioning_2026_06_06` (the 2026-05-15 positioning lock) allowed naming "Claude for Small Business" in the compare section. **This ruling supersedes that permission.** The load-bearing memory's own frontmatter (`priority: load-bearing`) settles the precedence.

---

## The rule

No customer-rendered surface — marketing pages, FAQ, dashboard, connectors, offer pages, emails — may name:

- Claude / Anthropic / Opus / Sonnet / Haiku
- OpenAI / ChatGPT / GPT
- Any foundation-model provider or model family name

The **one allowed exception** remains unchanged: `/privacy` and `/security` subprocessor lists may name Anthropic (and OpenAI when the embedding path is enabled) because subprocessor transparency is a compliance obligation. This is a **narrow** exception — subprocessor lists only, never inside a value or positioning claim.

---

## Why the SBM positioning memo's permission is revoked

`project_sbm_wrapper_positioning_2026_06_06` (ratified 2026-05-15, in response to Anthropic's Claude for Small Business launch) established that naming "Claude for Small Business" in a two-column compare section was acceptable — the strategic framing being "Claude gives you the tool; we run it for you."

That permission predates the vendor-invisible rule. The load-bearing memory resolves the conflict explicitly:

> "Resolution: the *positioning* ('we make Claude for Small Business usable for you') stays as the strategic frame; the *literal string* naming the model comes out of customer-rendered copy."

The positioning is intact. The string is not. Scrub the literal name; keep the contrast (tool vs. service, DIY vs. run-for-you).

---

## Grep audit — customer-surface occurrences requiring scrubbing

Grepped `app/(marketing)/`, `components/`, `app/(product)/` on 2026-07-03. Results below.

**DO NOT scrub in this PR. These are a follow-up.**

### Occurrences requiring scrubbing (non-subprocessor, customer-rendered)

| # | File | Line(s) | Content summary |
|---|------|---------|-----------------|
| 1 | `app/(marketing)/page.tsx` | ~320 | `eyebrow="Claude gives you the tool. We run it for you."` — rendered section eyebrow |
| 2 | `app/(marketing)/page.tsx` | ~323 | `Claude for Small Business, or a service partner who…` — rendered section title |
| 3 | `app/(marketing)/page.tsx` | ~327 | intro paragraph: "Anthropic's Claude for Small Business and OpenAI's ChatGPT are real, useful tools…" — rendered intro |
| 4 | `app/(marketing)/page.tsx` | ~334 | `Claude for Small Business (or any free chatbot)` — rendered compare column header |
| 5 | `components/FAQ.tsx` | ~39 | FAQ question: "How is this different from Claude for Small Business…" — rendered question text |
| 6 | `components/FAQ.tsx` | ~40 | FAQ answer naming "Claude for Small Business" — rendered answer |
| 7 | `components/FAQ.tsx` | ~88 | FAQ answer "Is my data safe?": "…processed by the AI providers that power the fleet (OpenAI for retrieval embeddings, Anthropic for drafting)…" — rendered answer |

**Total: 7 customer-surface occurrences** outside the allowed subprocessor exception.

### Allowed (subprocessor disclosure — no scrubbing needed)

| File | Content |
|------|---------|
| `app/(marketing)/security/page.tsx` (×2) | "Anthropic" in subprocessor connection list and no-training note |
| `app/(marketing)/privacy/page.tsx` | "Anthropic" in subprocessor table |

### Notes on occurrence #7 (FAQ "Is my data safe?")

This occurrence is in a gray zone — the intent is subprocessor-adjacent (telling the customer what processes their data), but it's in FAQ copy rather than the dedicated subprocessor list. The correct fix is to rewrite the sentence to point to the privacy policy for the subprocessor list rather than naming the providers inline. Example replacement:
> "…your content is processed by the AI providers that power the fleet and stored in our database under per-workspace isolation. The full data-handling specifics — including the current subprocessor list — live in our privacy policy."

---

## Scrub guidance for follow-up PR

For the compare section (`app/(marketing)/page.tsx`, occurrences #1–#4):
- Replace eyebrow: "Free chatbots give you the tool. We run it for you."
- Replace title: "Free chatbot, or a service partner who runs it for you?"
- Rewrite intro: keep the contrast (DIY horizontal model vs. run-for-you service), drop the named vendors. The strategic frame survives without the literal names.
- Replace left column header: "Free chatbot (or DIY AI tool)"

For the FAQ (`components/FAQ.tsx`, occurrences #5–#6):
- Rephrase the question to be vendor-neutral: "How is this different from DIY AI tools or free chatbots?"
- Rewrite the answer to describe the category (horizontal model, self-serve, you write the prompts) without naming a vendor.

For FAQ #7: use the replacement above (point to privacy policy).

---

## Implementation gate

Before any scrub PR lands: run the voice gate against the replacement copy to confirm no LLM-ese patterns (A–D) or brand-gate hype (R4) are introduced. The replacements above pass on their face.
