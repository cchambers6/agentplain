# ApCallout

`components/ui/ap/ApCallout.tsx` · NEW 2026-07-08

Semantic aside: paper-bright plate, hairline frame, 2px toned left rule, mono eyebrow label as the "icon" (no icon library — the label is the document grammar the estate already speaks). Optional single action.

## Tones

| Tone | Rule color | Default label | Use |
|---|---|---|---|
| `note` | ink/40 | `note` | Neutral context |
| `verified` | moss | `verified` | A pass, a completed check |
| `attention` | wheat | `needs your eye` | Customer action wanted (wheat colors the RULE only — label stays ink) |
| `stop` | flag | `stopped` | Errors, compliance blocks |
| `working` | clay | `working` | Work in flight, drafts pending |

## Rules

- Body text stays `ink-soft` in every tone — the tone never colors small copy.
- One action max, rendered under the body (`ApHeritageButton size="sm"` or a ghost link).
- Customer-vocab state labels (`feedback_customer_vocab_not_engineer`): the defaults are safe; overrides must stay in that register.
- Dashboard state moments (Setting up / Watching / Working / Needs a connector / Paused) are this component's home turf.

```tsx
<ApCallout tone="attention" label="a connector needs you"
  action={<ApHeritageButton variant="secondary" size="sm" href="…">reconnect gmail</ApHeritageButton>}>
  Gmail stopped answering yesterday evening. Reconnecting takes one click.
</ApCallout>
```
