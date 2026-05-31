import Link from "next/link";
import { requireWorkspaceMember } from "@/lib/auth";
import { withSystemContext } from "@/lib/db";
import { ApWorkspaceStrip } from "@/components/ui/ap";
import { signOutAction } from "../../actions";
import { WorkspaceNavLink } from "./WorkspaceNavLink";
import { isWorkspacePaused } from "@/lib/billing/workspace-paused-gate";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

const NAV: Array<{ href: string; label: string }> = [
  { href: "", label: "Overview" },
  { href: "/talk", label: "Talk to Plaino" },
  { href: "/disciplines", label: "Disciplines" },
  { href: "/fleet", label: "Fleet" },
  { href: "/activity", label: "Activity" },
  { href: "/approvals", label: "Approvals" },
  { href: "/agents", label: "Agents" },
  { href: "/compliance", label: "Compliance" },
  { href: "/briefings", label: "Briefings" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
];

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = await params;
  const member = await requireWorkspaceMember(id, ["BROKER_OWNER"]);

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({ where: { id }, select: { id: true, name: true, slug: true } }),
  );
  if (!workspace) {
    // Shouldn't happen — requireWorkspaceMember already redirects on miss.
    return null;
  }

  // Wave-3 phase 5 — read subscription status once so every workspace
  // page surfaces a "Plaino is paused — update billing to resume" banner
  // when PAUSED / PAST_DUE. The runtime gate at the Inngest layer
  // already prevents fleet activity in that state; this banner is the
  // customer-visible reason.
  const pauseState = await isWorkspacePaused({ workspaceId: id }).catch(
    () => ({ isPaused: false, status: null, reason: '' }),
  );

  const base = `/app/workspace/${id}`;

  return (
    <div>
      <a href="#workspace-main" className="skip-to-content">
        skip to content
      </a>
      <ApWorkspaceStrip
        slug={workspace.slug}
        name={workspace.name}
        right={
          <>
            <span>{member.email}</span>
            <span aria-hidden>·</span>
            <span>{member.role.replace("_", " ").toLowerCase()}</span>
            {member.isOperator ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href="/operator/leadership-board"
                  className="text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
                >
                  operator
                </Link>
              </>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
              >
                sign out
              </button>
            </form>
          </>
        }
        nav={NAV.map((item) => (
          <WorkspaceNavLink
            key={item.label}
            href={`${base}${item.href}`}
            exact={item.href === ""}
          >
            {item.label}
          </WorkspaceNavLink>
        ))}
      />
      {pauseState.isPaused ? (
        <div className="container-wide mt-4">
          <div
            role="status"
            aria-live="polite"
            className="border border-flag bg-paper p-4 text-[14px] text-ink"
          >
            {pauseState.status === null ? (
              // Wave-4 — abandoned-signup state. No Subscription row exists;
              // the gate fired because setupDeactivatedAt is set. Different
              // copy because the customer hasn't finished checkout in the
              // first place — they're not behind on billing, they never
              // started.
              <>
                <p className="font-medium">
                  Complete setup to resume Plaino.
                </p>
                <p className="mt-2 text-ink-soft">
                  Plaino is on standby — you signed up but did not finish
                  Stripe Checkout, so the fleet is not running drafts,
                  briefings, or sync work for {workspace.name}. Add your
                  payment method in{' '}
                  <Link
                    href={`${base}/settings/billing`}
                    className="underline underline-offset-4 hover:text-ink"
                  >
                    Settings · Billing
                  </Link>
                  {' '}to bring the fleet online.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">
                  Plaino is paused — update billing to resume.
                </p>
                <p className="mt-2 text-ink-soft">
                  Your subscription is {pauseState.status === 'PAUSED' ? 'paused' : 'past due'};
                  Plaino is not running drafts, briefings, or sync work until billing
                  is current. Update your payment method in{' '}
                  <Link
                    href={`${base}/settings/billing`}
                    className="underline underline-offset-4 hover:text-ink"
                  >
                    Settings · Billing
                  </Link>
                  {' '}to bring the fleet back online.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
      {/* tabIndex=-1 so the skip-to-content anchor moves focus here without
          adding a permanent tab stop. <section> not <main> because
          ApAppShell already wraps children in a single <main>. */}
      <section
        id="workspace-main"
        tabIndex={-1}
        aria-label="workspace content"
        className="container-wide py-10 focus:outline-none"
      >
        {children}
      </section>
    </div>
  );
}
