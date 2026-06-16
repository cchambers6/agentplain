/**
 * components/plaino/PlainoRestingBanner.tsx
 *
 * The universal "Plaino's resting" state. Whenever an LLM-backed surface
 * would otherwise return silently or with a confusing half-answer — the
 * paused-spend sentinel, a missing credential, a forced `LLM_DEGRADED_MODE`
 * local test, an upstream outage — this banner reframes the dead click as a
 * deliberate, calm pause: the working dog is napping, not broken.
 *
 * One component, two shapes:
 *   - variant="strip"  — a slim top-of-app bar. Wired into the workspace
 *     layout so EVERY product page (overview, agents, approvals, activity,
 *     briefings, reports) carries the same honest state without each widget
 *     re-deriving it.
 *   - variant="notice" — a fuller in-context block. Used inside the /talk
 *     thread where the customer just tried to say something to Plaino.
 *
 * Brand:
 *   - The icon is `PlainoStatus state="sleep"` — the canonical resting pose
 *     from the live-state icon family (project_plaino_icon_system_two_families).
 *     Status surface → status icon; we never put the 8-bit brand mark here.
 *   - Voice is calm, lowercase-leaning, heritage-warm (project_plaino_named_agent).
 *   - The customer copy NEVER names a model vendor, an API key, or a provider
 *     (feedback_no_silent_vendor_lock). The operator detail may — it's gated
 *     behind `isOperator` and only rendered to staff.
 *
 * This is a pure presentational server component (no hooks, plain <img> via
 * PlainoStatus) so it renders in server components, the workspace layout, and
 * react-dom/server unit tests alike.
 */
import { PlainoStatus } from "@/components/ui/ap";
import { PLAINO_RESTING_CUSTOMER_NOTICE } from "@/lib/plaino";

export interface PlainoRestingBannerProps {
  /** Customer-facing line. Defaults to the shared "Plaino's resting" copy so
   *  a caller that only knows "we're degraded" still says the right thing. */
  customerNotice?: string;
  /** Operator-facing follow-on (the fix). Rendered ONLY when `isOperator`. */
  operatorNotice?: string;
  /** Whether the viewer is operator/staff — gates the operator detail. */
  isOperator?: boolean;
  /** "strip" = slim top-of-app bar; "notice" = fuller in-context block. */
  variant?: "strip" | "notice";
  className?: string;
}

export function PlainoRestingBanner({
  customerNotice = PLAINO_RESTING_CUSTOMER_NOTICE,
  operatorNotice,
  isOperator = false,
  variant = "notice",
  className,
}: PlainoRestingBannerProps) {
  const showOperator = isOperator && Boolean(operatorNotice);

  if (variant === "strip") {
    return (
      <div className={`container-wide mt-4 ${className ?? ""}`}>
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 border border-clay/40 bg-paper-deep p-4 text-[14px] leading-relaxed text-ink"
        >
          <PlainoStatus state="sleep" size={28} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Plaino is resting
            </p>
            <p className="mt-1 text-ink-soft">{customerNotice}</p>
            {showOperator ? (
              <p className="mt-3 border-t border-rule pt-3 font-mono text-[12px] leading-relaxed text-ink-soft">
                <span className="text-clay">operator only:</span>{" "}
                {operatorNotice}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-8 flex items-start gap-4 border border-clay/40 bg-paper-deep p-4 text-[15px] leading-relaxed text-ink ${className ?? ""}`}
    >
      <PlainoStatus state="sleep" size={44} className="mt-0.5 shrink-0" />
      <div>
        <p className="mb-1 font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          Plaino is resting
        </p>
        <p>{customerNotice}</p>
        {showOperator ? (
          <p className="mt-3 border-t border-rule pt-3 font-mono text-[12px] leading-relaxed text-ink-soft">
            <span className="text-clay">operator only:</span> {operatorNotice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default PlainoRestingBanner;
