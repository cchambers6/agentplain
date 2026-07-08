---
name: model-vendor-invisible
description: Ensure no customer-rendered surface names the underlying model or vendor. Use when writing or reviewing marketing copy, UI strings, emails, or PDFs. The service is positioned as a layer on top of the model, not a reseller — naming the vendor breaks the frame. Sole exception: privacy/security subprocessor lists.
---

# Model/vendor-invisible check

Customer surfaces name the *product* and describe *what happens* — never the model or vendor behind it. This is load-bearing positioning, not style.

## Procedure

1. Grep the surface for vendor/model tokens:
   ```
   rg -i 'claude|anthropic|opus|sonnet|haiku|fable|gpt|llm|\bmodel\b|\bAI\b' <files>
   ```
2. For each hit on a **customer-rendered** surface, rewrite in customer vocabulary (the product name; "your assistant"; "Setting up / Working / Watching").
3. Confirm the only surviving vendor mentions are on the **allowed exception**: the `/privacy` and `/security` subprocessor lists.
4. Let a brand-gate rule enforce it in CI if one exists.

## Rules

- **Sole exception = /privacy + /security subprocessor lists.** Everywhere else, invisible.
- **Customer vocab, not engineer labels** — "Working," not "LLM call / inference / agent run."
- **This is positioning, not preference** — a service layer *on top of* the model, not a "Claude reseller." Naming the vendor undermines the whole business frame.
- **Compose** with the voice gate and the no-fabrication check.

## Origin

The model-vendor-invisibility copy ruling (`docs/copy-rulings/2026-07-03/model-vendor-invisibility.md`) with its grep-audit scrub table, and brand-gate rule R1 which mechanizes it.
