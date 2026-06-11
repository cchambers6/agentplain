# Plaino icon families — brand mark vs live status

**Ratified by Conner, 2026-06-10.** There are **two** Plaino icon families and
they are **never mixed**. The old conflation — `head-icon.png` (a circle coin)
doing both jobs at 15+ sites, and `PlainoAvatar` accepting a `pose` prop it
ignored — is retired by this split.

## The rule

| Family | What it is | What it means | Where it goes |
| --- | --- | --- | --- |
| **`PlainoMark`** | The **8-bit pixel Plaino** brand mark. **Static.** | "This is agentplain." Identity only. | Site header lockup, footer, chat **entry point** + chat **header**, login, favicon / app icons, social cards, marketing chrome. |
| **`PlainoStatus`** | A **persona pose** illustration. **Live.** | The current state of a workflow, mapped to a behaviour. | Dashboard, action queue, integration health, workflow cards, activity feed, fleet/discipline headers. |

A **brand** surface never renders a pose. A **status** surface never renders
the 8-bit mark. If you're unsure which a surface is, ask: *is this saying "this
is agentplain" (brand) or "here's what Plaino is doing right now" (status)?*

## Status state → persona pose

`PlainoStatus` takes a `state` prop. The five core states:

| `state` | Meaning | Pose asset |
| --- | --- | --- |
| `sit` | idle / waiting / quiet | `poses/sitting-alert.png` |
| `fetch` | working / delivering a draft | `poses/fetching.png` |
| `herd` | organizing / queueing / running a chain | `poses/herding.png` |
| `alert` | needs attention / blocked | `poses/guarding.png` |
| `sleep` | paused | `poses/resting.png` |

Two extended states for richer postures (callers may pass them directly):

| `state` | Meaning | Pose asset |
| --- | --- | --- |
| `watch` | idle monitoring (no active work, eyes open) | `poses/standing-watch.png` |
| `scout` | search / research in progress | `poses/scouting.png` |

## Component contract

### `PlainoMark` (brand)

```tsx
import { PlainoMark } from "@/components/ui/ap";

<PlainoMark size={32} />            // decorative (aria-hidden) — paired wordmark labels it
<PlainoMark size={48} alt="Plaino" /> // stands alone → exposes the label
```

Props: `size?: number` (16–64, default 32), `className?: string`,
`alt?: string` (decorative when omitted). Renders the 8-bit raster with
`image-rendering: pixelated` via a plain `<img>` (not `next/image` — the
product surface is unit-tested under bare `node:test` `renderToStaticMarkup`).
**Pure mark** — the wordmark is composed separately by
`components/brand/LogoLockup.tsx`.

### `PlainoStatus` (live state)

```tsx
import { PlainoStatus } from "@/components/ui/ap";

<PlainoStatus state="fetch" size={24} />               // decorative — adjacent text names the state
<PlainoStatus state="alert" size={24} decorative={false} /> // announces "Plaino needs your attention"
```

Props: `state: PlainoStatusState` (the seven states above), `size?: number`
(default 24), `className?: string`, `alt?: string` (label override),
`decorative?: boolean` (default `true`). When `decorative={false}` and no
`alt` is passed, the state's default spoken label is announced via the image
alt text ("Plaino is fetching"). Renders the pose PNG via a plain `<img>`,
delegating to the low-level `Plaino` primitive.

## Do not use `Plaino` directly

`components/ui/ap/Plaino.tsx` is the low-level primitive (one PNG per pose). It
is **not** used directly in product or marketing surfaces — use `PlainoMark`
or `PlainoStatus`. The only direct callers of `Plaino` are `PlainoMark` /
`PlainoStatus` / `PlainoScene` internals and the OG image routes (heritage
state). `PlainoAvatar` is a **deprecated shim** that delegates to
`PlainoStatus`; do not add new call sites.

## Ratified swap inventory (this PR)

### Brand → `PlainoMark`

| Site | File |
| --- | --- |
| Site-header brand lockup (the Conner-flagged coin) | `components/brand/LogoLockup.tsx` |
| Marketing chat launcher + panel header | `components/marketing/PlainoWidget.tsx` |
| Support chat header + Plaino message attribution | `components/support/PlainoSupportChat.tsx` |
| `/talk` attribution + empty-state header | `app/(product)/app/workspace/[id]/talk/talk-view.tsx` |
| Memory page header | `app/(product)/app/workspace/[id]/talk/memory/page.tsx` |

### Status → `PlainoStatus`

| Site | File | State |
| --- | --- | --- |
| Workspace overview header | `app/(product)/app/workspace/[id]/overview-view.tsx` | `sleep` (paused) / `fetch` (drafts pending) / `sit` (quiet) — derived from live props |
| Activity feed rows | `app/(product)/app/workspace/[id]/activity/ActivityFeed.tsx` | `alert` (flagged/compliance) / `sit` |
| Fleet header | `app/(product)/app/workspace/[id]/fleet/page.tsx` | `herd` |
| Talk-to-fleet job prompt | `app/(product)/app/workspace/[id]/fleet/TalkToFleet.tsx` | `sit` |
| Disciplines attribution | `app/(product)/app/workspace/[id]/disciplines/page.tsx` | `herd` |
| Approvals queue indicator | `app/(product)/app/workspace/[id]/approvals/ApprovalCard.tsx` | `fetch` (default); `plainoState` prop overrides |
| Onboarding header | `app/(product)/app/workspace/[id]/onboarding/page.tsx` | `sit` |
| Operator media-fleet header (internal) | `app/(operator)/operator/fleet/media/page.tsx` | `herd` |

### Brand-gate follow-up

PR #228 adds `tools/brand/brand-gate.mjs`. After it merges, add **R5**: *no
direct `<Plaino` / `state="head-icon"` usage outside `components/ui/ap`
internals (PlainoMark / PlainoStatus / PlainoScene) and the OG image routes.*

## Links

- `feedback_plaino_is_a_robot_dog` — the persona that grounds the poses.
- `docs/brand/plaino-system.md` — the full pose system + asset pipeline.
