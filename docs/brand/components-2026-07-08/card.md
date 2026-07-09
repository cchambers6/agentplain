# ApPaperCard

`components/ui/ap/ApPaperCard.tsx`

The workhorse container: paper ground, hairline border, square corners, NO shadow. Elevation is tonal — the `ledger` variant lifts on `paper-bright`.

## Props

| Prop | Values | Notes |
|---|---|---|
| `variant` | `default` \| `ledger` | `ledger` = the Stripe-style captioned figure frame: eyebrow rides a hairline-ruled header bar over a paper-bright plate, mid-rule border. Use it to show REAL things — a stat, a draft, the working math — as exhibits |
| `density` | `dense` \| `default` \| `spacious` | p-5 / p-6·8 / p-8·10 |
| `eyebrow` / `title` / `footer` | ReactNode | footer is hairline-separated; one CTA per card max |
| `interactive` | boolean | hover:border-ink affordance |

## Rules

- One CTA per card. One card = one block of content.
- The ledger variant is the page's premium moment — the converting numbers get it, not the thesis copy (home proof exhibit is the reference: `app/(marketing)/page.tsx` "Exhibit · the working math").
- Figures inside a ledger are mono; captions are 11px mono uppercase `mute`.

```tsx
<ApPaperCard variant="ledger" eyebrow="Exhibit · the working math">
  <p className="font-mono text-3xl text-ink">$4,300</p>
</ApPaperCard>
```
