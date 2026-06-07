# Media discipline — 2026-06-06

> **Split ratified 2026-06-06 (`project_creative_vs_media_disciplines_2026_06_06`).**
> This doc originally covered both production and distribution. They are now **two peer
> disciplines**: **Creative** *makes* the work (`docs/fleet/creative-discipline-2026-06-06.md`)
> and **Media** *distributes* it (this doc). Both report to the CEO tier; both are arms of
> `marketing`. The makers (video / static / copy / voice) + the creative-router moved to
> Creative; Media keeps the Media Director + platform specialists + influencer + PR + analytics.

**Media is distribution.** It takes a *finished* asset from Creative and decides where, how, and
when it runs: paid, earned, measured — from live-campaign plan → reporting. This doc is the
Media org chart, the architectural decision behind where the fleet lives, and how it integrates
with Marketing + Brand-Voice work.

Source of truth for the roster + reporting lines + standing crons is
`lib/fleet/roster.ts` (zod-validated; the operator panel and this doc both read it).
Agent definitions live at `~/.claude/skills/media-*/SKILL.md`.

---

## The decision: expand Marketing, do **not** add a 9th customer discipline

The brief asked us to decide and defend: *does Media become discipline #9, or expand
inside the existing Marketing discipline?* **Media expands inside Marketing.** It is the
production + platform-execution **arm** of the `marketing` discipline. Every media agent
carries `discipline: 'marketing'`.

Why, against the real architecture (not a clean-slate org):

1. **The 8-discipline enum is the *customer-facing* organizing unit.** `lib/disciplines/index.ts`
   is a locked zod enum that is a DB column on `WorkApprovalQueueItem`, a marketplace facet,
   and the approval-queue grouping key (`asDisciplineId`). Adding `media` to it would surface
   a "run our Meta ads" capability to **customers** — something they do not buy, and something
   `project_no_outbound_architecture` forbids agentplain from executing on anyone's behalf.

2. **This fleet is agentplain's OWN go-to-market machine** (per `feedback_agentplain_built_by_agents`).
   It produces agentplain's ads, films, and campaigns. It is not a per-customer / per-vertical
   product, so it must not enter the customer disciplines enum or the per-vertical rosters
   (`lib/verticals/<v>/content.ts`). Polluting either would mis-count the customer surface.

3. **Marketing already means "drafts the message."** The existing `content-calendar-drafter`
   skill (discipline `marketing`) drafts posts/emails/landing copy. Media is the layer that
   turns that message into **films, statics, voice, and live-campaign plans across platforms** —
   the same discipline, one altitude deeper. Splitting it out would fracture one story across
   two buckets.

So the media fleet gets its **own home** — `lib/fleet/roster.ts` + `/operator/fleet/media` —
which makes it observable **without** touching the locked customer surface. Best of both:
the work is first-class and visible; the customer disciplines stay clean.

### The no-spend invariant

Per `project_no_outbound_architecture`: **no media agent ever spends ad dollars.** Every
agent drafts and proposes — campaign plans, creative, budget splits, reallocations. Conner
(or, for a customer engagement, the customer's own system) executes the paid placement. The
platform specialists plan *into* the ads managers; they do not buy. This is the same
draft-and-propose posture every other agentplain agent holds.

---

## Org chart

```
Conner
└── CEO tier (b2b-ceo)
    ├── Head of Media ........................ media-head            [Class B]   ◀── this doc
    │   └── Media Director ................... media-director        [Class B]
    │       ├── Meta specialist ............. media-meta
    │       ├── TikTok specialist ........... media-tiktok
    │       ├── YouTube specialist .......... media-youtube
    │       ├── LinkedIn specialist ......... media-linkedin
    │       ├── X / Twitter specialist ...... media-x
    │       ├── Google Ads specialist ....... media-google-ads
    │       ├── Pinterest specialist ........ media-pinterest
    │       ├── Reddit specialist ........... media-reddit
    │       ├── Influencer / creator partnerships  media-influencer-partnerships
    │       ├── PR / earned media ........... media-pr-earned
    │       └── Analytics + attribution ..... media-analytics-attribution
    └── Creative Director .................... creative-director     [Class B]   ◀── peer; see creative-discipline doc
        └── (production pool — video / static / copy / voice + creative-router)
```

**Media discipline: 13 agents** — **2 leadership (Class B)** (Head of Media + Media Director)
+ **8 platform specialists (Class C)** + **3 earned/measurement specialists (Class C)**
(influencer, PR, analytics). The Creative discipline (7 agents) is documented separately.

**Reporting-line rationale:** the Media Director owns *planning, channels, and measurement* —
the platform specialists, plus influencer/PR (earned-media planning) and analytics/attribution,
report to the Media Director, who reports to the Head of Media. The **Creative Director is a
peer** discipline head (both report to the CEO tier), **not** under the Head of Media — Creative
makes the work, Media distributes it.

> **Documented call (the analytics wrinkle):** `media-analytics-attribution` stays in **Media** —
> it measures distribution. When an analytics read needs a *visualization*, that viz is a creative
> asset and routes through the **creative-router** like any other creative request. Measuring is
> Media; *making the chart* is Creative.

---

## Approval cascade

Per `project_hierarchical_approval_chain` (agents → heads → CEOs → Conner):

0. **Creative** hands Media a **finished, signed-off asset** (the Creative Director's sign-off
   is the gate inside Creative — see the creative-discipline doc).
1. **Specialist** (Class C) drafts the channel plan.
2. **Media Director** reviews every plan + budget split (Class B).
3. **Head of Media** greenlights the campaign.
4. **CEO tier → Conner** approves spend. Conner executes the paid placement — never an agent.

A media buy cannot be proposed to Conner until the Head of Media greenlights.

---

## Standing crons

Three Inngest functions registered in `app/api/inngest/route.ts`. They ship as **honest
stubs** (mirroring `b2b-ceo-daily`): they register, fire on schedule, run through the
disable-gate + observability stack, and cost **zero Anthropic tokens** until the
CronDefinition runner port lands (the same port the b2b-* crons wait on). Schedules and
ownership are real and read from `lib/fleet/roster.ts`.

All three function ids keep the legacy `media-` prefix for Inngest registration stability,
**but ownership split with the disciplines.** The two Media crons:

| Cron | Schedule (UTC) | Owner | Drafts |
|---|---|---|---|
| `media-platform-performance-digest` | Mon 15:00 | Media Director | A cross-channel performance read + a proposed reallocation (Conner approves any spend move). |
| `media-monthly-media-plan` | 1st of month 13:00 | Media Director | The month's channel mix, budget split, and earned-media calendar — a proposal, not a spend. |

`media-weekly-creative-review` (Thu 14:00) now belongs to the **Creative** discipline
(owned + approved by the Creative Director) — see the creative-discipline doc. Roster:
`listMediaCrons()` returns the 2 above; `listCreativeCrons()` returns the weekly review;
`listAllCrons()` returns all 3.

The Monday digest runs at 15:00, deliberately **after** the 13:00 customer
`content-calendar-drafter` sweep, so the two never contend for the same window.

Each has a disable flag (`INNGEST_FN_DISABLE_MEDIA_*`) as the in-house portability control
surface above Inngest, per `feedback_no_silent_vendor_lock`.

---

## Integration with existing work

### Marketing discipline (`lib/disciplines` + `content-calendar-drafter`)
Marketing **drafts the message**; Media **produces and places it**. The content calendar
remains the customer-facing weekly cadence; the media fleet is the internal GTM org that
turns agentplain's own message into films and campaigns. Same discipline id (`marketing`),
two altitudes.

### Brand-Voice work (the `brand-voice` plugin + `flatsbo-marketing-design` precedent)
The Creative Director is the human-in-the-loop **brand gate** for media, extending — not
forking — the brand-voice enforcement that already exists. Like `flatsbo-marketing-design`,
the Creative Director **refuses structurally off-brand briefs** rather than only fixing the
artifact. The brand bar is locked: *"Intelligence rooted in reality."* Heritage, grounded,
calm — never coastal-SaaS sleek, never AI-slop.

### AI video stack (`docs/marketing/campaign-2026-06-06/AI_VIDEO_STACK.md`)
The creative pool's tools are the verified picks from that research (vendor pages, 2026-06-06):
Tella (talking-head + produced screen), Adobe Firefly Generative Extend (the cleanest
licensing posture — primary B-roll on **real plates**), Runway / Luma Ray2 (directable
B-roll), ElevenLabs (one distinctive grounded voice), Descript (edit + captions),
Supademo / Arcade (interactive product demos). **Standing rule, baked into every relevant
SKILL: no human face and no product UI is ever AI-generated** — AI touches weather, texture,
time-passage, and motion-on-real-plates only. A heritage brand that ships obvious AI-slop
contradicts its own thesis.

### Research + ideation tools
Every agent can call **Bright Data MCP** for competitive / platform research and **Plaino
chat** for ideation — the same calm, grounded service-partner voice across the fleet.

---

## Autonomy + AI augmentation

- **Leadership runs autonomously** (`feedback_leadership_runs_autonomously`): the Head of
  Media, Creative Director, and Media Director each carry the mandate to look for how their
  corner of media should run better — and run it better — inside the approval cascade.
- **AI augmentation is the default** (`feedback_ai_augmentation_default`): every step in every
  SKILL asks *"can AI make this better?"* — better targeting, better variants, better
  attribution — before doing it the manual way.

---

## Files

- `lib/fleet/roster.ts` — the roster (20 agents across both arms: 7 Creative + 13 Media) +
  the 3 standing crons (1 Creative + 2 Media). Source of truth.
- `lib/fleet/roster.test.ts` — structure invariants (per-arm counts, class/tier split, reporting integrity).
- `lib/inngest/functions/media-weekly-creative-review.ts` — Creative-owned (legacy id prefix).
- `lib/inngest/functions/media-platform-performance-digest.ts`
- `lib/inngest/functions/media-monthly-media-plan.ts`
- `lib/inngest/functions/__tests__/media-crons.test.ts`
- `app/api/inngest/route.ts` — registers the three crons.
- `app/(operator)/operator/fleet/media/page.tsx` — the operator Media panel.
- `app/(operator)/operator/fleet/creative/page.tsx` — the operator Creative panel.
- `app/(operator)/layout.tsx` — "Creative" + "Media" in the operator console nav.
- `docs/fleet/creative-discipline-2026-06-06.md` — the peer Creative discipline doc.
- `~/.claude/skills/media-*/SKILL.md` + `~/.claude/skills/creative-*/SKILL.md` — the 20 agent
  definitions (not git-tracked; home-dir fleet).
