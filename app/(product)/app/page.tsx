import { redirect } from "next/navigation";
import { ApHeritageButton } from "@/components/ui/ap";
import {
  defaultWorkspaceIdFor,
  getCurrentSession,
} from "@/lib/auth";

// Default landing for /app. Routes the user to their workspace overview, or
// to sign-in if no session, or to a "no workspace yet" placeholder if signed
// in but unaffiliated (rare in Phase 1 — signup auto-creates a workspace).

export default async function AppRootPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/app/sign-in");

  const workspaceId =
    session.activeWorkspaceId ?? (await defaultWorkspaceIdFor(session.userId));
  if (workspaceId) {
    redirect(`/app/workspace/${workspaceId}`);
  }

  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute mb-4">
          no workspace
        </p>
        <h1 className="font-display text-3xl leading-tight text-ink">
          You&rsquo;re signed in, but no workspace is attached to this
          account.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Two ways forward: if your team already runs on agentplain, ask
          the owner to add you from their Team page. Starting fresh? Set
          up your own workspace — it takes about a minute.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ApHeritageButton variant="primary" withArrow href="/app/sign-up">
            set up a workspace
          </ApHeritageButton>
          <a
            href="mailto:hello@agentplain.com"
            className="text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
          >
            or ask a human — a real person reads every note
          </a>
        </div>
      </div>
    </div>
  );
}
