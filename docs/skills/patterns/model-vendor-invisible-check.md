# Pattern: model/vendor-invisible check on customer surfaces

**Group:** code/process (governance) · **Seeded by:** `docs/copy-rulings/2026-07-03/model-vendor-invisibility.md`, brand-gate rule R1 (`tools/brand/brand-gate.mjs`); memory: feedback_model_vendor_invisible_on_customer_surfaces.

## When to use — trigger phrases
- "I wrote customer-facing copy / UI / an email"
- "does this mention Claude / Anthropic / the model"
- reviewing any rendered surface before it ships

## Inputs
- The changed customer-rendered surface (marketing page, app UI string, email, PDF).

## Procedure
1. Grep the surface for vendor/model tokens:
   ```bash
   rg -i 'claude|anthropic|opus|sonnet|haiku|fable|gpt|llm|model|\bAI\b' <files>
   ```
2. For each hit, ask: **is this surface rendered to a customer?** If yes, rewrite in customer vocabulary ("Plaino," "your assistant," "Working," "Watching").
3. Confirm the only surviving vendor mentions are on the **allowed exception**: the `/privacy` and `/security` subprocessor lists.
4. Let brand-gate R1 enforce it in CI.

## Output
Customer surfaces name **Plaino** and describe *what happens*, never the vendor or model behind it.

## Guardrails
- **Sole exception = /privacy + /security subprocessor lists.** Everywhere else, vendor-invisible. (memory + copy ruling)
- **Use customer vocab, not engineer labels** — "Setting up / Working / Watching," not "LLM call / inference / agent run" (memory: feedback_customer_vocab_not_engineer).
- This is *load-bearing positioning*, not stylistic: we're a service layer on top of Claude, not a reseller of "Claude access." Naming the vendor undermines the whole frame.
- Compose with `voice-gate-check` and `truth-wave-no-fabrication`.

## Worked example
The 2026-07-03 model-vendor-invisibility ruling includes a grep audit table (file | line | content) of every customer-surface occurrence to scrub, and revokes an earlier positioning memo's permission to name the model. The scrub landed as a follow-up PR gated on voice-gate; the subprocessor lists on `/privacy` and `/security` were explicitly left untouched.
