# ApRootedEmptyState

`components/ui/ap/ApRootedEmptyState.tsx`

The empty state: one image cue (line motif or Plaino scene), one sentence reporting reality, one sentence saying what changes it, one CTA.

## Props

| Prop | Notes |
|---|---|
| `reality` | Required. What is currently true: "No drafts in the queue." |
| `change` | What changes it: "Your fleet is reading inbox traffic; the first batch usually lands by 9:14am ET." |
| `cta` | Single action, typically `ApHeritageButton variant="secondary"` |
| `motif` | `ApMotifName` line art (64–96px, off-center left) |
| `scene` | `PlainoSceneName` — the partner-grade upgrade; renders instead of `motif` |
| `eyebrow` | Section name above the card |

## Rules (design language §1.2 + §3.5)

- Banned: exclamation points, emoji, "All caught up!", "You're all set!", "Looks like…".
- Reality first, always — never open with the CTA.
- Root 404 (`app/not-found.tsx`) is the reference use.
- New motif options for 2026-07-08 empty states: `windmill` (background work), `homestead` (account/home), `creek` (activity/reports), `gate` (connections).
