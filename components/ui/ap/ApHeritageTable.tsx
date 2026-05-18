import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

// Minimal table — hairline rules between rows, never zebra striping. Numerical
// columns right-aligned, text columns left-aligned. Column heads use the
// eyebrow class. Per design language §3.2.
//
// For simple key/value grids (settings overview), use the grid-of-rule pattern
// via <ApHeritageGrid>. For tabular data with column heads (billing history,
// audit logs), use <ApHeritageTable>.

interface ApHeritageTableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

interface ApHeritageGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Items rendered as label/value pairs. Each renders as one cell. */
  children: ReactNode;
  /** Tailwind grid-cols-* override. Defaults to single column / sm:grid-cols-2. */
  columnsClass?: string;
}

/**
 * @example
 * <ApHeritageTable aria-label="Invoices">
 *   <thead>
 *     <tr>
 *       <ApHeritageTh>date</ApHeritageTh>
 *       <ApHeritageTh align="right">amount</ApHeritageTh>
 *       <ApHeritageTh>status</ApHeritageTh>
 *     </tr>
 *   </thead>
 *   <tbody>
 *     <tr className="border-t border-rule">
 *       <ApHeritageTd>May 14, 2026</ApHeritageTd>
 *       <ApHeritageTd align="right">$1,490.00</ApHeritageTd>
 *       <ApHeritageTd>paid</ApHeritageTd>
 *     </tr>
 *   </tbody>
 * </ApHeritageTable>
 *
 * @example
 * <ApHeritageGrid columnsClass="grid-cols-1 sm:grid-cols-2">
 *   <ApHeritageGridCell label="workspace name" value="Acme Realty" />
 *   <ApHeritageGridCell label="slug" value="acme-realty" />
 * </ApHeritageGrid>
 */
export function ApHeritageTable({
  className,
  children,
  ...rest
}: ApHeritageTableProps) {
  const classes = [
    "w-full border border-rule bg-paper text-[14px]",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <table className={classes} {...rest}>
      {children}
    </table>
  );
}

type Align = "left" | "right";

interface ApHeritageThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  children: ReactNode;
}

export function ApHeritageTh({
  align = "left",
  className,
  children,
  ...rest
}: ApHeritageThProps) {
  const cls = [
    "px-5 py-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute",
    align === "right" ? "text-right" : "text-left",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <th scope="col" className={cls} {...rest}>
      {children}
    </th>
  );
}

interface ApHeritageTdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  children: ReactNode;
}

export function ApHeritageTd({
  align = "left",
  className,
  children,
  ...rest
}: ApHeritageTdProps) {
  const cls = [
    "px-5 py-4 text-ink",
    align === "right" ? "text-right font-mono" : "text-left",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <td className={cls} {...rest}>
      {children}
    </td>
  );
}

export function ApHeritageGrid({
  columnsClass = "grid-cols-1 sm:grid-cols-2",
  className,
  children,
  ...rest
}: ApHeritageGridProps) {
  const cls = [
    "grid gap-px border border-rule bg-rule",
    columnsClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

interface ApHeritageGridCellProps {
  label: ReactNode;
  value: ReactNode;
}

export function ApHeritageGridCell({ label, value }: ApHeritageGridCellProps) {
  return (
    <div className="bg-paper p-5">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </p>
      <p className="mt-1 text-[15px] text-ink">{value}</p>
    </div>
  );
}
