import Link from "next/link";
import { ApEyebrow, ApHeritageButton } from "@/components/ui/ap";
import { withWorkspace } from "@/lib/auth";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import {
  runActivationForWorkspace,
  loadActivationDraft,
} from "@/lib/onboarding/activation-run";
import { autoClearDemoIfRealData } from "@/lib/onboarding/demo-seed";
import { WelcomeExperience } from "./WelcomeExperience";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

/**
 * The first-5-min magic-moment surface. The customer lands here right after
 * signup / onboarding and watches Plaino draft the one piece of work their
 * vertical's killer workflow promises — then approves it in one click.
 *
 * The activation run is idempotent (lib/onboarding/activation-run), so this
 * page is safe to revisit. Demo data auto-clears once real customer records
 * land; the draft itself is self-contained and survives the cleanup.
 */
export default async function WelcomePage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const { member } = await withWorkspace(workspaceId, ["BROKER_OWNER"]);

  // Ensure the activation draft exists (idempotent — seeds demo data on first
  // call, returns the existing draft thereafter), then clear demo data if the
  // customer's real records have already landed. The draft survives cleanup.
  await runActivationForWorkspace({ workspaceId });
  await autoClearDemoIfRealData(workspaceId);
  const draft = await loadActivationDraft(workspaceId);

  const partner = servicePartnerForWorkspace(workspaceId);
  const ownerFirstName = firstNameFromEmail(member.email);

  return (
    <div className="mx-auto max-w-3xl">
      <ApEyebrow className="mb-3">welcome · your first 5 minutes</ApEyebrow>
      <h1 className="font-display text-4xl leading-tight text-ink md:text-5xl">
        Watch {partner} earn their keep.
      </h1>
      <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        Before you get pulled into your day, {partner} already started. Here’s
        the first real thing — drafted, ready for your yes.
      </p>

      <div className="mt-8">
        {draft ? (
          <WelcomeExperience
            workspaceId={workspaceId}
            partner={partner}
            ownerFirstName={ownerFirstName}
            draft={draft}
          />
        ) : (
          <div className="border border-rule bg-paper p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              first draft
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              {partner} is getting your first draft ready. It lands in your
              approvals queue in just a moment.
            </p>
            <div className="mt-5">
              <ApHeritageButton
                variant="primary"
                withArrow
                href={`/app/workspace/${workspaceId}/approvals`}
              >
                open your queue
              </ApHeritageButton>
            </div>
          </div>
        )}
      </div>

      <p className="mt-8 text-[12px] leading-relaxed text-mute">
        Want the full picture?{" "}
        <Link
          href={`/app/workspace/${workspaceId}`}
          className="text-ink underline-offset-4 hover:underline"
        >
          Open your workspace
        </Link>{" "}
        to see everything {partner} is watching.
      </p>
    </div>
  );
}

function firstNameFromEmail(email: string): string {
  if (!email) return "there";
  const local = email.split("@", 1)[0] ?? "";
  if (!local) return "there";
  const first = local.split(/[.\-_+]/, 1)[0] ?? "";
  if (!first) return "there";
  if (/^\d+$/.test(first)) return "there";
  return first[0]!.toUpperCase() + first.slice(1);
}
