# Creative discipline — 2026-06-06

> **Split ratified 2026-06-06 (`project_creative_vs_media_disciplines_2026_06_06`).**
> Creative and Media are **two peer disciplines**, both arms of `marketing`, both reporting to
> the CEO tier. **Creative** *makes* the work (this doc). **Media** *distributes* it
> (`docs/fleet/media-discipline-2026-06-06.md`). The split course-corrected PR #156, which had
> the makers reporting up through the Head of Media — wrong: a media (distribution) agent should
> not be producing creative.

**Creative is production.** It turns a brief into a finished asset: films, statics, copy, voice.
Its spine is the **creative-router** — the "ask first, improvise never" gate that routes every
creative-asset request to the right tool, or hands brand-defining work to a human. When the
asset is signed off, it's handed to **Media** for distribution.

Source of truth for the roster + reporting lines + standing crons is `lib/fleet/roster.ts`
(zod-validated; the operator panel and this doc both read it). Agent definitions live at
`~/.claude/skills/creative-*/SKILL.md`.

---

## The decision: Creative is a production discipline, not a 9th customer discipline

Like Media, Creative is an **internal arm of `marketing`**, not a customer-sellable discipline.
Every Creative agent carries `discipline: 'marketing'`; the production-vs-distribution split is
an internal org axis (`arm: 'creative' | 'media'` in `lib/fleet/roster.ts`), orthogonal to the
locked 8-discipline customer enum (`lib/disciplines/index.ts`). Adding `creative` to that enum
would surface a "make our ads" capability customers don't buy. So Creative gets its own home
(`lib/fleet/roster.ts` + `/operator/fleet/creative`) — observable without touching the locked
customer surface.

### The no-improv invariant (why this discipline exists)

Per `feedback_creative_assets_use_tools_or_humans`: **agents do NOT improvise brand assets in
raw SVG/PNG when a real design tool exists OR when the work is brand-defining.** This rule was
written after the fleet spent **350+ agent turns** hand-coding a pixel-art logo in raw SVG/PNG,
hit a craft ceiling, and shipped something Conner rejected. The creative-router enforces it:
every request is routed to a tool or to a human via `CreatorBrief` — never improvised.

---

## Org chart

```
Conner
└── CEO tier (b2b-ceo)
    ├── Creative Director .................... creative-director     [Class B]   ◀── this doc
    │   ├── Creative router ................. creative-router        (the tool-selection gate)
    │   ├── Video producer .................. creative-video-producer
    │   ├── Static designer ................. creative-static-designer
    │   ├── Copywriter — long-form .......... creative-copywriter-longform
    │   ├── Copywriter — direct response .... creative-copywriter-direct
    │   └── Voice / audio producer .......... creative-voice-producer
    └── Head of Media ........................ media-head            [Class B]   ◀── peer; see media-discipline doc
        └── (distribution — platform specialists + influencer + PR + analytics)
```

**Creative discipline: 7 agents** — **1 leadership (Class B)** (Creative Director) +
**6 production specialists (Class C)** (video, static, long-form copy, direct-response copy,
voice, + the creative-router). The Media discipline (13 agents) is documented separately.

**Reporting-line rationale:** the Creative Director heads the discipline and owns *brand
expression in every asset*. The makers and the router report to the Creative Director. The
**Head of Media is a peer** (both report to the CEO tier), not a manager — Creative makes the
work and hands it to Media to distribute.

---

## The creative-asset capability (the router + the human handoff)

This is the discipline's load-bearing machinery, shipped in
`feat/creative-asset-capability-2026-06-06`:

- **`creative-router`** (`~/.claude/skills/creative-router/SKILL.md`) — the single front door.
  Reads `docs/strategy/creative-asset-capability-2026-06-06/JOB_TO_TOOL_MATRIX.md` and runs a
  5-step decision: brand-defining? → ready tool? → needs-connection? → video-stack? → human.
- **The job-to-tool matrix + skill audit** (`docs/strategy/creative-asset-capability-2026-06-06/`)
  — which skill solves which job, and which are `[ready]` today vs `[needs-connection]`.
- **The human handoff** (`lib/creative-handoff/` + `CreatorBrief` + `/operator/creative-briefs`)
  — for brand-defining work (brand mark, mascot, figurative hero, photography direction, motion
  ident, hero print) the router assembles a portable brief packet and an operator dispatches it
  to an outside creator. **No agent renders the final brand asset.** The Creative Director runs
  the acceptance review when it comes back.

---

## Approval cascade

Per `project_hierarchical_approval_chain`:

1. **Creative-router** routes the request — names the tool, or files a `CreatorBrief` for a human.
2. **Maker** (Class C) produces with the named tool. (Brand-defining work is produced by a human.)
3. **Creative Director** reviews every asset for brand expression and accepts human deliveries
   (Class B). This sign-off is the gate between production and distribution.
4. The approved asset is **handed to Media** for distribution (Media runs its own plan → buy
   cascade; Conner approves any spend).

Creative makes; Media buys. No Creative agent ever runs a media buy.

---

## Standing crons

One Inngest function, registered in `app/api/inngest/route.ts`. It ships as an **honest stub**
(mirroring `b2b-ceo-daily`): registers, fires on schedule, runs through the disable-gate +
observability stack, costs **zero Anthropic tokens** until the CronDefinition runner port lands.

| Cron | Schedule (UTC) | Owner | Drafts |
|---|---|---|---|
| `media-weekly-creative-review` | Thu 14:00 | Creative Director | A creative-review queue — every in-flight asset checked against the brand system before it's handed to Media. |

The function id keeps its legacy `media-` prefix for Inngest registration stability; the cadence
belongs to Creative. Roster: `listCreativeCrons()` returns this one. Disable flag:
`INNGEST_FN_DISABLE_MEDIA_WEEKLY_CREATIVE_REVIEW` (`feedback_no_silent_vendor_lock`).

---

## Integration with existing work

### The AI video stack (`docs/marketing/campaign-2026-06-06/AI_VIDEO_STACK.md`)
The video/voice producers' tools are the verified picks from that research: Tella, Adobe Firefly
Generative Extend (cleanest licensing — B-roll on **real plates**), Runway / Luma Ray2,
ElevenLabs, Descript, Supademo / Arcade. **Standing rule: no human face and no product UI is
ever AI-generated** — AI touches weather, texture, time-passage, and motion-on-real-plates only.

### Brand-Voice work (the `brand-voice` plugin + `flatsbo-marketing-design` precedent)
The Creative Director is the human-in-the-loop **brand gate**, extending — not forking — the
brand-voice enforcement that already exists. Brand bar locked: *"Intelligence rooted in
reality."* Heritage, grounded, calm — never coastal-SaaS sleek, never AI-slop.

### Tooling (the creative-asset audit)
The makers reach for real design tools per the matrix — `anthropic-skills:pptx` (decks),
`canvas-design` (OG/markup), `frontend-design` (layout/UI), Figma + Adobe Express
(`[needs-connection]`) — never raw-SVG improvisation.

---

## Files

- `lib/fleet/roster.ts` — the roster (7 Creative + 13 Media) + the standing crons. Source of truth.
- `lib/fleet/roster.test.ts` — structure invariants (per-arm counts, class/tier split, reporting integrity).
- `lib/creative-handoff/` — the `CreatorBrief` packet builder + status machine + store.
- `app/(operator)/operator/fleet/creative/page.tsx` — the operator Creative panel.
- `app/(operator)/operator/creative-briefs/` — the human-creator handoff queue.
- `docs/strategy/creative-asset-capability-2026-06-06/` — skill audit + job-to-tool matrix + architecture.
- `docs/fleet/media-discipline-2026-06-06.md` — the peer Media discipline doc.
- `~/.claude/skills/creative-*/SKILL.md` — the 7 Creative agent definitions (not git-tracked; home-dir fleet).
