# agentplain

Marketing + product site for **agentplain.com** — a platform for AI agent
fleets that run operations work inside small-to-mid businesses. Two
surfaces (high-touch brokerage tier + self-serve individual tier),
multi-vertical, realty first.

> Intelligence. Rooted in reality.

## Stack

- Next.js 14.2 (App Router)
- TypeScript (strict)
- Tailwind CSS with brand v3 tokens (`paper`, `ink`, `slate`, `signal`, `amber`)
- Prisma + Postgres (product surface)
- Stripe (billing)
- Resend (transactional auth)
- Notion read-only (briefings)

Fonts via `next/font/google`: Cormorant Garamond (display), Inter (body),
JetBrains Mono (accents).

## Quickstart

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Build / verify

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

## File map (marketing)

```
app/
  layout.tsx                fonts + metadata
  globals.css               Tailwind + base type styles + utility classes
  (marketing)/
    layout.tsx              Header + Footer
    page.tsx                home — hero, ROI proof, comparison, capabilities, paths, verticals
    capabilities/page.tsx   concrete deliverables, 18 jobs across 6 groups
    pricing/page.tsx        seat tiers, comparison table, ROI calculator, pricing FAQ
    brokerages/page.tsx     team-math story for 5/10/25/50 realtor offices
    for-agents/page.tsx     solo $199 / mo path
    platform/page.tsx       five capability surfaces + onboarding flow
    verticals/page.tsx      Realty Pin 1 + named roadmap (mortgage, insurance, pm, title)
    trust/page.tsx          security + honest notes on what we have not certified
    about/page.tsx          thesis, operating model, what we are not
  (product)/                product surface (Phase 1 customer surface)
components/
  Logo.tsx                  inline SVG mark + serif wordmark
  Header.tsx                marketing nav
  Footer.tsx                marketing footer
  Section.tsx               reusable section shell with eyebrow/title/intro
  SeatTierTable.tsx         the 6-band per-seat pricing table
  StackComparison.tsx       "Replaces these tools" comparison
  RoiCalculator.tsx         live ROI calculator (client component)
  AgentCard.tsx             fleet card (legacy, currently unused)
  PricingTier.tsx           pricing card (legacy, currently unused)
  FAQ.tsx                   accordion via <details>
public/
  favicon.svg               brand mark
```

`/pilot` redirects to `/brokerages` (permanent) — see `next.config.mjs`.

## Brand tokens

Defined in `tailwind.config.ts`:

| token         | hex       | use                                         |
| ------------- | --------- | ------------------------------------------- |
| `paper`       | `#F4EEE3` | base background                             |
| `paper-deep`  | `#EDE5D6` | alternating section background              |
| `ink`         | `#2A2620` | text + dark CTA backgrounds                 |
| `slate-soft`  | `#5A5D62` | secondary text                              |
| `signal`      | `#5F8060` | accent (logo color variant, hover, ticks)   |
| `amber`       | `#C9892F` | reserved single-use accent                  |
| `rule`        | `#D9CFBC` | hairlines                                   |

## Design intent

- Anti-mascot, anti-hype. No robot illustrations, no purple gradients,
  no glassmorphism.
- Cormorant for display, Inter for body, JetBrains Mono for technical
  accents.
- Hairline rules instead of cards-on-cards. Structure shows the seams.
- Signal moss used sparingly — accent only, never large fills.
- Mobile-first.

## Copy invariants (do not paraphrase)

- Tagline: **Intelligence. Rooted in reality.**
- Operating bar: **Run a 25-agent brokerage with five.**
- Per-deal proof: **One extra deal a quarter (2.5% of $400K = $10,000)
  pays for the year.** Solo breakeven ~73 days; 10+ realtor brokerages
  break even before week 1.
- Stack-replaced range: **$510–$1,560 per realtor per month.**

## Pricing — single source of truth

Per-realtor seat pricing. Annual saves two months (10× monthly, not 12×).

| Seats        | Per seat / mo | Per seat / yr |
| ------------ | ------------- | ------------- |
| 1 (solo)     | $199          | $1,990        |
| 2 – 9        | $169          | $1,690        |
| 10 – 24      | $139          | $1,390        |
| 25 – 49      | $109          | $1,090        |
| 50 – 99      | $79           | $790          |
| 100+         | Enterprise — talk to us |   |

No platform fee. Custom agent builds and custom integration adapters
are scoped engagements priced per build, not gated tiers.

## Positioning rules

- Multi-vertical platform. Realty is **Pin 1**, available now. Mortgage,
  insurance, property management, title & escrow are roadmap. Do not
  promise launch dates without a real customer in pilot.
- Catalog agents + custom agents. Do not claim a small fixed catalog
  size — the catalog grows as agents earn slots.
- One pricing model: per realtor seat, scales by team size. Both buyer
  paths (solo + brokerage) land in the same seat-tier table.
- Custom agents and integrations are scoped engagements (add-ons),
  priced per build — not seat-tier features.
- We do not send outbound on customer's behalf. Agents draft into
  existing inboxes; your domain sends.
- Adapter-based integrations. Marketing should describe patterns, not
  promise specific vendor SDKs.

## Known limitations

- Customer testimonials, brokerage logo strip, and case studies are
  empty until first paying pilot completes — by design, not bug.
- Demo video is not on site yet. Gated on Phase 1 production deploy and
  recordable customer flows.
- See `outputs/agentplain_marketing_redo/imagery_brief.md` for the
  full visual asset queue.
