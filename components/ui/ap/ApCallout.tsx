import type { HTMLAttributes, ReactNode } from "react";

// Semantic callout — a hairline-plated aside that tells the customer what
// kind of moment this is (a note, a verified pass, something that needs their
// eye, a hard stop, or work in flight) without importing an icon library.
// The "icon" is a mono eyebrow label — the same document grammar the rest of
// the estate speaks (design language §3; design-mirror §4 "show the real
// thing as a figure"). Square corners, no shadow: the lift is the tonal
// paper-bright body + a 2px toned left rule (the field-note idiom, promoted
// to a component).
//
// Tone → token mapping (WCAG-checked; body text stays ink/ink-soft — the tone
// colors the RULE and the LABEL only, never small body copy):
//   note      — ink rule, mute label. Neutral context.
//   verified  — moss rule + label (the verified/passed green — its only
//               sanctioned use, per tokens.ts).
//   attention — wheat rule, ink label. Needs the customer's eye; wheat is
//               decorative-only so the label text does NOT take it.
//   stop      — flag rule + label. Errors / compliance blocks.
//   working   — clay rule + label. Work in flight, drafts pending.
//
// Customer vocabulary in the default labels per
// feedback_customer_vocab_not_engineer — no engineer state names.

export type ApCalloutTone =
  | "note"
  | "verified"
  | "attention"
  | "stop"
  | "working";

const TONE: Record<
  ApCalloutTone,
  { rule: string; label: string; defaultLabel: string }
> = {
  note: { rule: "border-l-ink/40", label: "text-mute", defaultLabel: "note" },
  verified: {
    rule: "border-l-moss",
    label: "text-moss",
    defaultLabel: "verified",
  },
  attention: {
    rule: "border-l-wheat",
    label: "text-ink",
    defaultLabel: "needs your eye",
  },
  stop: { rule: "border-l-flag", label: "text-flag", defaultLabel: "stopped" },
  working: {
    rule: "border-l-clay",
    label: "text-clay",
    defaultLabel: "working",
  },
};

interface ApCalloutProps extends HTMLAttributes<HTMLDivElement> {
  tone?: ApCalloutTone;
  /** Mono eyebrow label. Defaults to the tone's customer-vocabulary word. */
  label?: ReactNode;
  /** Optional single action (an ApHeritageButton or a ghost link). One max. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * @example
 * <ApCallout tone="working">
 *   Three drafts are being written from last night's inbox. They'll land in
 *   your queue before 7am.
 * </ApCallout>
 *
 * <ApCallout
 *   tone="attention"
 *   label="a connector needs you"
 *   action={<ApHeritageButton variant="secondary" size="sm" href="/integrations">reconnect gmail</ApHeritageButton>}
 * >
 *   Gmail stopped answering yesterday evening. Reconnecting takes one click.
 * </ApCallout>
 */
export function ApCallout({
  tone = "note",
  label,
  action,
  className,
  children,
  ...rest
}: ApCalloutProps) {
  const t = TONE[tone];
  const classes = [
    "border border-rule border-l-2 bg-paper-bright p-5",
    t.rule,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      <p
        className={`font-mono text-[11px] tracking-eyebrow uppercase ${t.label}`}
      >
        {label ?? t.defaultLabel}
      </p>
      <div className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink-soft">
        {children}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
