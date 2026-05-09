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
    page.tsx                home — hero, two surfaces, capabilities, verticals, FAQ
    platform/page.tsx       capabilities + how the engagement flows
    brokerages/page.tsx     high-touch tier ($1,500 / $2,750 / $4,500)
    for-agents/page.tsx     self-serve tier ($49 / mo, $500 / yr)
    pricing/page.tsx        both tiers, side by side
    verticals/page.tsx      Realty Pin 1 + roadmap
    trust/page.tsx          security + honest notes on what we have not certified
    about/page.tsx          thesis, operating model, what we are not
  (product)/                product surface (Phase 1 customer surface)
components/
  Logo.tsx                  inline SVG mark + serif wordmark
  Header.tsx                marketing nav
  Footer.tsx                marketing footer
  Section.tsx               reusable section shell with eyebrow/title/intro
  AgentCard.tsx             fleet card
  PricingTier.tsx           pricing card (with "featured" variant)
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
- Brokerage operating bar: **Run a 25-agent brokerage with five.**
- Brokerage pricing: **$1,500 / $2,750 / $4,500** (30-day pilot)
- Self-serve pricing: **$49 / mo** or **$500 / yr**

## Positioning rules

- Multi-vertical platform. Realty is **Pin 1**, not the whole product.
- Catalog agents + custom agents. Do not claim a small fixed catalog
  size — the catalog grows as agents earn slots.
- Two surfaces, both real: high-touch brokerage tier and self-serve
  individual tier. Self-serve is in active build (Phase 3).
- Custom agents and integrations (data, email, server) are part of the
  brokerage offer.
- We do not send outbound on customer's behalf. Agents draft into
  existing inboxes.
- Adapter-based integrations. Marketing should describe patterns, not
  promise specific vendor SDKs.

## Known limitations

- Customer testimonials, brokerage logo strip, and case studies are
  empty until first paying pilot completes — by design, not bug.
- Demo video is not on site yet. Gated on Phase 1 production deploy and
  recordable customer flows.
- See `outputs/agentplain_marketing_redo/imagery_brief.md` for the
  full visual asset queue.
