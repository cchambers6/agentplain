# Voice Audit — 2026-06-19 (de-AI-fication baseline)

Inventory of AI-tic violations on agentplain customer surfaces, produced by
`tools/brand/voice-gate.mjs --all` against `origin/main` (`a34794a`). This is the **frozen
baseline** — the gate now ratchets from here, failing the build only on *new* tics. Fixing
the items below is **out of scope for this PR** (sibling de-AI-fication sessions own the
copy edits); this file is the work-list.

Catalog of what each rule means: `docs/brand/voice-guidelines-2026-06-19.md` §3.

---

## Headline

**31 violations across 16 files.** The notable result is what's *absent*: the vocabulary
families (VA "delve/tapestry/realm," VB "not just X — it's Y," VD essay-scaffolding) scored
**zero** on rendered surfaces. The existing canon — `brand-voice-scenario-library.md` plus
`brand-gate.mjs` R4 — already scrubbed the hype and the obvious LLM vocabulary. The "still
feels AI" residue is almost entirely **one structural tic: em-dash spam.**

| Rule | What it catches | Count |
|---|---|---:|
| VA | LLM-ese vocabulary (delve, tapestry, "navigate the landscape", …) | 0 |
| VB | Antithesis reflex ("not just X, it's Y") | 0 |
| VC | Sycophantic / chatbot register ("Great question!", "no problem at all") | 1 |
| VD | Essay scaffolding & launch-ese (Moreover, "Introducing", …) | 0 |
| VE | **Em-dash spam (3+ em-dashes in one line)** | **30** |
| | **Total** | **31** |

> **Interpretation for Conner:** the brand doesn't read AI because of buzzwords — that war
> is largely won. It reads AI because of *cadence*: sentences carrying three and four
> em-dash asides, the rhythm of a model that keeps interrupting itself. That's a cleaner,
> more mechanical fix than a vocabulary purge, and it's the single highest-leverage edit.

---

## Priority 1 — rendered product/marketing code (10 violations)

These render directly to customers in the app and on the marketing site. Highest priority.

| File:line | Tic | Note |
|---|---|---|
| `app/(marketing)/page.tsx:287` | 3×— | Homepage "work you don't love" section. Three asides in one sentence; split into two. |
| `components/faq-items.ts:38` | **5×—** | FAQ "what's the service" answer. The worst single line in the repo — a five-aside run-on numbered list. |
| `components/faq-items.ts:50` | 3×— | FAQ answer |
| `components/faq-items.ts:66` | 3×— | FAQ answer |
| `components/faq-items.ts:71` | 3×— | FAQ answer |
| `components/faq-items.ts:95` | 3×— | FAQ answer |
| `components/faq-items.ts:99` | 4×— | FAQ answer |
| `lib/verticals/home-services/content.ts:301` | 3×— | Per-vertical rendered content |
| `lib/verticals/title-escrow/content.ts:264` | 3×— | Per-vertical content. Note: this line is an internal methodology/citation note — verify it's customer-rendered before editing; if not, allowlist it. |
| `lib/verticals/title-escrow/content.ts:266` | 3×— | Same file, same caveat |

**`components/faq-items.ts` is the concentration** — 6 of 10 code violations. The FAQ
answers were written in a single over-dashed register. A focused rewrite of that one file
clears most of the rendered-surface debt.

## Priority 2 — outbound marketing copy in `docs/marketing/` (21 violations)

Cold emails, ad copy, sales scripts, landing-page source, newsletters. Customer-facing but
not rendered by the app; owned by the marketing/creative sessions.

| File | Tics |
|---|---|
| `docs/marketing/sales-scripts/real-estate.md` | 4× VE |
| `docs/marketing/sales-scripts/law.md` | 3× VE |
| `docs/marketing/ad-platform-copy/linkedin.md` | 3× VE |
| `docs/marketing/sales-scripts/cpa.md` | 2× VE |
| `docs/marketing/ad-materials/google-ads/finance.md` | 2× VE |
| `docs/marketing/dtc-materials/cold-emails/law.md` | **1× VC** ("no problem at all") |
| `docs/marketing/campaign-2026-06-06/SCRIPTS/C1-before-you-open-the-laptop.md` | 1× VE |
| `docs/marketing/campaign-2026-06-06/SCRIPTS/C5-the-73-call-tuesday.md` | 1× VE |
| `docs/marketing/dtc-materials/newsletter/issue-3.md` | 1× VE |
| `docs/marketing/dtc-materials/webinar/finance.md` | 1× VE |
| `docs/marketing/vertical-landing-pages/home-services.md` | 1× VE |
| `docs/marketing/vertical-landing-pages/law.md` | 1× VE |

The lone **VC** is `dtc-materials/cold-emails/law.md:150` — "no problem at all," a chatbot
softener in a cold email. One-word fix.

---

## What was deliberately NOT scanned

- **Hype family (E):** owned by `brand-gate.mjs` R4 (supercharge, seamless, leverage, …).
  No double-counting. Run `npm run brand-gate` for that inventory.
- **Teaching/reference docs:** `brand-voice-scenario-library.md`,
  `CREATIVE_PACK_GROUND_TRUTH.md`, `*GROUND_TRUTH*` — they intentionally contain bad
  examples and banned-word lists. Excluded by name in the gate.
- **Colocated tests** (`*.test.ts(x)`): carry deliberate bad strings.
- **Operator/internal surfaces:** the gate scopes to the customer-facing set
  (`app/(marketing)`, `app/(product)`, `components`, `lib/verticals`, `lib/plaino`,
  customer email templates, `docs/marketing` outbound copy) — the same surface brand-gate
  governs, plus outbound markdown.

## How to clear an item

1. Rewrite the line so it carries **at most two** em-dashes — usually by splitting one
   run-on into two sentences. (Em-dashes aren't banned; *spam* is. See guidelines §3.D.)
2. Re-baseline once a fix wave lands: `node tools/brand/voice-gate.mjs --baseline`, commit
   the shrunk `tools/brand/voice-gate-baseline.json`.
3. Genuinely intentional usage (e.g. a methodology note not shown to customers): add a
   `{ path, pattern }` entry to `tools/brand/voice-gate-allow.json` instead of baselining.

The target is a baseline that shrinks to zero, the same way `brand-gate.mjs` reached zero
across PRs #227–#234.
