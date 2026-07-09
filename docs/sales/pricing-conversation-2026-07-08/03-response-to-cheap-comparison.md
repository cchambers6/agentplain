# 03 — "Seems expensive versus [FUB / Sierra / my CRM's AI]"

**Use when:** the prospect compares our price to a tool they already pay for or could buy. This is the most common price objection in the RE beachhead because Follow Up Boss, Sierra, and BoldTrail all have visible price tags and AI-flavored features.

**The rule that governs every answer here** (`docs/marketing/deep-dive-2026-07-02/01-competitive-positioning.md`, ratified frame): the comparison is **DIY vs. run-for-you**, never tool-vs-tool feature grids, and never against a model vendor. Their CRM is a *system of record* — it stores, organizes, and reminds. We are the *work between the records* — reading, drafting, chasing — delivered as drafts a human approves. We do not replace the incumbent; we take the typing out of it. Concede where the incumbent wins first (it builds trust, and it's true).

---

## 1. The short response — say this, then stop

> "It's a different line item, so I'd expect it to look expensive next to a tool. Follow Up Boss is a place your leads live — and it's good at that; keep it. Nobody at FUB writes your 9pm follow-up. The comparison isn't our price against your CRM's price. It's our price against the hours you spend doing the work *between* your tools — or the cost of nobody doing it."

## 2. The longer follow-up — the cost-of-time math

If they push, do the math out loud with *their* numbers from the discovery block:

> "Let's actually run it. You told me [their Tuesday answer — e.g. 'follow-ups and chasing eat two or three hours a day']. Call it ten hours a week, and put a producing broker's blended value on the hour — $120 is the number we model, but use yours. That's over $4,000 a month of your time going to drafting and chasing. Our modeled figure for a broker-owner is $4,100 to $6,200 a month recovered; call the midpoint $5,160. Against $199 a month, the service pays for itself in the first working week — that's roughly a 26-to-1 return, on our model, and I'll say plainly it's a model, not a customer-attested result. The trial and the money-back guarantee exist so you can test the model against your own week instead of trusting my math."

Sources: 8–12 hrs/wk × $120/hr × 4.3 = $4,128–$6,192/mo, midpoint $5,160, ~26× ROI (`lib/verticals/real-estate/content.ts:240-243`; claims spine §6). Price: `lib/pricing/tiers.ts:110-116`. Trial + guarantee: `lib/billing/facts.ts:27,51`.

## 3. The concrete-verbs move

Abstract "AI features" versus concrete work. Name the verbs the tool doesn't do:

> "Here's the test I'd honestly apply to any tool, ours included — ask what it *does*, in verbs. Your CRM **stores** the lead, **reminds** you the follow-up is due, maybe **suggests** a template. Here's our list: it **reads** the inbox overnight, **scores** the new lead, **drafts** the first-touch reply in your voice, **chases** the commission invoice that's three weeks late in QuickBooks, **writes** the transaction summary, and **waits** — everything waits in your queue until you approve it. If your current stack already does those verbs for you, genuinely, you don't need us and I'll say so."

*(Verbs must stay inside the live-integration story: email + calendar + QuickBooks + DocuSign + Drive, lead-triage/commission-chase/overnight-summary/monthly-report workflows — claims spine §6. Never claim a verb against a tool we don't connect: "Your [FUB] itself we don't read today — I won't pretend otherwise" is the required honesty when it comes up, per playbook objection #16.)*

## 4. Vendor-specific one-liners (RE beachhead)

Each concedes first, then repositions. From the competitive-positioning doc §1:

- **Follow Up Boss:** "If the pain is 'my leads aren't organized,' FUB first, honestly. Our best customers already run it. It's the system of record; we're the work around it — keep your CRM, we draft what it can't."
- **Sierra:** "Sierra couples your website and CRM — good at capture. Capture isn't the bottleneck you described; the 9pm-to-9am response and the chasing is. That work still lands on a human. We draft it; you approve it."
- **BoldTrail / kvCORE, or any 'it has AI now':** "Their automation *sends*; ours *drafts*. That difference sounds small until you remember a fair-housing slip in an auto-sent drip is a $26,262 first-offense HUD penalty. Our drafts get a fair-housing scan and a human approval before anything leaves — an auto-send tool structurally can't offer that." *(Penalty figure: claims spine §6, real-estate; the scanner is live for RE — do not claim it for other verticals.)*
- **"ChatGPT is $20" / any DIY-AI price point:** playbook objection #13, DIY-vs-run-for-you, never vendor-vs-vendor: "You can DIY it, and some do — it costs the thing you have least of: your evenings, to build and babysit it. A chat window answers when you ask; nothing happens when you don't. And there's no compliance pass, no approval queue, and no one accountable when it breaks at month-end." *(Never name or confirm what runs underneath us in this answer or any other — objection #6 is the sole handling.)*
- **"I could hire a VA for this":** playbook objection #12: "A good VA costs more per month, needs managing, and leaves with the training. They're also not exclusive — this makes your admin senior: reviewing drafts instead of typing them."

## 5. What never happens in this conversation

- **Never match a competitor's price or offer to.** The ladder is the price (`04-discount-and-concession-limits.md`). "We're priced against your hours, not against FUB" is the complete answer.
- **Never a rigged feature grid or a disparaging word.** Concede where they win first; it's the credibility that makes the reframe land (`/compare` pattern, positioning doc).
- **Never let the comparison become model-vendor-shaped.** If they steer to "so it's just [model] under the hood," that's objection #6 verbatim, and then straight back to verbs.
- **If price is genuinely the blocker after all of this:** it usually isn't price, it's unproven value. "Fair. Would three months free with a weekly call with me change the math?" — route to the design-partner conversation if a slot exists and they qualify, or log a NOT-YET with a date. Do not discount.
