import Link from "next/link";

/**
 * Contextual "I'm stuck" affordance for the signup → first-value funnel.
 *
 * Every step where a customer can get blocked carries one of these. It deep-
 * links to the workspace help surface with the step already named in the
 * subject (`?subject=`), so the customer describes what's wrong, not where
 * they are. The help form posts to the service-partner message flow, which
 * is the bridge to the #244 ticket lifecycle once it lands.
 *
 * Plaino voice: a hand offered, not a ticket queue. Calm, never alarmed.
 *
 * Used pre-workspace (signup) too, where there's no workspace yet — that
 * caller passes `href` directly (a mailto) instead of a workspaceId.
 */
export function StuckHelpLink({
  workspaceId,
  subject,
  label = "Stuck? Message your service partner",
  className,
}: {
  workspaceId: string;
  /** Pre-fills the help form subject so the partner sees the step instantly. */
  subject: string;
  label?: string;
  className?: string;
}) {
  const href = `/app/workspace/${workspaceId}/support/new?subject=${encodeURIComponent(
    subject,
  )}`;
  return (
    <p
      className={
        className ??
        "mt-4 text-[13px] leading-relaxed text-mute"
      }
    >
      <Link
        href={href}
        className="text-ink underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
      >
        {label}
      </Link>{" "}
      — a real person reads every note.
    </p>
  );
}
