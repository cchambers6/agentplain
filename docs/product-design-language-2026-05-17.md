# agentplain — Product UI Design Language (2026-05-17)

**Status:** v1 — rulebook for every customer-facing product screen built after this date. Marketing surfaces (`app/(marketing)/**`) remain governed by `agentplain_brand_standards_v0.md`; this doc extends the brand into the *product* surface, where voice softens, density rises, and every screen reads as "your service team is at work for you."

**Audience:** every build task that touches `app/(product)/**` or `components/**` used inside the product shell.

**Authority order when this doc conflicts with anything else:**
1. `~/.claude/projects/C--agentplain/memory/project_agentplain_mission_and_positioning.md` (locked mission/vision/tagline + 9 questions)
2. `~/.claude/projects/C--flatsbo/memory/agentplain_brand/agentplain_brand_standards_v0.md` (visual + voice canon)
3. `docs/customer-surface-audit-2026-05-15.md` + `docs/copy-reframe-guidance-for-inflight-tasks.md` (service-partnership lock — the only canonical record of banned framings until `project_service_partnership_positioning.md` is written; flag that as a memory PR before any further reframe)
4. This file
5. The shipped components in `components/**` and `app/(marketing)/**`

**Verified ground truth this spec is anchored to (read these before deviating):**
- `lib/brand/tokens.ts:10-67` — palette, type families, locked tagline + wordmark
- `tailwind.config.ts:7-23` — token surface for utility classes
- `app/globals.css:8-72` — CSS variable definitions + `.eyebrow`, `.rule`, `.btn-primary`, `.btn-secondary`, `.container-wide`
- `app/layout.tsx:5-24` — Source Serif 4 / Inter / JetBrains Mono variable wiring
- `components/Section.tsx:13-48` — section rhythm
- `components/Header.tsx`, `components/Footer.tsx`, `components/FAQ.tsx`, `components/AgentCard.tsx`, `components/brand/Logo.tsx`, `components/marketplace/IntegrationTile.tsx` — heritage primitives already shipping
- `app/(product)/layout.tsx:18-35` — product chrome (minimal — replace per §3)
- `app/(product)/app/workspace/[id]/layout.tsx:38-77` — workspace shell (current sketch — make this canonical per §3)
- `app/(product)/app/workspace/[id]/page.tsx` — the overview page is the model "value loop view"
- `app/(product)/app/workspace/[id]/onboarding/page.tsx` — the model onboarding pattern
- `app/(product)/app/workspace/[id]/integrations/page.tsx` — the model marketplace

**Memory gaps surfaced while writing this doc** (file these before PR-D):
- `project_service_partnership_positioning.md` is referenced everywhere but doesn't exist in `~/.claude/projects/C--agentplain/memory/`. The lock lives in `docs/customer-surface-audit-2026-05-15.md` and `docs/copy-reframe-guidance-for-inflight-tasks.md` only.
- `feedback_brand_is_plain_not_plane.md` is referenced but doesn't exist. The rule (`plain`, not `plane`; rooted/heritage register; no aviation/orbital metaphors) is captured in §1 and §5 of this doc — promote to memory before the next surface ships.
- No v3 logo files in `C:\private\` at audit time. Wordmark remains the canonical mark per `agentplain_brand_standards_v0.md:17-30`; wheat / horizon / silo / lone-tree motifs are scoped here as *imagery* (§2.7), not logo variants.

---

## 1. Voice and tone for product UI

The marketing surface is heroic ("we lift up local businesses…"). The product surface is **calm, dense, specific, second-person, present-progressive.** The visitor has signed up — they don't need to be sold to. They need to feel that their service team is at work for them.

### 1.1 Register

| Lens | Marketing voice | Product voice |
|---|---|---|
| Subject | "agentplain" / "we" / "the fleet" | "your service team" / "your fleet" / "we" (acting on the user's behalf) |
| Tense | Aspirational present ("we install, we review, we customize") | Present-progressive ("Your fleet is drafting the morning replies right now") |
| Stance | Pitching | Reporting + handing back |
| Tempo | Long lede paragraphs | Two-line stat + one-line context |
| Punctuation | Em dashes earn their keep | Same, but periods dominate |
| Volume | Confident | Quiet confident |

**One-line test:** if a sentence on a product screen would also belong in a homepage hero, it's marketing voice and doesn't belong. Rewrite.

### 1.2 Empty states — `ApRootedEmptyState`

Pattern: **one image cue (line illustration or none), one sentence reporting reality, one sentence telling the user what changes that, one CTA.** No exclamation points. No "All clear!" No emoji.

✅ "No drafts in the queue. Your fleet is reading inbox traffic; the first batch usually lands by 9:14am ET. Connect another tool →"
✅ "No flags this week. The Compliance Sentinel ran 23 checks. Last run: Tuesday 06:00 ET."
✅ "No briefings filed yet. Your chief-of-staff agent posts the first one after tomorrow's overnight run."
✅ "Nothing on the list right now. The fleet surfaces work here as it lands."
❌ "All caught up! 🎉"
❌ "You're all set!"
❌ "Looks like there's nothing here yet."
❌ "Inbox zero — nice work!"

The existing `RunningNow` empty state at `app/(product)/app/workspace/[id]/page.tsx:260-298` is on-pattern. Reuse its shape.

### 1.3 Success messages

The fleet did the work; the user approved. The success copy reports what's been handed off — never celebrates.

✅ "Approved. Three drafts now sit in your Gmail outbox awaiting your send."
✅ "Disconnected Gmail. Your service partner was notified."
✅ "Scheduled for Tuesday 10:30. Calendar invite posted to your Google account."
✅ "Saved. Your fleet's next run picks up the new thresholds."
❌ "Success!"
❌ "Awesome, all done."
❌ "Great job!"
❌ "Your changes have been saved successfully!"

Existing flash banner at `app/(product)/app/workspace/[id]/integrations/page.tsx:135-178` is the reference implementation. Keep that pattern.

### 1.4 Error messages — plain, owned, actionable

The Brand Standards §9 wording is canonical:

> "We couldn't reach Follow Up Boss. We'll retry in 5 minutes; you can also re-auth in Settings → Integrations."

Structure: **what failed → what we're doing about it → what the user can do.** No stack traces, no "Something went wrong" generics, no "Oops!" Plain past tense on the failure, plain future on the retry, plain imperative on the user action.

✅ "Gmail OAuth expired. We've paused inbound reads; reconnect from Settings → Integrations to resume."
✅ "We couldn't reach Microsoft Graph. We'll retry in 5 minutes. If it keeps failing, your service partner is notified."
❌ "Oops! Something went wrong."
❌ "Error: 401 Unauthorized"
❌ "An unexpected error has occurred. Please try again later."

### 1.5 Loading states — `ApRootedLoader`

Drop "Loading…". The product is rooted in real systems; loading copy should say *what is actually happening*.

| State | Copy |
|---|---|
| Fetching the next page of approvals | "Reading the queue…" |
| OAuth handshake in flight | "Connecting your inbox…" |
| Draft generation | "Drafting…" |
| Sync against CRM | "Catching up with your CRM…" |
| First post-signup load | "Rooting in…" |
| Generic fallback | "One moment." |

Visual: a single hairline-thin progress strip in `clay` at 40% opacity slides left-to-right inside a `paper-deep` band — no spinners, no skeleton cards with bouncing gradients. If a state takes >800ms, add the relevant copy under the strip. Otherwise the strip alone is enough.

### 1.6 Confirmation modals — `ApHeritageConfirm`

Two paragraphs max. First paragraph: what's about to happen. Second paragraph: what becomes true/false after. Buttons: verb-led, lowercase verb + object, never "Confirm" or "Cancel".

✅ Disconnect dialog: "Disconnect Gmail? Your fleet stops reading new mail immediately. Drafts already in your review queue stay there. Reconnect anytime. — [disconnect gmail] [keep connected]"

### 1.7 Button labels — verb-led, lowercase phrase, never sentence-case marketing copy

| ✅ Use | ❌ Don't use |
|---|---|
| "approve draft" | "Submit" |
| "send sign-in link" | "Send" |
| "open workspace" | "Get Started!" |
| "disconnect" | "Yes, I'm sure" |
| "connect gmail" | "Authorize Now" |
| "see fleet" | "View Details →" |
| "continue onboarding" | "Next Step" |

The existing `.btn-primary` and `.btn-secondary` shapes at `app/globals.css:60-67` are canonical; the label text follows the rules above.

### 1.8 Banned word list — product surface

Compiled from `agentplain_brand_standards_v0.md` §9, `docs/customer-surface-audit-2026-05-15.md`, and `feedback_everything_tells_a_story.md`:

**Generic AI banalities** — *AI-powered, AI-driven, AI magic, intelligent automation, smart insights, supercharge, leverage, unlock, harness, empower*
**Self-serve framings** — *configure your agents, set up your fleet, try our tool, DIY workflows, customize your AI, build your bot, prompt-engineer*
**Hero/event copy on product surfaces** — *Awesome!, Great!, Welcome aboard, Let's get started, You're all set, Woohoo, Nice work, Way to go*
**Internal product-development language** — *V0, V1, alpha, beta, MVP, phase 0, pilot, pre-release*  *(reference: customer-facing "v1 · phase 1" stamp at `app/(product)/layout.tsx:23` should be removed before the next product surface ships)*
**Aviation / orbital / coastal-tech vocabulary** ("plain" not "plane") — *launch, orbit, propel, take flight, blast off, hyper-, ultra-, neural, mesh, fabric, platform-as-a-X*
**False urgency** — *Hurry!, Don't miss out!, Limited time!, Last chance!*
**Generic SaaS** — *Dashboard, Analytics, Insights, Workspace dashboard, AI assistant, Copilot*

The word **"plain"** is foundational. Plain = legible, plain-spoken, plains-rooted (wheat, horizon, land). Plain ≠ plane. Never invoke flight, lift-off, orbit, or coastal-tech aesthetics; the product is grounded, not airborne.

---

## 2. Visual language

### 2.1 Color tokens — actually-shipping palette

Verified against `lib/brand/tokens.ts:10-67` and `app/globals.css:10-20`. Every color below is already wired into Tailwind via `tailwind.config.ts:8`; consume them as utility classes (`bg-paper`, `text-ink`, `border-rule`) — never as inline hex.

| Token | Hex | Tailwind | CSS var | Use |
|---|---|---|---|---|
| `paper` | `#F7F4ED` | `bg-paper`, `text-paper` | `--color-paper` | Default light surface; 90%+ of every product screen |
| `paper-deep` | `#EDE9DE` | `bg-paper-deep` | `--color-paper-deep` | Workspace header strip, sticky preview panes, error-on-soft surfaces — used in `app/(product)/app/workspace/[id]/layout.tsx:40` and `onboarding/page.tsx:465` |
| `ink` | `#1A1A1F` | `text-ink`, `bg-ink`, `border-ink` | `--color-ink` | All body and heading text; CTA banner backgrounds |
| `ink-soft` | `#2E2E33` | `text-ink-soft` | `--color-ink-soft` | Secondary body text, lede paragraphs |
| `clay` | `#B65D3A` | `text-clay`, `bg-clay`, `border-clay` | `--color-clay` | Single-charge accent — one use per screen: primary CTA, eyebrow on the section the user should look at first, current-step indicator in onboarding |
| `clay-deep` | `#9A4D2F` | `bg-clay-deep` | `--color-clay-deep` | Hover state for clay CTAs only |
| `moss` | `#3F5C3F` | `text-moss`, `bg-moss/10`, `border-moss/40` | `--color-moss` | Verified / passed / connected states ONLY — never as a decorative green. Reference: `components/marketplace/IntegrationTile.tsx:99-100` connected-badge usage. |
| `flag` | `#B43A3A` | `text-flag`, `bg-flag/5`, `border-flag/40` | `--color-flag` | Compliance flag chip, hard error banner — never a primary CTA, never a hover, never decorative |
| `mute` | `#8C8478` | `text-mute` | `--color-mute` | Eyebrow text, captions, secondary timestamps, "Source:" citations |
| `rule` | `#E0DAC9` | `border-rule`, `divide-rule`, `bg-rule` | `--color-rule` | Every hairline rule between rows, cards, sections. Used as `bg-rule` inside grid-gap-px patterns to render 1px lines between cards (reference: `app/(marketing)/page.tsx:202`). |

**Forbidden color moves in product UI:**
- Inline hex strings in any TSX file — block on review
- New colors not on this list — file a brand PR, don't smuggle them in
- `clay` used twice on one screen
- `moss` used as a non-status accent (e.g. button hover, decoration)
- `flag` used for anything that isn't an actual error or compliance flag
- Tailwind opacity modifiers higher than `/40` on `moss` or `flag` — the muted band-around-status is the entire visual signal
- White (`#FFFFFF`) anywhere — `paper` is the substrate

### 2.2 Typography

Loaded via Next font in `app/layout.tsx:5-24`. Three families, one job each.

| Family | Variable | Tailwind | Job |
|---|---|---|---|
| **Source Serif 4** (400/500/600) | `--font-display` | `font-display` | Headings, hero numbers, single-line "value" copy, the wordmark |
| **Inter** | `--font-sans` | `font-sans` (default) | Body, buttons, form labels, navigation |
| **JetBrains Mono** (400/500) | `--font-mono` | `font-mono` | Eyebrows, timestamps, IDs, "Source:" citations, status badges, micro-labels |

Headings auto-pick `font-display` via the base layer at `app/globals.css:41-45` — don't double-class.

**Type scale (product surface)** — verified against shipped uses across `app/(product)/**`:

| Token (logical) | Tailwind | Px / line-height | Weight | Use |
|---|---|---|---|---|
| `display-lg` | `text-4xl md:text-5xl leading-tight` | 36/48 → 48/56 | 400 | Onboarding welcome, page H1 (reference: `onboarding/page.tsx:112-113`) |
| `display` | `text-3xl md:text-4xl leading-tight` | 30/36 → 36/40 | 400 | Workspace overview H1 (`workspace/[id]/page.tsx:164-166`) |
| `display-sm` | `text-2xl md:text-3xl leading-snug` | 24/32 → 30/36 | 400 | Card titles, tier-card taglines |
| `subhead` | `text-xl md:text-2xl leading-tight` | 20/28 → 24/32 | 400 | Section subheads, agent names in lists |
| `body-lg` | `text-[15px] leading-relaxed` | 15/24 | 400 | Lede paragraphs (`text-ink-soft`) — the canonical body size in product (referenced 40+ times across product pages) |
| `body` | `text-sm leading-relaxed` | 14/22 | 400 | Dense rows, table cells, list items |
| `caption` | `text-[13px] leading-relaxed text-mute` | 13/20 | 400 | Footnotes, helper text under inputs |
| `eyebrow` | `.eyebrow` class | 11/16, tracking 0.18em, uppercase, mono | 400 | Section labels — already in `app/globals.css:50-52` |
| `micro` | `text-[10px] tracking-eyebrow uppercase font-mono` | 10/14 | 400 | Status badges, kicker labels |
| `numeric-lg` | `font-display text-3xl leading-none` | 30/30 | 400 | Single-stat display in `TodaysProgress` (`workspace/[id]/page.tsx:425-426`) |

**Rules:**
- Never use Inter for headings. Never use Source Serif 4 for body — it reads as marketing.
- Never use bold serif (600) on a product screen unless it's a numeric stat in a one-line context.
- Lowercase sentence case for ALL headlines. No Title Case (`agentplain_brand_standards_v0.md` §3).
- Letter-spacing > 0 only on eyebrow / mono labels (already centralized as `tracking-eyebrow: 0.18em` in `tailwind.config.ts:18-20`).

### 2.3 Spacing scale

8px base, multiples of 8. Tailwind defaults are fine; the discipline is in *which step you pick.* For product surfaces:

| Use | Spacing | Tailwind |
|---|---|---|
| Tight (chip to label, icon to text) | 8px | `gap-2`, `p-2` |
| Inside-card row padding | 16px | `p-4` |
| Card body padding | 20-24px | `p-5`, `p-6` |
| Card body padding (spacious — workspace overview cards) | 32-40px | `p-8`, `p-10` |
| Between cards in a grid | 1px (rule shows through) or 24-32px | `gap-px` (with `bg-rule`) or `gap-6`, `gap-8` |
| Between sections inside a page | 40-64px | `space-y-10`, `space-y-12`, `space-y-16` |
| Page top/bottom padding | 40-80px | `py-10`, `py-16`, `py-20` |
| Hero top/bottom (CTA banners only) | 96-128px | `py-24`, `py-32` |

**Rule of thumb:** when a layout feels crowded, double the spacing before adding any other change (verbatim from `agentplain_brand_standards_v0.md` §5).

### 2.4 Radii — heritage softness, NOT rounded SaaS

Inputs, cards, modals, panels, badges, buttons: **`rounded-none` everywhere.** The shipped CTAs at `app/globals.css:61, 66` use `rounded-none`. Carry that through.

Two narrow exceptions and nowhere else:
1. **Avatars / circular initials** — full circles (`rounded-full`) when a member or service-partner initial appears.
2. **Editorial inline tags inside body copy** (rare; e.g. a `[draft]` chip embedded mid-sentence) — `rounded-sm` (2px) ok.

No `rounded-md`, no `rounded-lg`, no `rounded-xl`, no `rounded-2xl`, no `rounded-3xl`, no pills. If a corner radius "feels right," you are at risk of drifting toward generic SaaS — square it.

### 2.5 Shadows — paper-on-paper, hairline rule, no Material lifts

`agentplain_brand_standards_v0.md` §6: "No shadows. 1px hairline in `mute` at 20% opacity. Background = `paper` even on `paper` (use the hairline to define edge)."

Carry that through the product surface verbatim. **No `shadow-*` classes anywhere.** The hairline (`border border-rule`) defines edge. Hover states use *border darkening* (`hover:border-ink`), not shadow.

Modal overlays use `bg-ink/40` over the page — no shadow on the modal itself, just the hairline border.

Sticky nav / sticky preview pane: still `border border-rule` only. The sticky onboarding preview at `onboarding/page.tsx:464-499` is the reference — copy it.

### 2.6 Imagery rules — wheat / horizon / silo / lone-tree, used sparingly

The brand metaphor is **plains** — wheat, horizon, silo, lone-tree, fence line. Use these *sparingly* on the product surface; the product's job is to do the work, not to art-direct.

**When to invoke a plains motif:**
- **Empty states** at top of feature areas (Approvals empty, Briefings empty, Compliance empty) — a single line-illustrated lone tree or distant silo in `ink` on `paper`, 96-128px tall, left-aligned, never centered, never zoomed.
- **First-load welcome strip** in onboarding — one hairline horizon line behind the headline, no fill.
- **Sign-up / sign-in / verify pages** — the upper-left quarter of the page carries one motif (wheat-grain stalk, silo silhouette, lone-tree). Calm, decorative, never the focal point.

**When NOT to invoke imagery:**
- Anywhere inside a working surface where the user is doing the work (approvals queue, compliance triage, agent detail, settings forms, billing). Imagery there is filler — `feedback_everything_tells_a_story.md` calls it out.
- Onboarding step bodies (the work) — only the header and the sticky preview pane carry motif.
- As a fallback for an empty data table — the prose copy is the empty state; an image without copy is decorative.

**Visual rules for the motifs themselves:**
- Single color: `ink` on `paper`, OR `mute` on `paper-deep`. Never two-tone, never gradient, never filled.
- Stroke: 1.5px, matches the `IntegrationTile` icon stroke at `IntegrationTile.tsx:151`.
- Composition: off-center left, asymmetric, horizon line low. The visual should feel like a landscape margin sketch, not a logo.
- No drone-shot photos. No agents-in-suits stock. No abstract gradient backgrounds. No "AI orb" mascot. Per `agentplain_brand_standards_v0.md` §7.

**The wordmark is the brand mark.** No "agent + wheat" combo mark inside the product chrome. The favicon (`a` only) is the only acceptable mark below 88px wide.

### 2.7 Iconography style

Single source of truth: **Lucide-style 1.5px stroke, never filled, `currentColor`.** The shipped marketplace icons at `IntegrationTile.tsx:143-223` are the canonical pattern — match their `viewBox: 0 0 24 24`, `strokeWidth: 1.5`, `strokeLinecap: 'round'`, `strokeLinejoin: 'round'`.

Forbidden:
- Filled (solid) icons
- Two-tone or gradient icons
- Neon outlines
- Geometric-isometric icons (the SaaS cliché)
- Emoji as icons
- Heroicons solid variants

When a new icon is needed and Lucide doesn't carry it, write a custom SVG using the same `svgProps` helper. Keep it under 32px logical size. Never larger than 32px in any product chrome except the integration-tile primary mark (28px).

---

## 3. Layout primitives

### 3.1 App shell — `ApAppShell`

The current `app/(product)/layout.tsx:18-35` is a thin product chrome and the workspace layout at `app/(product)/app/workspace/[id]/layout.tsx:38-77` adds the workspace strip + horizontal nav. **Make the workspace shell canonical** and lift it one level. Replace the current `(product)` layout with this shape:

```
┌───────────────────────────────────────────────────────────────────┐
│ HEADER  ── 56px tall, border-b border-rule, bg-paper             │
│   [logo:sm]                          [member-email]  [sign out]   │
├───────────────────────────────────────────────────────────────────┤
│ WORKSPACE STRIP  ── bg-paper-deep, border-b border-rule           │
│   {eyebrow: workspace-slug}                                       │
│   {display: Workspace Name}                                       │
│   ─── nav ───                                                     │
│   Overview · Agents · Approvals · Compliance · Briefings ·        │
│   Integrations · Settings                                         │
├───────────────────────────────────────────────────────────────────┤
│ MAIN  ── container-wide, py-10                                    │
│   {page content}                                                  │
├───────────────────────────────────────────────────────────────────┤
│ FOOTER  ── 40px, border-t border-rule, font-mono text-mute        │
│   [logo:sm]                                          [year]       │
└───────────────────────────────────────────────────────────────────┘
```

**No sidebar.** The product is wide, calm, and reads top-to-bottom. A sidebar invites "dashboard" syndrome (KPI walls, hyperactive widgets); the horizontal nav inside the workspace strip carries the same affordance with a quieter footprint. Mobile: nav scrolls horizontally — already implemented at `layout.tsx:62`.

**Workspace strip rules:**
- Always carries the workspace slug as eyebrow and workspace name as display
- Always carries member email + role + sign-out in the upper-right
- Nav links are plain text, no background fill, no underline by default; active route uses `text-ink` and an inline `clay` 2px underline (8px tall via `pb-2 border-b-2 border-clay`). Inactive uses `text-ink/70`.

**Banned shell variants:**
- Left sidebar (Material / Linear / Notion clone)
- Top bar with global search + bell icon + avatar dropdown (SaaS cliché)
- A "command palette" trigger in the chrome (the surface itself is the affordance)
- Persistent floating help bubble in the lower-right

### 3.2 Cards / lists / tables — `ApPaperCard`, `ApHairlineList`, `ApHeritageTable`

**`ApPaperCard`** — the workhorse container. Rules:
- `bg-paper p-6 md:p-8` (spacious) or `bg-paper p-5` (dense)
- `border border-rule` for the edge
- Hover affordance only if the card is clickable: `transition hover:border-ink`. Never `hover:shadow-*`, never `hover:bg-paper-deep` for cards (reserved for tiles).
- Eyebrow at the top (mono micro), display title second, body third, action last.
- One CTA per card maximum. Multiple CTAs = the card is doing two jobs; split it.

Reference: every card under `workspace/[id]/page.tsx`.

**`ApHairlineList`** — for queues, activity feeds, handoff logs. Rules:
- Outer wrapper: `border border-rule bg-paper`
- Rows: `divide-y divide-rule`
- Per-row padding: `px-5 py-4`
- Each row: monospace timestamp on the right, display/body label on the left, never both flexed to fill — left is `flex-1`, right is `whitespace-nowrap font-mono text-[11px]`.

Reference: `workspace/[id]/page.tsx:300-321` (handoffs list), `workspace/[id]/approvals/page.tsx:40-79`.

**`ApHeritageTable`** — for billing rows, invoice lists, vertical metadata grids. Rules:
- 1px hairline rules between rows, never zebra striping (per `agentplain_brand_standards_v0.md` §6)
- Numerical columns right-aligned, text columns left-aligned
- Column heads: `eyebrow` class
- Optional: render as a CSS grid with `gap-px bg-rule` so the rule becomes the visual separator (already a pattern at `workspace/[id]/settings/page.tsx:41`).

### 3.3 Forms — `ApHeritageField`, `ApHeritageInput`, `ApHeritageToggle`

**Inputs:** bordered on product surfaces, per `agentplain_brand_standards_v0.md` §6 ("bordered on app surfaces. Never both").

```
┌───────────────────────────────────────────┐
│ EMAIL                          ← eyebrow │
│ ┌─────────────────────────────────────┐  │
│ │ you@firm.com                        │  │
│ └─────────────────────────────────────┘  │
│ We send a magic link.          ← caption │
│ ─── inline-error space, when present ──  │
│ Couldn't reach the mailer.     ← flag    │
└───────────────────────────────────────────┘
```

Rules:
- Label = mono eyebrow above the field, never to the left, never inside
- Input: `border border-rule bg-paper px-3 py-2 text-[15px]`, focus state `focus:border-ink outline-none`, no ring, no glow
- Helper text (caption) under input, never to the right
- Inline error: `text-flag` text under the field, role="alert" — already implemented at `sign-in/SignInForm.tsx:36-40`
- Field group spacing: `space-y-4` between fields in a stack
- Form actions: separated from the form body by a hairline (`border-t border-rule pt-6`) — pattern at `onboarding/page.tsx:142-167`

**Toggle / chip rows** (vertical, tone, multi-option pickers):
- Chips are unrounded (`rounded-none` implicit), bordered, mono micro text, uppercase, tracking-eyebrow
- Selected: `border-clay bg-clay text-paper`
- Unselected: `border-rule bg-paper text-mute`
- Pattern at `onboarding/page.tsx:407-424`

**No floating labels. No placeholder-as-label.** The label is always above; the input is always visible.

### 3.4 Modals / sheets — `ApHeritageConfirm`, `ApPaperSheet`

**Modal (`ApHeritageConfirm`)** — for destructive or commit actions only (disconnect, cancel subscription, reject all):

```
┌───────────────────────────────────────────────────┐
│  ··· (overlay: bg-ink/40) ···                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ {eyebrow: confirm}                          │  │
│  │                                             │  │
│  │ Disconnect Gmail?                  display  │  │
│  │                                             │  │
│  │ Your fleet stops reading new mail           │  │
│  │ immediately. Drafts already in your         │  │
│  │ review queue stay there. Reconnect          │  │
│  │ anytime from Settings.                      │  │
│  │                                             │  │
│  │ ─── rule ───                                │  │
│  │            [keep connected]  [disconnect]   │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

- Width: `max-w-md`, never wider
- Padding: `p-6 md:p-8`
- Border: `border border-rule bg-paper`, no shadow, no radius
- Title: display-sm
- Body: body-lg, two short paragraphs max
- Actions: footer separated by `border-t border-rule pt-5`, right-aligned, secondary action first, primary action right-most
- Primary action for destructive ops uses `bg-flag/0 border-flag text-flag` outline style — not clay (clay is for affirmative CTAs)
- Backdrop dismiss enabled; ESC closes; no animation past 120ms

**Sheet (`ApPaperSheet`)** — for inspecting a draft, an integration detail, an agent profile inside the current page context (right-side slide-in, 480-640px wide, full-height):

- Border-left `border-rule`, `bg-paper`
- Same header pattern as a page: eyebrow + display + close (×) in upper-right
- Body uses page rhythm — `space-y-8`
- No drag handle, no rounded top corners, no shadow
- Animation: 180ms ease-out, translate-x only, no fade

### 3.5 Empty states — `ApRootedEmptyState`

Already specified in §1.2. The canonical visual:

```
┌────────────────────────────────────────────────────┐
│ {eyebrow: section name}                            │
│                                                    │
│ ┌──────────────────────────────────────────────┐   │
│ │                                              │   │
│ │   ╱╲                                         │   │
│ │  ╱  ╲   ← single line-illustrated motif      │   │
│ │  └──┘     (lone tree / silo / wheat stalk)   │   │
│ │  ────                                        │   │
│ │                                              │   │
│ │  No drafts in the queue.                     │   │
│ │  Your fleet is reading inbox traffic;        │   │
│ │  the first batch usually lands by 9:14am ET. │   │
│ │                                              │   │
│ │  [connect another tool →]                    │   │
│ │                                              │   │
│ └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

Rules:
- Container: `border border-rule bg-paper p-6 md:p-8`
- Motif: optional, top-left, 64-96px tall
- Headline: body-lg `text-ink`, single sentence, what's currently true
- Body: caption `text-mute`, single sentence, what changes that
- CTA: secondary button (`.btn-secondary`), single verb-led label

### 3.6 Loading states — `ApRootedLoader`

Already specified in §1.5. Visual:

```
{display heading remains visible}

────────────────────────────────────── ← 1px hairline strip
████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ← clay/40 progress, 1.5px tall
                                          slides left → right, 1200ms loop

Reading the queue…                     ← caption text-mute, only if >800ms
```

No spinners. No skeleton cards with shimmer. No "Loading…" generic. No Material `<CircularProgress />`.

---

## 4. Screen specs

Each screen below carries (a) story arc — which of the 9 questions / functional needs it serves; (b) layout sketch; (c) copy specifics; (d) banned moves specific to that screen.

### 4.1 Sign-up — `/app/sign-up`

**Story arc:** Q3 (what does the app do) + Q5 (how easy) — already answered on marketing; now confirm and capture.

**Current state (verified):** `app/(product)/app/sign-up/page.tsx` renders centered single-column. Keep that. Refinements below.

```
┌───────────────────────────────────────────────────┐
│ HEADER  (logo only — no nav)                      │
├───────────────────────────────────────────────────┤
│   ┌─ wheat stalk motif (left, 96px) ─┐            │
│                                                   │
│   create a workspace                  ← eyebrow   │
│                                                   │
│   Set up your workspace on            ← display   │
│   agentplain.                                     │
│                                                   │
│   First month is on us. Your service              │
│   partner picks up your install         ← body-lg │
│   within one business day.                        │
│                                                   │
│   {SignUpForm — vertical + tier + name + email}   │
│                                                   │
│   ─── rule ───                                    │
│   Already have an account? sign in →              │
└───────────────────────────────────────────────────┘
```

**Copy rules:**
- Drop "pick a tier" as the primary scaffolding line — say "Set up your workspace" and let the form's per-field labels do the work
- Banned: "Try our platform", "Try the product free", "Get instant access"
- Required: name the service partner anywhere in the body ("Your service partner picks up your install…")

### 4.2 Onboarding welcome — `/app/workspace/[id]/onboarding` (step 0 / first load)

**Story arc:** introduces the service partner (not the tool). Reframes the existing pattern at `onboarding/page.tsx:100-184` — current pattern is good; just promote the welcome strip to a full step-0 panel.

```
┌─────────────────────────────────────────────────────────────┐
│ {workspace strip}                                           │
├─────────────────────────────────────────────────────────────┤
│ onboarding · welcome                          ~10 minutes   │
│                                                             │
│ Hi {firstName}. I'm {service-partner name}. ← display       │
│ Let's get your fleet rooted in your shop.                   │
│                                                             │
│ Three quick steps — confirm a few details,                  │
│ tell us which tools to read from, set                       │
│ your drafting tone. I take it from there.                   │
│                                                             │
│ ┌─────────── progress strip ───────────┐                    │
│ │ step 1 · in progress │ step 2 · next │ step 3 · next │   │
│ │ Confirm details      │ Connect tools │ Set tone      │   │
│ └────────────────────────────────────────────────────┘     │
│                                                             │
│ ┌─ form panel ─────────┐  ┌─ sticky preview ──────┐         │
│ │ {step body}          │  │ {workspace card}      │         │
│ │                      │  │                       │         │
│ │ [continue]           │  │ updates as you go     │         │
│ └──────────────────────┘  └───────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**Copy rules:**
- Headline introduces the service partner by name (first name only on first introduction, then "your service partner" thereafter)
- Body never says "configure" or "set up your AI" — even the verb-pickers say "tell us" / "let us know"
- Each step's helper text reports what the user is GIVING US to work with, not what they're CONFIGURING
- "Skip for now" remains on `connect_integration` step — preserve `onboarding/page.tsx:152-161`

### 4.3 Workspace landing / overview — `/app/workspace/[id]`

**Story arc:** the daily report-back. Q4 (what makes us different — the fleet is at work and you can see it), Q6 (proof — every action visible).

**Verified ground truth:** `app/(product)/app/workspace/[id]/page.tsx` is the model. The current layout already follows the three-section pattern below — codify it as the canon. Two adjustments only:

```
┌──────────────────────────────────────────────────────────────┐
│ {workspace strip}                                            │
├──────────────────────────────────────────────────────────────┤
│ morning, {first}                              ← eyebrow      │
│                                                              │
│ Today's work, real-estate edition.            ← display      │
│                                                              │
│ Your fleet is doing the work that doesn't                    │
│ need you, so you can focus on the work that      ← body-lg   │
│ does. Approve, edit, or reject — your existing               │
│ tools send.                                                  │
│                                                              │
│ Vertical · Real Estate   Tier · Regular                      │
│                                                              │
│ {onboarding strip — only if !onboardingComplete}             │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────┐ ┌──────────────────┐      │
│ │ WHAT'S RUNNING NOW             │ │ TODAY'S PROGRESS │      │
│ │ (handoff log, 6 most recent)   │ │ • Drafts ready   │      │
│ │                                │ │ • Flags surfaced │      │
│ │                                │ │ • Hours returned │      │
│ │                                │ ├──────────────────┤      │
│ │ TODAY'S BRIEFING               │ │ NEXT ACTIONS     │      │
│ │ (chief-of-staff agent post)    │ │ • {action 1}     │      │
│ │                                │ │ • {action 2}     │      │
│ │                                │ │ • {action 3}     │      │
│ └────────────────────────────────┘ └──────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

**Adjustments to ship:**
- Remove the `Per-vertical fleet initializing — early-access workspace` flag styling at `workspace/[id]/page.tsx:192-196` — replace with mute color, not `text-flag`. The current usage makes initialization look like an error.
- The "hours returned" stat shows `—` until handoffs land (already correct at `workspace/[id]/page.tsx:97`). Hold that line — don't fabricate a number.

**Banned moves:**
- Adding a fourth column ("This week", "All time", "Tier usage", etc.) — three is the answer
- Sparkline charts / mini bar charts inside Stat cells (no charts in the overview at all in v1)
- Color-coded "urgency" pill on `Next actions` other than the existing `flag` / `mute` two-state pattern

### 4.4 Marketplace — `/app/workspace/[id]/integrations`

**Story arc:** Q5 (how easy) — connect Gmail / connect other tools, framed as "your service partner takes it from there."

**Verified ground truth:** `app/(product)/app/workspace/[id]/integrations/page.tsx` is on-pattern. Codify; do not redesign.

```
┌──────────────────────────────────────────────────────────────┐
│ {workspace strip}                                            │
├──────────────────────────────────────────────────────────────┤
│ your tools                                       ← eyebrow   │
│                                                              │
│ Integrations — your service partner          ← display       │
│ connects these for you.                                      │
│                                                              │
│ Tap a tool to start a connection. Your                       │
│ service partner picks it up, finishes        ← body-lg       │
│ the wiring, and tells you when it's ready.                   │
│                                                              │
│ {flash banner — if connected/error/disconnected}             │
│                                                              │
│ 3 CONNECTED · 7 AVAILABLE · 12 COMING SOON   ← micro mono    │
│                                                              │
│ ┌─ tile ─┐ ┌─ tile ─┐ ┌─ tile ─┐                             │
│ │ Gmail  │ │ Hub-   │ │ Quick- │                             │
│ │ ●conn  │ │ Spot   │ │ Books  │                             │
│ │        │ │ ●avail │ │ ●soon  │                             │
│ │[manage]│ │[connect│ │[wait-  │                             │
│ │        │ │  →]    │ │ list →]│                             │
│ └────────┘ └────────┘ └────────┘                             │
│ (grid: 1 / 2 / 3 cols at breakpoints, 1px rule between)      │
│                                                              │
│ Disconnecting is one tap. Your service                       │
│ partner keeps an audit trail either way.   ← caption mute    │
└──────────────────────────────────────────────────────────────┘
```

**Tile rules** (already shipped at `IntegrationTile.tsx`):
- Icon top-left, status badge top-right
- Category eyebrow, product name display-subhead, account email mono caption (if connected)
- Description body, two-line cap
- Bottom action: `[connect]` clay button on `available`, `[manage]` text-link with arrow on `connected`, `[join waitlist]` outline button on `coming-soon`

**Banned moves:**
- Tiles with logo art instead of line icons — the line icons are the brand. If a vendor demands their logo, render it monochrome at 60% opacity, never the full color mark.
- A "search the marketplace" input — the tiles are scannable; search invites the cliché.
- Sort/filter UI — categorize by status, period.

### 4.5 Value loop view — daily activity feed (sub-route of overview)

**Story arc:** Q4 + Q6 — every agent action visible, nothing behind the curtain. This is the "open the laptop and see what happened overnight" view.

The activity feed renders as `ApHairlineList` rows; today this lives inside Workspace Overview as `RunningNow`. Make it expandable to a full-page list view at `/app/workspace/[id]/activity` once volume exceeds 6 handoffs/day.

```
┌──────────────────────────────────────────────────────────────┐
│ what's been happening                            ← eyebrow   │
│                                                              │
│ Activity                                        ← display    │
│                                                              │
│ Every handoff your fleet has executed in the                 │
│ last 48 hours. Nothing happens behind the     ← body-lg      │
│ curtain — flagged items move to Compliance.                  │
│                                                              │
│ ┌─ filter strip (subtle) ───────────────────────┐            │
│ │ All · Drafts · Handoffs · Schedules · Reads   │            │
│ └───────────────────────────────────────────────┘            │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ chief-of-staff → buyer-inquiry-router · routed     08:12 │    │
│ │ Lead from Zillow tagged "hot buyer," queued for review.│    │
│ ├──────────────────────────────────────────────────────┤    │
│ │ inbox-router → drafter · drafted reply             08:11 │    │
│ │ 4 inbound messages, 3 drafts in your approval queue.   │    │
│ ├──────────────────────────────────────────────────────┤    │
│ │ showing-scheduler → calendar · proposed            07:48 │    │
│ │ Tuesday 10:30 slot proposed to Sarah Chen.              │    │
│ ├──────────────────────────────────────────────────────┤    │
│ │ compliance-sentinel → reviewer · flagged ●         07:14 │    │
│ │ Subject line near a fair-housing trigger; held for owner│    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│  [see older →]                                   ← link only │
└──────────────────────────────────────────────────────────────┘
```

**Row rules:**
- Left: monospace agent-name on both sides of an arrow + handoff type + status dot if flagged
- Right: monospace timestamp
- Below the title: one-line plain-English description in `text-ink-soft`
- Flag dot uses `text-flag` only when status is FLAGGED; never decoration

### 4.6 Drafts / approvals queue — `/app/workspace/[id]/approvals`

**Story arc:** the core trust loop. The fleet drafts; the user decides; existing systems send.

**Verified ground truth:** `app/(product)/app/workspace/[id]/approvals/page.tsx` exists but renders a JSON payload to the user (`approvals/page.tsx:56-58`). That JSON dump must die — it leaks internal data structure and reads as "configure your agents." Rewrite the row body to render the actual drafted content.

```
┌──────────────────────────────────────────────────────────────┐
│ work approvals                                  ← eyebrow    │
│                                                              │
│ Decisions waiting for you.                      ← display    │
│                                                              │
│ Routine items send through automatically. Anything           │
│ above your threshold lands here for explicit       ← body-lg │
│ ratification.                                                │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ DRAFT REPLY · buyer-inquiry-router · 12 min ago      │    │
│ │ To: sarah.chen@…   Re: Showing at 142 Peachtree      │    │
│ │ ─────────────────────────────────────────────────    │    │
│ │ Hi Sarah — Tuesday 10:30 works on our side. I'll     │    │
│ │ confirm the listing agent and circle back by EOD     │    │
│ │ with the disclosure packet. Let me know if you'd     │    │
│ │ like me to add your partner to the invite.           │    │
│ │ ─────────────────────────────────────────────────    │    │
│ │ Threshold: low · Confidence: 0.92                    │    │
│ │ [approve]  [edit]  [reject]                          │    │
│ ├──────────────────────────────────────────────────────┤    │
│ │ DRAFT POST · social-coordinator · 47 min ago         │    │
│ │ ...                                                  │    │
│ └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Row rules:**
- Header strip: kind + agent-slug + relative-time (mono micro, uppercase, `text-mute`)
- Recipient + subject (only if applicable): mono caption, `text-ink-soft`
- Body: drafted content rendered as plain prose, `text-ink`, 1.4-line height
- Footer strip: threshold + confidence (mono micro, never the headline)
- Actions: three buttons inline, `[approve]` primary clay, `[edit]` secondary outline, `[reject]` text-link with `text-flag`

**Banned moves:**
- Rendering raw JSON payload to the user (current bug — see `approvals/page.tsx:56-58`)
- A "select all" checkbox + bulk approve — every draft is one decision
- A confidence-score progress bar — the number is enough
- An "AI explanation" disclosure — if the row doesn't read as self-explanatory, the agent isn't ready to send it

### 4.7 Billing / tier picker — `/app/workspace/[id]/settings/billing`

**Story arc:** Q7 (ROI) and the trust contract.

```
┌──────────────────────────────────────────────────────────────┐
│ billing                                         ← eyebrow    │
│                                                              │
│ Your plan and invoices.                         ← display    │
│                                                              │
│ ┌─ current plan card ───────────────────────────────┐        │
│ │ REGULAR · STANDARD SERVICE PARTNERSHIP             │        │
│ │                                                    │        │
│ │ $149 / seat / month                  ← numeric-lg  │        │
│ │ 10 seats · billed monthly                          │        │
│ │ Next invoice: June 18                              │        │
│ │                                                    │        │
│ │ [change plan]  [open billing portal →]             │        │
│ └────────────────────────────────────────────────────┘        │
│                                                              │
│ ┌─ tier picker ─────────────────────────────────────┐        │
│ │  REGULAR    ·  PARTNER    ·  MAX                   │        │
│ │ (three columns, current tier highlighted by clay   │        │
│ │  underline; selecting another tier opens a         │        │
│ │  ApHeritageConfirm before changing)                │        │
│ └────────────────────────────────────────────────────┘        │
│                                                              │
│ invoices                                        ← eyebrow    │
│ {ApHeritageTable — date · amount · status · download}        │
│                                                              │
│ ─── rule ───                                                 │
│ Cancel anytime. Your service partner stays on through        │
│ the end of the current period.               ← caption mute  │
└──────────────────────────────────────────────────────────────┘
```

**Banned moves:**
- "Save 20%!" / "Most popular!" tier badges — the tier choice is about service cadence, not promotion
- Annual-billing toggle as a marketing nudge — month-to-month is the brand promise; "annual" is a side conversation, not a checkout default
- Auto-suggesting an upgrade in the picker ("Recommended for you" decoration)

### 4.8 Settings — `/app/workspace/[id]/settings`

**Story arc:** Q3 functional, plus a quiet trust signal: nothing in here is "configure your agents" — every setting is *telling the service partner how you like things.*

**Verified ground truth:** `app/(product)/app/workspace/[id]/settings/page.tsx` exists and follows the heritage-table pattern. Codify with these refinements:

```
┌──────────────────────────────────────────────────────────────┐
│ settings                                        ← eyebrow    │
│                                                              │
│ Workspace settings                              ← display    │
│                                                              │
│ {ApHeritageTable — sm:grid-cols-2}                           │
│ Workspace name  · Acme Realty                                │
│ Slug            · acme-realty                                │
│ Tier            · Regular                                    │
│ State           · GA                                         │
│ Billing mode    · Monthly                                    │
│ Active members  · 10                                         │
│ Created         · Apr 14, 2026 11:24 AM                      │
│                                                              │
│ ┌─ navigation grid ─────────────────────────────────┐        │
│ │ WORK THRESHOLDS                  BILLING          │        │
│ │ Configure which agent decisions  Invoices,        │        │
│ │ need explicit ratification.      payment method,  │        │
│ │                                  billing mode.    │        │
│ ├──────────────────────────────────┼────────────────┤        │
│ │ TEAM MEMBERS                     INTEGRATIONS     │        │
│ │ Manage seats and roles.          Connect / dis-   │        │
│ │ (Phase 2)                        connect tools.   │        │
│ ├──────────────────────────────────┼────────────────┤        │
│ │ DRAFTING TONE                    NOTIFICATIONS    │        │
│ │ How your fleet sounds.           When we ping you │        │
│ │ (Phase 2)                        and how.         │        │
│ └────────────────────────────────────────────────────┘        │
│                                                              │
│ Reach out to your service partner to change anything         │
│ you don't see here.                          ← caption mute  │
└──────────────────────────────────────────────────────────────┘
```

**Adjustment to ship:** the current Phase 1 footnote at `settings/page.tsx:75-79` says "Reach out to the agentplain operator." Reframe to "Reach out to your service partner." Banned word "operator" on the customer surface — operator is internal.

---

## 5. Anti-patterns — DO NOT SHIP

Every item below has shown up in a generic-SaaS competitor and has no place in agentplain product UI.

### 5.1 Visual anti-patterns

- **Neon / electric accents** — purples, electric blues, lime greens, magentas. Our accent is clay; the rest is paper + ink. The single moss usage is for verified-state badges only.
- **Hero gradients** — diagonal blue-to-purple page headers, gradient buttons, gradient cards. Solid clay on paper is the answer.
- **AI orb mascot** — pulsing brain, swirling cloud, animated avatar in the corner. The product doesn't have a face. The wordmark is the brand.
- **KPI walls** — dashboards with 12 stat cards in a 4×3 grid. The overview shows three numbers and a list; that's the rulebook.
- **Hyperactive notifications** — toast-bombs in the upper-right, red badge counters on every nav item, "3 new!" pills everywhere. We have a calm `[review]` indicator on items that need attention; no other badging.
- **"Try it now" CTAs in-product** — the user has already tried it; they're signed in. Every CTA inside the product surface is action-oriented (`[approve]`, `[connect]`, `[disconnect]`), not aspirational.
- **Sleek geometric icons** — gradient-filled, isometric-3D, "AI-themed" line-circle-triangle compositions. Lucide 1.5px stroke on `currentColor` is the only legal icon style.
- **Coastal-tech aesthetic** — frosted-glass nav, glow-on-hover, glassmorphism, dark-mode-only, "vercel" gradients. None of it. Our reference is heritage editorial — Monocle, FT Weekend, Frieze — not Linear / Stripe / Vercel.
- **Drop shadows of any kind** — `shadow-*` Tailwind classes are forbidden in product code. The hairline rule defines edge.
- **Rounded buttons / pills / chips** — `rounded-none` is the rule. The only legal radius is `rounded-full` for member avatars.
- **Skeleton screens with shimmering gradients** — use `ApRootedLoader` (the hairline strip + copy).
- **Confetti / animated celebration** on success — *the work is the celebration.*
- **Animated emoji** — emoji are banned on the product surface, period (`agentplain_brand_standards_v0.md` §9).

### 5.2 Copy anti-patterns

- **"Configure your agents"** — banned by `docs/customer-surface-audit-2026-05-15.md`. Replace with "Your service partner configures the fleet for your shop."
- **"Set up your fleet"** (customer-as-actor) — replace with "Your service team installs your fleet."
- **"DIY workflows" / "self-serve"** — banned. The product is a service partnership.
- **"Welcome aboard!"** — boarding metaphor = plane = banned per `plain not plane` rule.
- **"Let's get started!"** — exclamation, exhortation, marketing voice on a product surface.
- **"Powered by AI"** — banned by `agentplain_brand_standards_v0.md` §9.
- **"Your AI assistant"** — we're a fleet, not an assistant.
- **"V0," "V1," "phase 1," "phase 2"** — banned per `feedback_everything_tells_a_story.md`. The current `app/(product)/layout.tsx:23` stamp violates this — remove before next push.

### 5.3 Interaction anti-patterns

- **Multi-step modal wizards inside the working surface** — onboarding has its own surface; nothing else gets a wizard.
- **Auto-saving forms with no submit button** — every form has an explicit `[continue]` / `[save]` button; auto-save lives behind it.
- **Optimistic UI that lies** — never show "Approved" until the server confirms; show `ApRootedLoader` and the real outcome.
- **Right-click context menus on cards** — every action is in the card.
- **Drag-to-reorder** in v1 — order is data-driven (priority, recency, status), not user-arranged.
- **Animated micro-interactions on hover** — buttons darken (`hover:bg-clay-deep`); cards darken their border (`hover:border-ink`). Nothing else.
- **Persistent help chat bubble** — the service partner *is* the help. Email + a Slack-Connect link in `Settings` covers the channel.

---

## 6. Reference component names

Build tasks should ask for these by name. Each one corresponds to a pattern above; the implementations either exist today (cited) or are new components to extract from the next surface that needs them.

| Name | Purpose | Status | Source |
|---|---|---|---|
| `ApAppShell` | The full product chrome (header + workspace strip + main + footer) | New — extract from `app/(product)/layout.tsx` + `workspace/[id]/layout.tsx` |
| `ApWorkspaceStrip` | Header band with workspace name + nav + member chip | New — extract from `workspace/[id]/layout.tsx:38-72` |
| `ApPaperCard` | The workhorse `bg-paper p-6 border border-rule` container | Pattern, not yet a component — promote when used 3+ times |
| `ApHairlineList` | `border border-rule` outer + `divide-y divide-rule` rows | Pattern — promote |
| `ApHeritageTable` | Grid-with-rule-gap table, hairlines between rows, no zebra | Pattern at `settings/page.tsx:41` |
| `ApHeritageField` | Label-above + bordered input + caption + inline-error | Pattern at `sign-in/SignInForm.tsx:24-43` |
| `ApHeritageInput` | The input element itself with focus state | New — extract |
| `ApHeritageToggle` | The chip-row toggle (clay-selected, rule-muted unselected) | Pattern at `onboarding/page.tsx:407-424` |
| `ApHeritageConfirm` | Modal for destructive / commit actions | New |
| `ApPaperSheet` | Right-side slide-in for inspecting drafts / details | New |
| `ApRootedEmptyState` | Empty-state card with optional motif + report + cta | Pattern at `workspace/[id]/page.tsx:260-298` |
| `ApRootedLoader` | Hairline strip + verb-form copy | New |
| `ApHeritageButton` (primary / secondary) | Square-corner CTA, clay or outline | Pattern — `.btn-primary` / `.btn-secondary` at `app/globals.css:60-67` |
| `ApEyebrow` | Mono uppercase tracking-eyebrow label | Class — `.eyebrow` at `app/globals.css:50-52` |
| `ApHandoffRow` | Single row in the activity feed (agent → agent · type · time) | Pattern at `workspace/[id]/page.tsx:300-321` |
| `ApDraftCard` | Single row in the approvals queue with rendered prose body | New — replaces the current JSON-dump card at `approvals/page.tsx:42-79` |
| `ApIntegrationTile` | Marketplace tile (icon + status + body + action) | Shipped at `components/marketplace/IntegrationTile.tsx` — rename to `ApIntegrationTile` on next pass |
| `ApMotif` | Single line-illustrated plains motif (lone-tree, silo, wheat) | New — bundle as a small SVG set |
| `ApFlashBanner` | Connected / disconnected / error banner | Pattern at `integrations/page.tsx:135-178` |
| `Plaino` | Canonical Plaino brand mark — 10 illustrated states (standing-watch / sitting-alert / herding / fetching / scouting / guarding / resting / head-icon / 8bit / heritage), `size` in px. The production successor to `PlainoAvatar`. | Shipped at `components/ui/ap/Plaino.tsx` — see `docs/brand/plaino-system.md`. |
| `PlainoAvatar` | The line-art Plaino scaffold (sizes xs / sm / md / lg / xl). Superseded by `Plaino` for product surfaces; retained for the persona test and any currentColor-tinted contexts. | Shipped at `components/ui/ap/PlainoAvatar.tsx` — see §10. |
| `LogoLockup` | Horizontal lockup: Plaino head-icon + agentplain wordmark. Used in chrome where mark + name appear together. | Shipped at `components/brand/LogoLockup.tsx`. |

When a future build task references a name not on this list, the task is either (a) wrong about what they want, or (b) discovering a new primitive — add it to this doc in the same PR rather than smuggling it in.

---

## 7. Acceptance — how to know a screen is on-spec

Before any product-surface PR merges, the diff must answer YES to all of:

1. **Visual** — Zero inline hex strings; zero `shadow-*`; zero `rounded-(sm|md|lg|xl|2xl|3xl)` except on the avatar exception in §2.4; zero new fonts; zero `clay` doublings on a single screen.
2. **Voice** — Every CTA label is verb-led, lowercase phrase. Zero exclamation points. Zero "configure your" / "set up your" with customer as actor. Zero banned words from §1.8.
3. **Story** — Every section / widget on the screen answers a named question from the 9-question arc (`project_agentplain_mission_and_positioning.md`) OR serves a named functional purpose (`feedback_everything_tells_a_story.md`). PR description names which question each section answers.
4. **Service-partnership presence** — At least one mention of "your service partner" / "your service team" / "we" (as actor) in body copy on every working screen. Banned: copy that frames the user as the AI operator.
5. **No outbound surfacing** — Every action that touches an external system uses *draft → approve → existing-system-sends* framing. Buttons that imply we send (e.g. "send reply") are reserved for the user's existing-system handoff (`project_no_outbound_architecture.md`).
6. **Empty + loading + error** — Each are explicitly designed (not left as a default). Empty state has motif (optional) + reality sentence + change-sentence + one CTA. Loading uses `ApRootedLoader` copy. Errors follow the §1.4 structure.
7. **Heritage palette** — paper + ink dominant. Clay charge once. Moss only on a verified state badge. Flag only on a real error / compliance flag. Mute for captions.
8. **Hairline edges** — Cards and modals use `border border-rule`, not shadow. Tables use rule rows, not zebra.

If any of these is "no," the PR isn't ready. The rulebook is the gate.

---

## 10. The Plaino character

The service-partnership voice is anchored to a single named character: **Plaino**. The name is a kitschy contraction of "agent + the plains" — the brand semantic locked in `memory/feedback_brand_is_plain_not_plane.md`. Plaino is the warmth on top of the heritage wordmark — the Geico-gecko model — not a replacement for it.

### 10.1 Identity

- **Name:** Plaino. Hardcoded, one-per-product. Never randomized, never per-workspace. The earlier name-pool implementation (Sarah / James / Emma / Daniel / Maya / Owen) is removed.
- **Role:** "your service partner at agentplain." Plaino is part of "we" — not a third-party tool the brokerage adopted, not an AI assistant the operator drives.
- **Pronoun:** they.
- **Source of truth:** `lib/onboarding/service-partner.ts` exports `PLAINO_PARTNER = { name: "Plaino", pronoun: "they", role: "your service partner" }`. Every surface reads from there.

### 10.2 Avatar usage

The avatar is `<PlainoAvatar />` (re-exported from `@/components/ui/ap`). Until logo v3 lands, the mark is a placeholder line-art robot drawn in the same hairline-stroke language as `ApMotif` (1.5px stroke, currentColor, square corners).

| Size | px | When to use |
|---|---|---|
| `xs` | 16 | Footer markers ("drafted by Plaino"), tiny inline mentions, dense table rows. |
| `sm` | 24 | Activity-feed rows, list items where Plaino took action. |
| `md` | 32 | Workspace eyebrow band paired with the "your service partner" sentence. |
| `lg` | 48 | Onboarding hero card, settings landing. |
| `xl` | 96 | First-load / sign-up surface only — never inside working surfaces. |

Accessibility:

- When the avatar appears alongside the name "Plaino" in body text, pass `decorative` (default true) — the screen reader reads the name only and skips the avatar.
- When the avatar appears alone (footer marker with no name beside it), pass `decorative={false}` to expose `aria-label="Plaino"`.

### 10.3 Voice — Plaino has a name, not a personality disorder

Plaino's voice is the rooted/heritage voice already specified in §1. The name is attached to the same restraint, not a new personality. Same audit, same word ceiling, same forbidden vocabulary.

What Plaino sounds like:

> "I noticed three new inquiries this morning. Drafts are in your queue."
>
> "Two showings need a slot before Friday. Proposed times are on your calendar."
>
> "Compliance flagged one draft before it left the brokerage. It's waiting on you."

What Plaino does NOT sound like:

- "Hey friend! 👋" — chirpy mascot energy. Banned.
- "Hi! I'm an AI assistant…" — Plaino is not a tool the operator drives. Banned.
- "I'm SO excited to help you today!!" — first-person enthusiasm. Banned.
- "Let me know if you have any questions!" — closer-energy filler. Banned.
- "🌱 Rooting in! 🌾" — emoji-led copy on customer surfaces. Banned.

Plaino is calm, not chipper. Plaino reports what the fleet did and what the operator needs to decide. Plaino's restraint is what makes the warmth credible.

### 10.4 Email signatures

Transactional emails (auth magic-links, billing trial warnings, future operator notices) sign off with:

```
Plaino, your service partner at agentplain
```

— not "— agentplain" alone and not a tool-vendor sign-off ("The agentplain team," "From the agentplain crew"). The signed name is the same name that meets the customer in onboarding.

### 10.5 Banned framings

- ❌ Randomized partner names. The fleet does not assign Sarah to one workspace and James to another. There is one Plaino.
- ❌ "AI assistant" / "chatbot" / "bot" as Plaino's role. Plaino is your service partner.
- ❌ Mascot voice (exclamation points, emoji-led copy, first-person enthusiasm). Plaino is calm.
- ❌ Treating Plaino as a third-party. Plaino is "we," not "Plaino did X for agentplain."
- ❌ Replacing the heritage wordmark with the Plaino avatar in marketing-surface contexts. The wordmark stays the serious mark; the avatar is the warmth layered on top.

---

## Changelog

- 2026-05-17 — v1. Initial spec drafted on `chore/product-design-language-2026-05-17`. Anchored to `agentplain_brand_standards_v0.md`, `project_agentplain_mission_and_positioning.md`, `feedback_everything_tells_a_story.md`, `docs/customer-surface-audit-2026-05-15.md`, `docs/copy-reframe-guidance-for-inflight-tasks.md`, and verified token surface in `lib/brand/tokens.ts` / `app/globals.css` / `tailwind.config.ts`. Memory-file gaps for `project_service_partnership_positioning.md` and `feedback_brand_is_plain_not_plane.md` flagged in front-matter — file before PR-D.
- 2026-05-19 — §10 added. The Plaino character — name, role, avatar component (`PlainoAvatar`), voice, banned framings. Replaces the prior randomized name-pool implementation. Drafted on `feat/plaino-named-agent-2026-05-19`.
