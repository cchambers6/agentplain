import { redirect } from "next/navigation";
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
        <p className="eyebrow mb-4">No workspace</p>
        <h1 className="font-display text-3xl leading-tight text-ink">
          You're signed in, but no workspace is attached to this account.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Reach out to the agentplain operator to be added to a workspace.
        </p>
      </div>
    </div>
  );
}
