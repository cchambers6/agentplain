# Nav + Footer

Marketing: `components/Header.tsx` / `components/Footer.tsx` · Product: `ApAppShell` + `ApWorkspaceStrip` (`components/ui/ap/ApAppShell.tsx`)

Two variants each, already split by surface — marketing chrome carries the wordmark lockup and page nav; the product shell carries the workspace strip and the five-tab IA (Today / Plaino / Connections / Reports / Account).

## Footer (marketing) — 2026-07-08 changes

- Carries `.letterpress-dark` so keyboard focus rings render wheat on the forest-deep ground (they were clay at ~2.5:1 before).
- Company column now links **Money-back guarantee → `/guarantee`** — the risk-reversal page had zero inbound links anywhere on the estate (audit 2026-07-02 finding 5). It is now one click from every page, plus the FAQ answer, the pricing hero, and every ApClosingBand body.
- The bottom strip stays facts-only (`10 verticals · 3 service-partnership tiers · 7-day free trial`) — no build metadata, ever.

## Rules

- The wordmark is `Logo` / `LogoLockup` — untouchable assets; only placement may be tuned.
- Footer link hover is `hover:text-wheat` — the sanctioned wheat use on dark grounds.
- Header nav labels match their destinations one-to-one (the old footer `/#how` vs header `/how-it-works` split is resolved to the page).
