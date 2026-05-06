# agentplain

Marketing site for **agentplain.com** — a pre-trained AI agent fleet for small-to-mid brokerages.

> Intelligence. Rooted in reality.

Built with Next.js 14 (App Router) + TypeScript + Tailwind. Brand v3 tokens, three pages (homepage, pilot, about), seven-agent fleet section, three-tier pilot pricing ($1,500 / $2,750 / $4,500), and a full FAQ.

## Quickstart

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Build

```bash
npm run build
npm run start
```

## Stack

- Next.js 14.2 (App Router)
- TypeScript (strict)
- Tailwind CSS with brand v3 tokens (`paper`, `ink`, `slate`, `signal`, `amber`)
- Fonts via `next/font/google`: Cormorant Garamond (display), Inter (body), JetBrains Mono (accents)
- Zero runtime dependencies beyond React + Next

## File map

```
app/
  layout.tsx          fonts + metadata + Header/Footer
  page.tsx            homepage (hero → pillars → fleet → pricing → FAQ → footer CTA)
  pilot/page.tsx      pilot detail + tiers + 30-day timeline
  about/page.tsx      brand story
  globals.css         Tailwind + base type styles + utility classes
components/
  Logo.tsx            inline SVG mark + serif wordmark (ink + color variants)
  Header.tsx
  Footer.tsx
  Section.tsx         reusable section shell with eyebrow/title/intro
  AgentCard.tsx       fleet card
  PricingTier.tsx     pricing card (with "featured" variant)
  FAQ.tsx             accordion via <details>
public/
  favicon.svg         brand mark
```

## Brand tokens

Defined in `tailwind.config.ts`:

| token         | hex       | use                                         |
| ------------- | --------- | ------------------------------------------- |
| `paper`       | `#F4EEE3` | base background                             |
| `paper-deep`  | `#EDE5D6` | alternating section background              |
| `ink`         | `#2A2620` | text + dark CTA backgrounds                 |
| `slate-soft`  | `#5A5D62` | secondary text                              |
| `signal`      | `#5F8060` | accent (logo color variant, hover, ticks)   |
| `amber`       | `#C9892F` | reserved single-use accent (not yet placed) |
| `rule`        | `#D9CFBC` | hairlines                                   |

## Deploy steps (Conner — morning)

The site is already pushed and deployed when this README ships. The only step left is DNS at Namecheap.

If you ever need to redo it from scratch:

1. **Git** — already initialized and committed.
   ```bash
   cd C:\agentplain
   git status
   ```
2. **GitHub** — repo at `github.com/cchambers6/agentplain`.
3. **Vercel project** — `prj_1XqKvh3hzT9AZHVXsgavH4lXf94b`. The build agent ran `vercel link` against this project ID.
4. **Production deploy** — `vercel deploy --prod` produces the `agentplain-*.vercel.app` URL.
5. **Domain alias** — make sure `agentplain.com` and `www.agentplain.com` resolve to **this** Vercel project, not the legacy `business` project. Detach from `business` first if needed:
   ```bash
   vercel domains rm agentplain.com   # only if previously attached to business
   vercel domains add agentplain.com  # against agentplain project
   ```
6. **Namecheap DNS** (the only step Claude cannot do for you) — at `namecheap.com` → Domain List → `agentplain.com` → Manage → Advanced DNS, set:
   - **A record** — host `@`, value `76.76.21.21`, TTL automatic
   - **CNAME** — host `www`, value `cname.vercel-dns.com.`, TTL automatic
   - Remove any conflicting records pointing at the old project.
   - Or, simpler: switch nameservers to Vercel's (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`).
7. Wait ~5–30 minutes for DNS propagation + Vercel SSL provisioning.
8. Visit `https://agentplain.com`.

## Design intent

- Anti-mascot, anti-hype. No robot illustrations, no purple gradients, no glassmorphism.
- Cormorant for display, Inter for body, JetBrains Mono for technical accents (eyebrows, agent indices, pricing numerals).
- Hairline rules (`#D9CFBC`) instead of cards-on-cards. The structure shows the seams.
- Signal moss (`#5F8060`) used sparingly — accent only, never large fills.
- Mobile-first.

## Copy invariants (do not paraphrase)

- Tagline: **Intelligence. Rooted in reality.**
- Footer CTA: **Run a 25-agent brokerage with five.**
- Pricing tiers: **$1,500 / $2,750 / $4,500**

## Known limitations

- The 7-agent fleet copy is V0 — describes intent honestly; do not extend it without evidence.
- No analytics installed. Add Plausible or Vercel Analytics before paid traffic hits the site.
- No contact form — all CTAs route to `mailto:hello@agentplain.com`. Wire up a real form before scaling outbound.
- No blog/CMS. Add when there is a second post worth writing.
