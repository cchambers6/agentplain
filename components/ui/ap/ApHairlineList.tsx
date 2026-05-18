import type { HTMLAttributes, ReactNode } from "react";

// List rows separated by hairline rules, not by cards. Use for queues, activity
// feeds, handoff logs, approval lists. Per design language §3.2.
// Outer wrapper: border + paper. Rows: divide-y. Per-row padding: px-5 py-4.

interface ApHairlineListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
}

interface ApHairlineRowProps extends HTMLAttributes<HTMLLIElement> {
  /** Optional monospace timestamp (or other right-rail content). Whitespace-nowrap. */
  right?: ReactNode;
  /** Left rail body — flex-1 by default; takes whatever space the right rail leaves. */
  children: ReactNode;
}

/**
 * @example
 * <ApHairlineList aria-label="Recent handoffs">
 *   <ApHairlineRow right="08:12">
 *     <span className="text-ink-soft">
 *       <span className="font-mono text-ink">chief-of-staff</span>
 *       <span className="mx-2 text-mute">→</span>
 *       <span className="font-mono text-ink">buyer-inquiry-router</span>
 *     </span>
 *   </ApHairlineRow>
 *   <ApHairlineRow right="07:48">…</ApHairlineRow>
 * </ApHairlineList>
 */
export function ApHairlineList({
  className,
  children,
  ...rest
}: ApHairlineListProps) {
  const classes = [
    "divide-y divide-rule border border-rule bg-paper",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <ul className={classes} {...rest}>
      {children}
    </ul>
  );
}

export function ApHairlineRow({
  right,
  className,
  children,
  ...rest
}: ApHairlineRowProps) {
  const classes = [
    "flex flex-wrap items-baseline justify-between gap-3 px-5 py-4 text-[14px]",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <li className={classes} {...rest}>
      <div className="flex-1">{children}</div>
      {right ? (
        <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          {right}
        </span>
      ) : null}
    </li>
  );
}
