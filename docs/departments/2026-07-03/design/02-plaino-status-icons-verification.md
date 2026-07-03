# Plaino status icons — deployment verification (2026-07-03)

**Question from the brief:** per `project_plaino_icon_system_two_families`, are the sit/fetch/herd/alert/sleep status icons correctly deployed (status family on product surfaces, never the identity mark)? And is the circle-coin-in-header issue fixed or still there?

**Method:** grep + file read against `origin/main @ d95d279`, isolated worktree. No visual assets touched (docs-only PR; the two-family split and all marks are under Conner's standing ban regardless).

---

## Verdict: correctly deployed. The circle coin is fixed.

### 1. The header circle coin — FIXED

`components/brand/LogoLockup.tsx:39` renders `<PlainoMark size={size} />` — the 8-bit brand mark, not the old `head-icon.png` coin. The file's own header comment documents the two-family rule. This is the PR #232 fix holding on main; the coin Conner flagged is gone from the lockup.

`head-icon.png` references now exist **only inside `components/ui/ap/` internals** (`Plaino.tsx` as the primitive's default state, plus explanatory comments in `PlainoMark.tsx`/`PlainoAvatar.tsx`). Zero product or marketing surface references it directly. Brand-gate rule R5 (no bare `<Plaino` outside `components/ui/ap`) continues to enforce this at the gate.

### 2. Status family deployment — correct at every checked call site

`PlainoStatus` call sites on main (product surfaces, all status-appropriate):

| Surface | File | Family used |
|---|---|---|
| Workspace overview (dashboard first render) | `app/(product)/app/workspace/[id]/overview-view.tsx` | PlainoStatus ✓ |
| Activity feed rows | `.../activity/ActivityFeed.tsx` | PlainoStatus ✓ |
| Approvals (card, row, list) | `.../approvals/ApprovalCard.tsx`, `ApprovalRowItem.tsx`, `ApprovalsList.tsx` | PlainoStatus ✓ |
| Disciplines page | `.../disciplines/page.tsx` | PlainoStatus ✓ |
| Onboarding + welcome experience | `.../onboarding/page.tsx`, `.../welcome/WelcomeExperience.tsx` | PlainoStatus ✓ |
| Demo-mode panel, saved-time counter, resting banner | `components/workspace/DemoModePanel.tsx`, `SavedTimeCounter.tsx`, `components/plaino/PlainoRestingBanner.tsx` | PlainoStatus ✓ |
| Pose-led loader | `components/ui/ap/ApPlainoLoader.tsx` | PlainoStatus ✓ |
| Operator fleet media header | `app/(operator)/operator/fleet/media/page.tsx` | PlainoStatus ✓ (internal surface) |

The state contract (`sit`/`fetch`/`herd`/`alert`/`sleep` + `watch`/`scout`) is unchanged in `components/ui/ap/PlainoStatus.tsx` and matches the ratified mapping in `docs/brand/icon-families.md`. No brand surface renders a pose; no status surface renders the 8-bit mark, per the grep sweep.

### 3. Residual findings (small, non-blocking)

1. **Two deprecated `PlainoAvatar` call sites remain:** `components/onboarding/WelcomeTour.tsx:239` (customer-facing) and `app/(operator)/operator/fleet/creative/page.tsx` (internal). The shim is *functionally correct* — verified in `PlainoAvatar.tsx` that it now delegates to `PlainoStatus` with a real 1:1 pose→state mapping (`sit→sit`, `fetch→fetch`, `herd→herd`), so the WelcomeTour renders proper status poses (herd during the tour, sit at the last step). This is API debt, not a visual defect. **Recommendation (P3):** migrate both call sites to `PlainoStatus` directly and delete the shim, per the shim's own "do NOT add new call sites" contract. Not urgent; not in the 14-day critical path.
2. **`WelcomeTour.tsx:231` carries `aria-modal="false"`** (invalid ARIA, audit 03 P2a) — noted here because it sits next to the icon usage; belongs to the shell-polish batch, not to the icon system.

### 4. What this means for the broker path

The dashboard a trial broker first sees uses the status family correctly: the dog is shown *doing work* (fetch on approvals, sit/sleep/fetch on the overview per live props), and the header says *this is agentplain* with the brand mark. The character-not-placeholder distinction that motivated the split is intact on exactly the surfaces the Monday-send trials will hit. No icon work is needed in this window.
