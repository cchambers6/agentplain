---
name: model-vendor-invisible
description: Ensure no customer-rendered surface names the underlying model or vendor — including in live conversation. Use when writing or reviewing marketing copy, UI strings, emails, PDFs, or sales scripts. The service is a layer on top of the model; naming the vendor breaks the frame. Sole exception - the /privacy and /security subprocessor lists.
---

# Model/vendor-invisible check

Customer surfaces name the product and describe what happens — never the model or vendor behind it. This is load-bearing positioning: a service layer on top of the model, not a reseller. It supersedes the earlier copy that implemented "built on Claude" literally on rendered pages.

## Procedure

1. Grep the changed surfaces:
   ```
   rg -i 'claude|anthropic|opus|sonnet|haiku|fable|gpt|openai|llm|\bmodel\b|\bAI\b' <files>
   ```
2. For each hit on a customer-rendered surface, rewrite in customer vocabulary — the product name, "your assistant," "Setting up / Working / Watching." Comparison copy goes vendor-generic ("vs generic AI tools," not "vs ChatGPT").
3. Confirm the only survivors are the `/privacy` + `/security` subprocessor lists (a compliance obligation, tabled separately in the ruling).
4. Track the scrub as a table — `Occurrence | File | Line | Content | Allowed / Requires scrubbing` — the ruling's grep-audit format; it makes review mechanical.
5. Let brand-gate R1 hold the line in CI.

## The conversational form (sales calls, support)

The standing response when a prospect asks which AI it runs on: *"We don't discuss which models we run — we manage that layer so you don't have to. What I can tell you exactly is what it does with your data and where every draft waits for your approval."* **Never confirm or deny a vendor name, in any direction, even casually** (discovery-playbook objection #6).

## Rules

- **Sole exception = subprocessor lists.** Everywhere else, invisible — including emails, PDFs, error states, and demo scripts.
- **Internal docs may name models** (loop prompts do) — the boundary is *rendered to a customer*; nothing internal ships to a surface without a gate pass.
- **Customer vocab, not engineer labels** — "Working," never "LLM call / inference / agent run"; sweep `rootingNote`-style content strings too, not just page copy.
- **Positioning, not preference:** internal/investor/sales-strategy docs may still discuss the vendor relationship; rendered surfaces may not.

## Example invocation

> **Input:** "Review the new FAQ before it lands."
>
> **Output shape:** the grep table (e.g. `components/FAQ.tsx:39,40,88 — requires scrubbing; app/(marketing)/page.tsx:~320–334 — requires scrubbing; /privacy subprocessor list — allowed`), rewritten lines in customer vocabulary, gates run, PR notes "vendor-invisible per the 2026-07-03 ruling."

## Compose with

[[voice-gate-check]] · [[truth-wave-check]] · [[brand-gate-check]] (R1 is the CI form) · [[ratified-frame-preamble]] (carries the rule into every pass)

## Origin

`docs/copy-rulings/2026-07-03/model-vendor-invisibility.md` (the ruling + 7-occurrence grep table; revokes the rendered-surface half of the 2026-06-06 wrapper positioning) · `feedback_model_vendor_invisible_on_customer_surfaces` (Conner mandate 2026-06-10) · conversational form: `docs/sales/deep-dive-2026-07-02/04-discovery-call-playbook.md` objection #6.
