import type { HTMLAttributes } from "react";

// Mono uppercase tracking-eyebrow label. Wraps the `.eyebrow` utility so callers
// don't need to remember the class. Pair above an ApPaperCard title, list section
// header, or page H1 per design language §2.2.

interface ApEyebrowProps extends HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

/**
 * @example
 * <ApEyebrow>work approvals</ApEyebrow>
 * <h1 className="font-display text-3xl">Decisions waiting for you.</h1>
 */
export function ApEyebrow({ className, children, ...rest }: ApEyebrowProps) {
  const cls = ["eyebrow", className].filter(Boolean).join(" ");
  return (
    <p className={cls} {...rest}>
      {children}
    </p>
  );
}
