# ApBadge

`components/ui/ap/ApBadge.tsx` · NEW 2026-07-08

Mono micro-label chip — square-cornered, hairline-bordered, eyebrow voice. The heritage answer to the SaaS pill (no `rounded-full`, no tinted chip soup).

## Tones

| Tone | Look | Use |
|---|---|---|
| `neutral` | rule border, mute text | Categories, metadata |
| `verified` | moss | Passed / connected / counsel-cleared — status truth only |
| `attention` | flag | Needs the customer. The only red on a working surface |
| `accent` | clay-deep text | Emphasis (clay itself fails AA at 11px — the component uses the deep step) |
| `harvest` | clay-wash ground, ink text | The rare premium marker (featured tier, new capability). ≤1 per view — same budget as the wheat accent |

## Rules

- A badge states a FACT ("connected", "counsel-gated"), never hype ("popular!").
- Customer vocabulary: `setting up`, `watching`, `working`, `needs a connector`, `paused` — never engineer states.
- Don't stack more than two badges on one row item.

```tsx
<ApBadge tone="verified">connected</ApBadge>
<ApBadge tone="attention">needs a connector</ApBadge>
```
