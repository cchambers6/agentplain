# Visual gap audit — TL;DR (2026-06-07)

Full report + every ChatGPT prompt: this PR's description, and
`~/.claude/projects/C--agentplain/memory/visual_gap_audit_2026_06_07.md`.

## The one finding
The live site ships **zero raster images.** `public/` = 14 SVGs (a serif-"a"
favicon, two wordmarks, an OG mirror, ten abandoned logo concepts). No hero
illustration, no scene art, **no Plaino anywhere a customer can see.** The
ratified robot-dog mark and the Plaino 10-pose system have not landed on a
single customer surface — the favicon is still the placeholder "a" and the
in-app `PlainoAvatar` is, per its own comment, "purely a visual scaffold."

That's on-brand-*minimal* (palette/serif/sparseness are correct) but the entire
illustration layer is absent.

## Counts
- Pages audited: 30 routes + auth-gated product/operator surfaces
- Visual slots: **52** → HAVE **2** · WEAK **21** · MISSING **4** · PLACEHOLDER **25**

## Top 5 (P0) to generate first
1. **Header brand mark** (head-icon beside wordmark) — MISSING — on every page; brand is currently a word, not a face.
2. **Favicon / app-icon family** (8-bit Plaino) — WEAK — every tab/bookmark/mobile icon is still a serif "a".
3. **Homepage heritage hero** — PLACEHOLDER — #1 surface opens on a text wall.
4. **Root OG share image** — WEAK — text-only **and** carries stale realty-only copy ("the independent brokerage") that contradicts the locked "local businesses" positioning. Fix copy + add heritage Plaino.
5. **In-app default avatar** (illustrated head-icon) — WEAK — the scaffold dog renders across the whole product; crop from the existing 10-pose sheet.

## How to use
Each gap has a **self-contained ChatGPT prompt** (brand hexes, Plaino pose,
dimensions, format, hard yes/no list inlined) in a copy-paste fenced block — in
the full report. Brand lock in every prompt: Paper `#F7F4ED`, Ink `#1A1A1F`,
Clay `#B65D3A`, Moss `#3F5C3F`; no blue, no pure black/white, no gradients, no
AI-sparkle, no glassmorphism, no isometric.

## Note
This audit is the **front-end visual** complement to the fleet pride audit
(backend/agent quality). Several P0s (favicon, head-icon, in-app avatar) consume
the **already-generated 10-pose sheet** — they need wiring/cropping
(`tools/brand/crop-plaino-sheet.mjs` + `gen-8bit.mjs`), not new generation. The
heritage heroes, OG cards, vertical imagery, and empty-state scenes are net-new
ChatGPT generations.
</content>
