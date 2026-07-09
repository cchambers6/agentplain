# ApMotif — plains line motifs

`components/ui/ap/ApMotif.tsx`

Single-line plains illustrations: 1.5px stroke, `currentColor`, never filled, never two-tone, never gradient (design language §2.6). For empty states, auth pages, welcome strips, and dividers — NOT inside working surfaces.

## The twelve motifs (8 original + 4 added 2026-07-08)

| Name | Reads as | Natural home |
|---|---|---|
| `lone-tree` | quiet presence | generic empty states |
| `silo` | stored value | data/knowledge |
| `wheat` | the work itself | drafts |
| `sheaf` | harvest gathered | approvals queue |
| `horizon` | open ground | 404 / not-found |
| `seed` | rooting in | first-load, onboarding |
| `plow` | field ready | post-handoff, compliance-clean |
| `big-sky` | two weeks of mornings | briefings |
| `windmill` † | steady background work | overnight/fleet-working moments, reports |
| `homestead` † | the firm, home base | welcome, account/settings |
| `creek` † | steady flow | activity feed, report dividers |
| `gate` † | access granted | connections, first-connect |

† new 2026-07-08 — same 96×96 viewBox, same stroke discipline.

## Why these are code, not commissioned art

The creative-assets rule (tools or humans, never improvised) applies to PICTORIAL assets — Plaino, scenes, photography. The line-motif family was born as hand-authored TSX paths (PR #310) and extends the same way; it is the one sanctioned in-code illustration idiom. Anything beyond 1.5px line work routes through `tools/brand/gen-*.mjs` or creative-router.

```tsx
<ApMotif name="gate" size={72} className="text-mute" />
```
