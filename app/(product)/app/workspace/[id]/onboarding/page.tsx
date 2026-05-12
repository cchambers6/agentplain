import Link from "next/link";
import { withWorkspace } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import {
  STEP_META,
  STEP_ORDER,
  isStepId,
  type StepId,
} from "@/lib/onboarding/steps";
import { getVerticalContent } from "@/lib/verticals";
import type { VerticalContent } from "@/lib/verticals/types";
import { advanceOnboardingAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Guided product tour. Each step renders its own form below the progress
// indicator; a sticky preview pane on the right shows the workspace card
// the customer is building toward.
//
// Brand tokens only — no hardcoded hex, no marketing voice. Customer-surface
// chrome is calm and dense per product_spec.md §9.
//
// Per project_no_outbound_architecture.md, integration copy emphasizes
// "watch / draft / advise" — never "send" or "execute."
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

  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const verticalContent = verticalSlug
    ? getVerticalContent(verticalSlug)
    : null;
  const verticalLabel = verticalContent?.name ?? workspace.vertical;
  const verticalIsLive = verticalSlug === "real-estate";

  if (state.completedAt) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow mb-3">Onboarding</p>
        <h1 className="font-display text-4xl leading-tight text-ink md:text-5xl">
          Workspace ready.
        </h1>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          The 9am block runs tomorrow. Your chief-of-staff agent files the
          first briefing then; drafts and compliance flags queue to the
          overview throughout the day. Revisit any setup choice from{" "}
          <Link
            href={`/app/workspace/${workspaceId}/settings`}
            className="text-ink underline"
          >
            Settings
          </Link>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/app/workspace/${workspaceId}`}
            className="btn-primary"
          >
            Open workspace
            <span aria-hidden>→</span>
          </Link>
          <Link
            href={`/app/workspace/${workspaceId}/agents`}
            className="btn-secondary"
          >
            See the fleet
            <span aria-hidden>→</span>
          </Link>
        </div>
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

  const totalInputSteps = STEP_ORDER.length - 1; // exclude "done"

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header — eyebrow + progress + heading */}
      <header className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="eyebrow">
            Onboarding · step {currentMeta.index} of {totalInputSteps}
          </p>
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            ~10 minutes
          </p>
        </div>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl">
          {currentMeta.label}
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          {currentMeta.description}
        </p>

        <ProgressBar
          current={currentStep}
          completed={completed}
          workspaceId={workspaceId}
        />
      </header>

      {/* Two-column: form left, sticky preview right */}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section className="border border-rule bg-paper p-6 md:p-8">
          {currentStep === "confirm_details" ? (
            <ConfirmDetails
              workspaceName={workspace.name}
              verticalLabel={verticalLabel}
              tier={workspace.verticalTier}
              verticalIsLive={verticalIsLive}
            />
          ) : currentStep === "connect_integration" ? (
            <ConnectIntegration verticalContent={verticalContent} />
          ) : (
            <SetPreferences />
          )}

          <form
            action={advanceOnboardingAction.bind(null, workspaceId, currentStep)}
            className="mt-8 flex flex-wrap items-center gap-3 border-t border-rule pt-6"
          >
            <button type="submit" className="btn-primary">
              {currentStep === "set_preferences"
                ? "Done — open workspace"
                : "Looks right — continue"}
              <span aria-hidden>→</span>
            </button>
            {currentStep === "connect_integration" ? (
              <button
                type="submit"
                name="skipped"
                value="true"
                className="text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
              >
                Skip for now
              </button>
            ) : null}
            <Link
              href={`/app/workspace/${workspaceId}`}
              className="ml-auto text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
            >
              Back to workspace
            </Link>
          </form>
        </section>

        <aside className="sticky top-6 self-start">
          <WorkspacePreview
            workspaceName={workspace.name}
            verticalContent={verticalContent}
            verticalLabel={verticalLabel}
            tier={workspace.verticalTier}
            verticalIsLive={verticalIsLive}
            currentStep={currentStep}
          />
        </aside>
      </div>
    </div>
  );
}

// ─── Progress bar ───────────────────────────────────────────────────────────

function ProgressBar({
  current,
  completed,
  workspaceId: _workspaceId,
}: {
  current: StepId;
  completed: string[];
  workspaceId: string;
}) {
  const inputSteps = STEP_ORDER.filter((s) => s !== "done");
  return (
    <ol className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
      {inputSteps.map((s) => {
        const meta = STEP_META[s];
        const isDone = completed.includes(s);
        const isCurrent = s === current;
        const accentColor = isDone
          ? "text-moss"
          : isCurrent
            ? "text-clay"
            : "text-mute";
        const status = isDone ? "complete" : isCurrent ? "in progress" : "next up";
        return (
          <li key={s} className="bg-paper p-4">
            <p
              className={`font-mono text-[11px] tracking-eyebrow uppercase ${accentColor}`}
            >
              Step {meta.index} · {status}
            </p>
            <p
              className={`mt-2 font-display text-base leading-tight ${
                isCurrent ? "text-ink" : isDone ? "text-ink" : "text-mute"
              }`}
            >
              {meta.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Step bodies ────────────────────────────────────────────────────────────

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
    <div>
      <p className="text-[15px] leading-relaxed text-ink-soft">
        These details ride along on every draft the fleet produces — they show
        up in production reports, briefings, and the broker-of-record review
        screen. Double-check before continuing; you can revisit any of this
        from Settings later.
      </p>
      <dl className="mt-6 grid gap-4 text-[15px] text-ink">
        <Row label="Workspace name" value={workspaceName} />
        <Row
          label="Vertical"
          value={
            verticalIsLive
              ? verticalLabel
              : `${verticalLabel} — early access`
          }
        />
        <Row label="Tier" value={tier} />
      </dl>
      {!verticalIsLive ? (
        <p className="mt-6 border border-rule bg-paper-deep p-4 text-[13px] leading-relaxed text-ink-soft">
          The per-vertical fleet for {verticalLabel} is initializing. You can
          finish onboarding now and the workspace will activate the moment the
          agents come online.
        </p>
      ) : null}
    </div>
  );
}

function ConnectIntegration({
  verticalContent,
}: {
  verticalContent: VerticalContent | null;
}) {
  const planned = verticalContent?.integrations.planned ?? [];
  const plannedWindow = verticalContent?.integrations.plannedWindow ?? "Q3 2026";
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        The fleet reads from the tools you already pay for. Read-only on
        arrival — we watch for messages, you stay in control. We never send
        outbound on your behalf; your existing CRM and inbox handle every send.
      </p>

      <div>
        <p className="eyebrow mb-3">Integrations planned · {plannedWindow}</p>
        {planned.length === 0 ? (
          <p className="text-[14px] text-mute">
            No integrations on the roadmap for this vertical yet.
          </p>
        ) : (
          <ul className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
            {planned.slice(0, 6).map((it) => (
              <li key={it.name} className="bg-paper p-4">
                <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                  {it.category}
                </p>
                <p className="mt-1 font-display text-base leading-tight text-ink">
                  {it.name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border border-rule bg-paper-deep p-4 text-[13px] leading-relaxed text-ink-soft">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          Phase 1 note
        </p>
        <p className="mt-2">
          Self-serve OAuth lands {plannedWindow}. Today the agentplain team
          wires your first integration during the onboarding call — reply to
          our welcome email or click <em>Skip for now</em> to keep moving. The
          fleet works on manually-entered data while we wire it up.
        </p>
      </div>
    </div>
  );
}

function SetPreferences() {
  // Phase 1: UI-only stub. Persistence wires up in a later workstream.
  // Each field renders as `disabled` with the chosen default highlighted so
  // the owner sees what the fleet will use — no false promise that the form
  // is saving choices today.
  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        The defaults below are what the fleet uses if you don't touch anything.
        Phase 1 ships read-only — these will be editable in the next release;
        we wanted you to see what's in play.
      </p>

      <FieldGroup
        label="Drafting tone"
        helper="How the fleet sounds in customer-facing drafts. Your broker-of-record review still gates every send."
      >
        <ToggleRow
          options={["Plain", "Warm-professional", "Formal"]}
          selected="Warm-professional"
        />
      </FieldGroup>

      <FieldGroup
        label="Inbound categorization defaults"
        helper="The Buyer Inquiry Router uses these labels to slot inbound messages into the right human's queue."
      >
        <ul className="grid gap-2 text-[13px] text-ink-soft">
          <li>— Hot buyer (in-market, defined timeline)</li>
          <li>— Information-only (price questions, brochure asks)</li>
          <li>— Vendor / partnership (skip queue)</li>
          <li>— Spam / consumer (silent file)</li>
        </ul>
      </FieldGroup>

      <FieldGroup
        label="Calendar window for showings + meetings"
        helper="The Showing Scheduler proposes slots inside this window. You still confirm each one."
      >
        <ToggleRow
          options={["9–5 weekdays", "8–7 + Sat AM", "Custom"]}
          selected="9–5 weekdays"
        />
      </FieldGroup>

      <p className="border-t border-rule pt-5 text-[12px] leading-relaxed text-mute">
        These choices commit on the next release. The fleet uses the
        highlighted defaults until then — no surprise behavior changes.
      </p>
    </div>
  );
}

function FieldGroup({
  label,
  helper,
  children,
}: {
  label: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-display text-base leading-tight text-ink">{label}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-mute">{helper}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ToggleRow({
  options,
  selected,
}: {
  options: string[];
  selected: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isOn = opt === selected;
        return (
          <span
            key={opt}
            className={
              isOn
                ? "border border-clay bg-clay px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase text-paper"
                : "border border-rule bg-paper px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute"
            }
          >
            {opt}
          </span>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-b border-rule/60 pb-3 last:border-b-0">
      <dt className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {label}
      </dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

// ─── Sticky preview pane ────────────────────────────────────────────────────

function WorkspacePreview({
  workspaceName,
  verticalContent,
  verticalLabel,
  tier,
  verticalIsLive,
  currentStep,
}: {
  workspaceName: string;
  verticalContent: VerticalContent | null;
  verticalLabel: string;
  tier: string;
  verticalIsLive: boolean;
  currentStep: StepId;
}) {
  const integrationLine =
    currentStep === "connect_integration" || currentStep === "set_preferences"
      ? "First integration · wiring up"
      : "First integration · not yet";
  const preferencesLine =
    currentStep === "set_preferences"
      ? "Preferences · defaults applied"
      : "Preferences · pending";

  return (
    <div className="border border-rule bg-paper-deep p-5">
      <p className="eyebrow mb-3">Preview · workspace card</p>
      <div className="border border-rule bg-paper p-5">
        <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
          Workspace
        </p>
        <p className="mt-1 font-display text-xl leading-tight text-ink">
          {workspaceName}
        </p>

        <dl className="mt-4 space-y-2 text-[13px]">
          <PreviewRow
            label="Vertical"
            value={
              verticalIsLive
                ? verticalLabel
                : `${verticalLabel} — early access`
            }
          />
          <PreviewRow label="Tier" value={tier} />
          <PreviewRow label="Status" value={integrationLine} />
          <PreviewRow label="Defaults" value={preferencesLine} />
        </dl>

        {verticalContent ? (
          <p className="mt-4 border-t border-rule pt-3 text-[12px] leading-relaxed text-ink-soft">
            {verticalContent.hero.headline}
          </p>
        ) : null}
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-mute">
        This card updates as you complete each step.
      </p>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
        {label}
      </dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export const dynamic = "force-dynamic";
