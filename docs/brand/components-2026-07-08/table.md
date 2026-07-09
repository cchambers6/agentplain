# ApHeritageTable / ApHeritageGrid

`components/ui/ap/ApHeritageTable.tsx`

Tabular data: hairline rules between rows, NEVER zebra striping. Column heads in the eyebrow voice. Numeric columns right-aligned via `<ApHeritageTh align="right">`. Wrapped in `overflow-x-auto` with `min-w-[640px]` so phones scroll the table instead of crushing it.

For key/value pairs (settings overview, "your setup" stats) use `ApHeritageGrid` + `ApHeritageGridCell` — the grid-of-rule pattern, not a table.

## Rules

- Row hover, sorting, and density steps are added per-surface when a surface actually needs them — the primitive stays minimal (billing history and audit logs are static lists today; don't build speculative client JS into a server component).
- Empty result → render `ApRootedEmptyState`, not an empty `<tbody>`.
- Marketing comparison tables use the ledger treatment instead: `border-mid-rule bg-paper-bright` frame (reference: `components/marketing/ComparisonView.tsx`).

```tsx
<ApHeritageTable aria-label="Invoices">
  <thead><tr><ApHeritageTh>date</ApHeritageTh><ApHeritageTh align="right">amount</ApHeritageTh></tr></thead>
  <tbody><tr className="border-t border-rule"><ApHeritageTd>May 14</ApHeritageTd><ApHeritageTd align="right">$1,490.00</ApHeritageTd></tr></tbody>
</ApHeritageTable>
```
