# ApHeritageField

`components/ui/ap/ApHeritageField.tsx`

Labeled form field — mono eyebrow label above, hairline-bordered input, helper caption below, inline error with `role=alert`. Composes `<input>` or (`multiline`) `<textarea>`; refs forward. For a native `<select>`, apply the same `INPUT_BASE` classes and eyebrow-label pattern until a select wrapper earns its place (no current product surface needs one — don't build ahead of need).

## Props

| Prop | Notes |
|---|---|
| `label` | Required. Lowercase word/phrase: `email`, `workspace name` |
| `helper` | Caption under the field (`mute`, 13px) |
| `error` | Takes precedence over helper; renders `flag`, `role=alert`, sets `aria-invalid` + `aria-describedby` |
| `multiline` | `true` → textarea (`resize-y`) |
| …rest | All native input/textarea attributes pass through |

## Rules

- No floating labels. No placeholder-as-label. Helper under the field, never beside it.
- Focus: 2px clay ring (global), border sharpens to ink.
- Disabled: opacity-50 — never a gray fill.

```tsx
<ApHeritageField label="email" name="email" type="email" required helper="We send a magic link." />
<ApHeritageField multiline label="notes for your service partner" rows={4} error={state.error} />
```
