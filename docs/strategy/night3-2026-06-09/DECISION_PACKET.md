# Night3 — CONNER decision packet (2026-06-09)

Every item below is **the layer between "built" and "revolutionary."** Per `audit_resolution_results_2026_06_07.md`, the adapters are built and behind flags with fixtures; what remains is **credentials to enter and two policy decisions** — not code. Each is phrased as one decision with a recommended answer so it's tappable from mobile.

## A. Self-serve credentials — do these first (no partner lead time)

| # | Decision | Recommended | Exact action | Turns |
|---|---|---|---|---|
| A1 | Enter **Buildium** API key? | **Yes — today** | Buildium → API client-id/secret (self-serve), set `BUILDIUM_ADAPTER_LIVE=on` | `property-management-rent-collection-chase` 3→live |
| A2 | Enter **Qualia** API key? | **Yes — today** | Qualia API key (self-serve), set `QUALIA_ADAPTER_LIVE=on` | `title-escrow-closing-doc-chase` 3→live |
| A3 | Set **BrightData or Tavily** key for research grounding? | **Yes — Tavily (cheaper to start)** | Set key behind `IResearchSubstratePort` | `research-on-demand-general` fixtures→live citations |

## B. OAuth consent — verify the apps (you own the Google/M365 tenant)

| # | Decision | Recommended | Exact action | Turns |
|---|---|---|---|---|
| B1 | Verify **Google OAuth consent** for live inbox fetch? | **Yes** | Google OAuth consent verified → `LIVE_INBOX_FETCH=true` | `inbox-triage-general`, `chief-of-staff-scheduler`, `lead-triage-realestate` all read real email instead of empty defaults |
| B2 | Same for **M365** tenants? | **Yes, if any pilot is on Microsoft** | M365 admin consent | same three skills, M365 brokers |

## C. Partner-gated — start the applications NOW (they have lead time)

| # | Decision | Recommended | Exact action | Turns |
|---|---|---|---|---|
| C1 | Start **EZLynx** partner application? | **Yes — start the clock** | Apply for EZLynx partner OAuth credentials | `insurance-coi-request` 3→live (after approval) |
| C2 | Start **Encompass/ICE** partner application? | **Yes — start the clock** | Apply for Encompass partner OAuth | `mortgage-document-chase` 3→live (after approval) |

> These don't land tonight regardless — the value is **starting the partner clock** so they're ready when the insurance/mortgage verticals activate.

## D. Counsel sign-off

| # | Decision | Recommended | Exact action | Turns |
|---|---|---|---|---|
| D1 | Send compliance corpora to counsel per-vertical? | **Yes — real-estate already live; queue mortgage + insurance** | Counsel review → `COMPLIANCE_CORPUS_COUNSEL_REVIEWED=<vertical>` | compliance rewrite-and-stage (the fleet's only **4**) fires beyond real-estate |

## E. The two policy decisions (no credential — pure Conner call)

| # | Decision | Recommended | Why |
|---|---|---|---|
| E1 | **Bounded auto-execute** — set the $-threshold + permitted action classes? | **Yes — start conservative: $0 auto-spend, allow only reversible admin actions (draft-save, calendar-hold, label/tag), everything else stays draft-and-approve** | Seam is built & fail-closed with immutable same-txn audit (#189), default all-OFF. This is the autonomy leap competitors can't match — `office-admin` 3→4. Conservative start is safe because every action is reversible + logged. |
| E2 | **Org-chart 20 charters** — activate / defer / prune? | **Prune the Media (13) + Insights (7) charters now; keep the 1 ACTIVATE recommendation from #184** | Pruning departments we haven't staffed **lifts the fleet median off 1 without writing code** — it stops scoring unstaffed org boxes as product failures. |

## The one-liner
The fleet's revolutionary value is **one credential-and-decision layer away**, not one engineering layer. A real broker's data through the now-wired adapters is the entire distance from 3 to 5. A1/A2/A3 + B1 are doable **today** and each converts a built-and-tested adapter into live customer value.
