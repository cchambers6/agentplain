import Link from "next/link";
import { withWorkspace } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { STEP_META, STEP_ORDER, isStepId } from "@/lib/onboarding/steps";
import { getVerticalContent } from "@/lib/verticals";
import { advanceOnboardingAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const { workspace, rls } = await withWorkspace(workspaceId, ["BROKER_OWNER"]);

  let state = await withRls(rls, (tx) =>
    tx.onboardingState.findUnique({ where: { workspaceId } }),
  );

  // Backstop: workspaces created before the migration ran might be missing
  // OnboardingState. Create it lazily under the workspace's RLS context.
  if (!state) {
    state = await withRls(rls, (tx) =>
      tx.onboardingState.create({ data: { workspaceId } }),
    );
  }

  if (state.completedAt) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow mb-3">Onboarding</p>
        <h1 className="font-display text-3xl text-ink">Workspace ready.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          The 9am block runs tomorrow. You can revisit setup any time from{" "}
          <Link
            href={`/app/workspace/${workspaceId}/settings`}
            className="text-ink underline"
          >
            Settings
          </Link>
          .
        </p>
        <Link
          href={`/app/workspace/${workspaceId}`}
          className="btn-primary mt-8 inline-flex"
        >
          Back to workspace
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  const currentStep = isStepId(state.currentStep)
    ? state.currentStep
    : "confirm_details";
  const currentMeta = STEP_META[currentStep];
  const completed = (state.completedSteps as unknown[]).filter(
    (s): s is string => typeof s === "string",
  );

  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const verticalContent = verticalSlug
    ? getVerticalContent(verticalSlug)
    : null;
  const verticalLabel = verticalContent?.name ?? workspace.vertical;
  const verticalIsLive = verticalSlug === "real-estate";

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow mb-3">
        Step {currentMeta.index} of {STEP_ORDER.length - 1}
      </p>
      <h1 className="font-display text-3xl text-ink">{currentMeta.label}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        {currentMeta.description}
      </p>

      <ol className="mt-8 grid gap-3 border-y border-rule py-5 text-[13px] text-mute">
        {STEP_ORDER.filter((s) => s !== "done").map((s) => {
          const isDone = completed.includes(s);
          const isCurrent = s === currentStep;
          return (
            <li key={s} className="flex items-baseline gap-3">
              <span
                className={`font-mono text-[11px] uppercase tracking-eyebrow ${
                  isCurrent ? "text-ink" : "text-mute"
                }`}
              >
                {STEP_META[s].index}.
              </span>
              <span className={isCurrent ? "text-ink" : ""}>
                {STEP_META[s].label}
              </span>
              {isDone ? (
                <span className="ml-auto font-mono text-[11px] uppercase tracking-eyebrow text-moss">
                  complete
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <section className="mt-8 border border-rule bg-paper p-6">
        {currentStep === "confirm_details" ? (
          <ConfirmDetails
            workspaceName={workspace.name}
            verticalLabel={verticalLabel}
            tier={workspace.verticalTier}
            verticalIsLive={verticalIsLive}
          />
        ) : (
          <ConnectIntegration />
        )}

        <form
          action={advanceOnboardingAction.bind(null, workspaceId, currentStep)}
          className="mt-6 flex flex-wrap items-center gap-3"
        >
          <button type="submit" className="btn-primary">
            {currentStep === "connect_integration"
              ? "Finish onboarding"
              : "Looks right — continue"}
            <span aria-hidden>→</span>
          </button>
          {currentStep === "connect_integration" ? (
            <input type="hidden" name="skipped" value="true" />
          ) : null}
          <Link
            href={`/app/workspace/${workspaceId}`}
            className="text-sm text-mute underline-offset-4 hover:underline"
          >
            Back to workspace
          </Link>
        </form>
      </section>
    </div>
  );
}

function ConfirmDetails({
  workspaceName,
  verticalLabel,
  tier,
  verticalIsLive,
}: {
  workspaceName: string;
  verticalLabel: string;
  tier: string;
  verticalIsLive: boolean;
}) {
  return (
    <dl className="grid gap-3 text-[15px] text-ink">
      <Row label="Workspace name" value={workspaceName} />
      <Row
        label="Vertical"
        value={verticalIsLive ? verticalLabel : `${verticalLabel} — early access`}
      />
      <Row label="Tier" value={tier} />
      <p className="mt-3 border-t border-rule pt-3 text-[13px] text-mute">
        To change any of this later, head to Settings inside the workspace.
      </p>
    </dl>
  );
}

function ConnectIntegration() {
  return (
    <div className="text-[15px] leading-relaxed text-ink-soft">
      <p className="text-ink">
        Phase 1 ships without a self-serve integration flow. Reach out to the
        agentplain team to wire up your CRM / MLS / AMS / ATS / accounting,
        or skip — the fleet works with manually-entered data while you decide.
      </p>
      <p className="mt-3 text-[13px] text-mute">
        Per the no-outbound architecture, every integration is read-only from
        our side; sends still happen in your own systems.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-rule/60 pb-2 last:border-b-0">
      <dt className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {label}
      </dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export const dynamic = "force-dynamic";
