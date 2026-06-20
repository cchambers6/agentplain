import type { ReactNode } from "react";

// Editorial pull-quote — a clay-wash band with a clay left-rule, set in display
// serif. The design-mirror (docs/brand/design-mirror-2026-06-19.md §1/§5, Linear +
// Mailchimp) found human brands spend their one color charge on a real focal
// device rather than tinting every block. This is that device: a single quote or
// thesis line pulled out of a long passage, given air and the clay charge.
//
// Use ONCE per long editorial surface — it IS the clay charge for that view, so
// don't pair it with a clay CTA in the same fold (design-language §2.1 single-
// charge rule). The optional `cite` is rendered as a mono dateline beneath.

interface ApPullQuoteProps {
  /** The pulled line. Keep it to one or two sentences — it's a focal point. */
  children: ReactNode;
  /** Optional attribution / source, rendered as a mono uppercase dateline. */
  cite?: ReactNode;
  className?: string;
}

/**
 * @example
 * <ApPullQuote cite="Mission, locked 2026-05-11">
 *   We lift up local businesses by doing the work that takes their time and
 *   money away from the people they serve.
 * </ApPullQuote>
 */
export function ApPullQuote({ children, cite, className }: ApPullQuoteProps) {
  const classes = ["pull-quote", className].filter(Boolean).join(" ");
  return (
    <figure className="m-0">
      <blockquote className={classes}>{children}</blockquote>
      {cite ? (
        <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          {cite}
        </figcaption>
      ) : null}
    </figure>
  );
}

export default ApPullQuote;
