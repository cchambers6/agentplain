# Media discipline — 2026-06-06

The fleet now does **end-to-end media facilitation**, not just marketing strategy:
the creative + platform-expert agents that own the work from ad concept → live-campaign
plan → reporting. This doc is the org chart, the architectural decision behind where the
media fleet lives, and how it integrates with the existing Marketing + Brand-Voice work.

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
    └── Head of Media ......................... media-head            [Class B]
        ├── Creative Director ................. media-creative-director [Class B]
        │   ├── Video producer ............... media-video-producer
        │   ├── Static designer .............. media-static-designer
        │   ├── Copywriter — long-form ....... media-copywriter-longform
        │   ├── Copywriter — direct response . media-copywriter-direct
        │   └── Voice / audio producer ....... media-voice-producer
        └── Media Director .................... media-director         [Class B]
            ├── Meta specialist .............. media-meta
            ├── TikTok specialist ............ media-tiktok
            ├── YouTube specialist ........... media-youtube
            ├── LinkedIn specialist .......... media-linkedin
            ├── X / Twitter specialist ....... media-x
            ├── Google Ads specialist ........ media-google-ads
            ├── Pinterest specialist ......... media-pinterest
            ├── Reddit specialist ............ media-reddit
            ├── Influencer / creator partnerships  media-influencer-partnerships
            ├── PR / earned media ............ media-pr-earned
            └── Analytics + attribution ...... media-analytics-attribution
```

19 agents: **3 leadership (Class B)** + **8 platform specialists (Class C)** +
**8 creative production specialists (Class C)**.

**Reporting-line rationale:** the Creative Director owns the *makers* (anything that is a
brand-expressed asset — video, static, copy, voice). The Media Director owns *planning,
channels, and measurement* — so the platform specialists, plus influencer/PR (earned-media
planning) and analytics/attribution, report to the Media Director. Both directors report to
the Head of Media; the Head reports into the CEO tier; Conner sits above that.

---

## Approval cascade

Per `project_hierarchical_approval_chain` (agents → heads → CEOs → Conner):

1. **Specialist** (Class C) drafts the asset or plan.
2. **Creative Director** reviews every asset for brand expression; **Media Director** reviews
   every plan + budget split (Class B).
3. **Head of Media** greenlights the campaign.
4. **CEO tier → Conner** approves spend. Conner executes the paid placement — never an agent.

Creative cannot go to a media buy until the Creative Director signs; a media buy cannot be
proposed to Conner until the Head of Media greenlights.

---

## Standing crons

Three Inngest functions registered in `app/api/inngest/route.ts`. They ship as **honest
stubs** (mirroring `b2b-ceo-daily`): they register, fire on schedule, run through the
disable-gate + observability stack, and cost **zero Anthropic tokens** until the
CronDefinition runner port lands (the same port the b2b-* crons wait on). Schedules and
ownership are real and read from `lib/fleet/roster.ts`.

| Cron | Schedule (UTC) | Owner | Drafts |
|---|---|---|---|
| `media-weekly-creative-review` | Thu 14:00 | Creative Director | A creative-review queue — every in-flight asset checked against the brand system before any buy. |
| `media-platform-performance-digest` | Mon 15:00 | Media Director | A cross-channel performance read + a proposed reallocation (Conner approves any spend move). |
| `media-monthly-media-plan` | 1st of month 13:00 | Media Director | The month's channel mix, budget split, and earned-media calendar — a proposal, not a spend. |

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

- `lib/fleet/roster.ts` — the roster (19 agents) + the 3 standing crons. Source of truth.
- `lib/fleet/roster.test.ts` — structure invariants (count, class/tier split, reporting integrity).
- `lib/inngest/functions/media-weekly-creative-review.ts`
- `lib/inngest/functions/media-platform-performance-digest.ts`
- `lib/inngest/functions/media-monthly-media-plan.ts`
- `lib/inngest/functions/__tests__/media-crons.test.ts`
- `app/api/inngest/route.ts` — registers the three crons.
- `app/(operator)/operator/fleet/media/page.tsx` — the operator media panel.
- `app/(operator)/layout.tsx` — "Media" added to the operator console nav.
- `~/.claude/skills/media-*/SKILL.md` — the 19 agent definitions (not git-tracked; home-dir fleet).
