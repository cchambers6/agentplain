# ApHeritageButton

`components/ui/ap/ApHeritageButton.tsx` · also: `.btn-primary` / `.btn-secondary` / `.btn-confident` CSS classes for server-light marketing pages.

The one CTA treatment. Square corners, no gradient, no hover transform. Renders `<button>` or, with `href`, a Next `<Link>`.

## Props

| Prop | Values | Notes |
|---|---|---|
| `variant` | `primary` \| `secondary` \| `ghost` | primary = clay fill with **white** text (4.76:1 — `text-paper` failed AA and is retired); secondary = ink outline; ghost = text link |
| `size` | `sm` \| `default` \| `lg` | default/lg clear the 44px touch target. `sm` (36px) is dense-desktop rows ONLY. `lg` is the confident hero CTA — one per fold |
| `withArrow` | boolean | Trailing `→` |
| `icon` | ReactNode | Leading glyph slot (16px ApMotif or mono char), aria-hidden |
| `loading` | boolean | Disables, sets `aria-busy`, dims label, trailing mono `…`. No spinner — ever |

## Rules

- Label text is a verb-led lowercase phrase: `approve draft`, `connect gmail`. No Title Case.
- One primary per view. Everything else secondary/ghost.
- On dark grounds use `ApClosingBandAction`, not this component.

```tsx
<ApHeritageButton variant="primary" withArrow href="/app/sign-up">open workspace</ApHeritageButton>
<ApHeritageButton variant="secondary" type="submit" loading={pending}>approve draft</ApHeritageButton>
<ApHeritageButton variant="secondary" size="sm" href="…">reconnect</ApHeritageButton>
```
