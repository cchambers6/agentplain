import Link from "next/link";
import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
  PlainoAvatar,
} from "@/components/ui/ap";
import { withWorkspace } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { listIntegrations, oauthStartPath } from "@/lib/integrations/marketplace";
import { isIntegrationConfigured } from "@/lib/integrations/config-status";
import {
  STEP_META,
  STEP_ORDER,
  isStepId,
  type StepId,
} from "@/lib/onboarding/steps";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import {
  CALENDAR_WINDOWS,
  DRAFTING_TONES,
  getWorkspacePreference,
  type DraftingTone,
  type WorkspacePreferenceView,
} from "@/lib/preferences";
import { getVerticalContent } from "@/lib/verticals";
import type { VerticalContent } from "@/lib/verticals/types";
import { advanceOnboardingAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Guided product surface. Each step renders inside an ApPaperCard; a
// sticky preview pane on the right shows the workspace card the
// customer is building toward.
//
// Voice: service-partnership. The header introduces the named service
// partner; every body sentence reports what the fleet is doing or what
// the partner needs from the customer to keep moving.
//
// Per project_no_outbound_architecture.md, integration copy emphasizes
// "watch / draft / advise" — never "send" or "execute."
export default async function OnboardingPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const { workspace, member, rls } = await withWorkspace(workspaceId, [
    "BROKER_OWNER",
  ]);

  let state = await withRls(rls, (tx) =>
    tx.onboardingState.findUnique({ where: { workspaceId } }),
  );

  if (!state) {
    state = await withRls(rls, (tx) =>
      tx.onboardingState.create({ data: { workspaceId } }),
    );
  }

  const connectedIntegrations = await withRls(rls, (tx) =>
    tx.integrationCredential.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: { provider: true, accountEmail: true },
      orderBy: { createdAt: "desc" },
    }),
  );

  // Load any prior preferences so a returning visitor sees their last
  // selections pre-filled — the form posts the same axes back, the
  // server upserts.
  const existingPreference = await getWorkspacePreference(rls, workspaceId);

  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const verticalContent = verticalSlug
    ? getVerticalContent(verticalSlug)
    : null;
  const verticalLabel = verticalContent?.name ?? workspace.vertical;
  const verticalIsLive = verticalSlug === "real-estate";

  const partner = servicePartnerForWorkspace(workspaceId);
  const ownerFirstName = firstNameFromEmail(member.email);

  if (state.completedAt) {
    return (
      <div className="mx-auto max-w-3xl">
        <ApEyebrow className="mb-3">onboarding · complete</ApEyebrow>
        <h1 className="font-display text-4xl leading-tight text-ink md:text-5xl">
          Your workspace is rooted.
        </h1>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          The 9am block runs tomorrow. {partner} files the first briefing
          then; drafts and compliance flags queue to your overview
          throughout the day. Revisit any setup choice from{" "}
          <Link
            href={`/app/workspace/${workspaceId}/settings`}
            className="text-ink underline"
          >
            Settings
          </Link>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ApHeritageButton
            variant="primary"
            withArrow
            href={`/app/workspace/${workspaceId}`}
          >
            open workspace
          </ApHeritageButton>
          <ApHeritageButton
            variant="secondary"
            withArrow
            href={`/app/workspace/${workspaceId}/agents`}
          >
            see the fleet
          </ApHeritageButton>
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

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10">
        <ApEyebrow>onboarding · welcome</ApEyebrow>
        <div className="mt-3 flex items-start gap-4">
          <PlainoAvatar size="lg" />
          <h1 className="font-display text-3xl leading-tight text-ink md:text-4xl">
            Hi {ownerFirstName}. I&rsquo;m {partner}, your service partner
            at agentplain. Let me get your fleet rooted in your shop.
          </h1>
        </div>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          Three quick steps — confirm a few details, tell me which tools
          to read from, set your drafting tone. I take it from there.
          The 9am block lands the first briefing tomorrow.
        </p>

        <StepCards
          current={currentStep}
          completed={completed}
        />
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section>
          <ApPaperCard
            eyebrow={`step ${currentMeta.index} · in progress`}
            title={currentMeta.label.toLowerCase()}
            density="spacious"
          >
            <p className="text-[15px] leading-relaxed text-ink-soft">
              {currentMeta.description}
            </p>

            <div className="mt-6">
              {currentStep === "confirm_details" ? (
                <ConfirmDetails
                  workspaceName={workspace.name}
                  verticalLabel={verticalLabel}
                  tier={workspace.verticalTier}
                  verticalIsLive={verticalIsLive}
                />
              ) : currentStep === "connect_integration" ? (
                <ConnectIntegration
                  workspaceId={workspaceId}
                  verticalContent={verticalContent}
                  connectedIntegrations={connectedIntegrations}
                  partner={partner}
                />
              ) : (
                <SetPreferences
                  partner={partner}
                  existing={existingPreference}
                />
              )}
            </div>

            <form
              action={advanceOnboardingAction.bind(
                null,
                workspaceId,
                currentStep,
              )}
              className="mt-8 flex flex-wrap items-center gap-3 border-t border-rule pt-6"
            >
              <ApHeritageButton variant="primary" withArrow type="submit">
                {currentStep === "set_preferences"
                  ? "done — open workspace"
                  : "looks right — continue"}
              </ApHeritageButton>
              {currentStep === "connect_integration" ? (
                <button
                  type="submit"
                  name="skipped"
                  value="true"
                  className="text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
                >
                  skip for now
                </button>
              ) : null}
              <Link
                href={`/app/workspace/${workspaceId}`}
                className="ml-auto text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
              >
                back to workspace
              </Link>
            </form>
          </ApPaperCard>
        </section>

        <aside className="sticky top-6 self-start">
          <WorkspacePreview
            workspaceName={workspace.name}
            verticalContent={verticalContent}
            verticalLabel={verticalLabel}
            tier={workspace.verticalTier}
            verticalIsLive={verticalIsLive}
            currentStep={currentStep}
            partner={partner}
          />
        </aside>
      </div>
    </div>
  );
}

// ─── Step cards (replaces progress bar) ─────────────────────────────────────

function StepCards({
  current,
  completed,
}: {
  current: StepId;
  completed: string[];
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
        const status = isDone
          ? "complete"
          : isCurrent
            ? "in progress"
            : "next up";
        return (
          <li key={s} className="bg-paper p-5">
            <p
              className={`font-mono text-[11px] tracking-eyebrow uppercase ${accentColor}`}
            >
              step {meta.index} · {status}
            </p>
            <p
              className={`mt-2 font-display text-base leading-tight ${
                isCurrent ? "text-ink" : isDone ? "text-ink" : "text-mute"
              }`}
            >
              {meta.label.toLowerCase()}
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
        These details ride along on every draft your fleet produces —
        production reports, briefings, the broker-of-record review
        screen all read from them. Double-check; you can revisit any
        of this from Settings.
      </p>
      <dl className="mt-6 grid gap-4 text-[15px] text-ink">
        <Row label="workspace name" value={workspaceName} />
        <Row
          label="vertical"
          value={
            verticalIsLive
              ? verticalLabel
              : `${verticalLabel} — early access`
          }
        />
        <Row label="tier" value={tier} />
      </dl>
      {!verticalIsLive ? (
        <p className="mt-6 border border-rule bg-paper-deep p-4 text-[13px] leading-relaxed text-ink-soft">
          The per-vertical fleet for {verticalLabel} is rooting in. You
          can finish onboarding now; your workspace activates the moment
          the agents come online.
        </p>
      ) : null}
    </div>
  );
}

function ConnectIntegration({
  workspaceId,
  verticalContent,
  connectedIntegrations,
  partner,
}: {
  workspaceId: string;
  verticalContent: VerticalContent | null;
  connectedIntegrations: Array<{ provider: string; accountEmail: string | null }>;
  partner: string;
}) {
  const planned = verticalContent?.integrations.planned ?? [];
  const plannedWindow = verticalContent?.integrations.plannedWindow ?? "Q3 2026";
  const available = listIntegrations().filter((m) => m.status === "available");
  const primary = available[0] ?? null;
  // Only claim a connection is "live" and offer the one-tap CTA when the
  // provider's OAuth credentials are actually configured. Otherwise the CTA
  // dead-ends at the start route's `oauth_not_configured` branch — so we show
  // an honest "your service partner wires it with you" state instead.
  const primaryConfigured = primary ? isIntegrationConfigured(primary) : false;
  const hasConnection = connectedIntegrations.length > 0;
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        We read from the tools you already pay for. Read-only on arrival
        — we watch for messages, you stay in control. We never send
        outbound on your behalf; your existing inbox handles every send.
      </p>

      {hasConnection ? (
        <div className="border border-moss bg-paper p-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-moss">
            connected
          </p>
          <ul className="mt-3 space-y-2 text-[15px] text-ink">
            {connectedIntegrations.map((c) => (
              <li key={`${c.provider}:${c.accountEmail ?? ""}`}>
                <span className="font-mono text-[12px] text-mute">
                  {c.provider}
                </span>
                {c.accountEmail ? (
                  <span className="ml-2">{c.accountEmail}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
            {partner} will start watching for new messages on the next
            sweep. The next step sets your drafting tone and the
            categorization defaults the fleet uses on every reply.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-mute">
            Need to wire another tool first?{" "}
            <Link
              href={`/app/workspace/${workspaceId}/integrations`}
              className="text-ink underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
            >
              add it from connections
            </Link>{" "}
            — your spot in onboarding holds.
          </p>
        </div>
      ) : (
        <div className="border border-ink bg-paper-deep p-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
            connect a tool
          </p>
          {primary && primaryConfigured ? (
            <>
              <p className="mt-2 text-[15px] leading-relaxed text-ink">
                One-tap read-only {primary.name} connection. The fleet starts
                reading your inbox the moment you finish.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <ApHeritageButton
                  variant="primary"
                  withArrow
                  href={oauthStartPath(
                    primary,
                    workspaceId,
                    `/app/workspace/${workspaceId}/onboarding`,
                  )}
                >
                  connect {primary.name.toLowerCase()}
                </ApHeritageButton>
                <Link
                  href={`/app/workspace/${workspaceId}/integrations`}
                  className="self-center text-sm text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
                >
                  see all connections
                </Link>
              </div>
            </>
          ) : primary ? (
            <>
              <p className="mt-2 text-[15px] leading-relaxed text-ink">
                Your {primary.name} connection opens for your workspace on the
                welcome call — {partner} wires it with you, then the fleet
                starts reading. Nothing here blocks; continue setup and{" "}
                {partner} picks it up.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/app/workspace/${workspaceId}/integrations`}
                  className="self-center text-sm text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
                >
                  see all connections
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-[15px] leading-relaxed text-ink">
                Pick a tool to connect from your connections.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <ApHeritageButton
                  variant="primary"
                  withArrow
                  href={`/app/workspace/${workspaceId}/integrations`}
                >
                  open connections
                </ApHeritageButton>
              </div>
            </>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-mute">
            Nothing about the workspace blocks on a connector — skip
            below if you&rsquo;d rather wire it on the welcome call with
            {" "}{partner}.
          </p>
        </div>
      )}

      <div>
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          also planned · {plannedWindow}
        </p>
        {planned.length === 0 ? (
          <p className="mt-3 text-[14px] text-mute">
            Nothing else on the roadmap for this vertical yet.
          </p>
        ) : (
          <ul className="mt-3 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
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
    </div>
  );
}

const TONE_LABELS: Record<DraftingTone, string> = {
  plain: "Plain",
  "warm-professional": "Warm-professional",
  formal: "Formal",
};

function SetPreferences({
  partner,
  existing,
}: {
  partner: string;
  existing: WorkspacePreferenceView | null;
}) {
  const selectedTone: DraftingTone = existing?.draftingTone ?? "warm-professional";
  const selectedCalendar = existing?.calendarWindow ?? "9-5 weekdays";
  const notes = existing?.categorizationNotes ?? "";
  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        Tell {partner} once. He honors these on every draft and adjusts as
        you edit. You can revisit any of this from Settings later.
      </p>

      <FieldGroup
        label="drafting tone"
        helper="How the fleet sounds in customer-facing drafts. Your broker-of-record review still gates every send."
      >
        <RadioPills
          name="draftingTone"
          options={DRAFTING_TONES.map((value) => ({
            value,
            label: TONE_LABELS[value],
          }))}
          selected={selectedTone}
        />
      </FieldGroup>

      <FieldGroup
        label="inbound categorization notes"
        helper="What should the router treat as hot vs. information-only vs. skip? Free-form prose — {partner} reads it on every fire."
      >
        <textarea
          name="categorizationNotes"
          defaultValue={notes}
          rows={4}
          maxLength={2000}
          placeholder="e.g. Treat any message referencing 'pre-approved' as a hot buyer. Skip newsletter footers even if they mention an address."
          className="w-full border border-rule bg-paper p-3 text-[14px] leading-relaxed text-ink placeholder:text-mute focus:border-ink focus:outline-none"
        />
      </FieldGroup>

      <FieldGroup
        label="calendar window for showings + meetings"
        helper="The Showing Scheduler proposes slots inside this window. You still confirm each one."
      >
        <RadioPills
          name="calendarWindow"
          options={CALENDAR_WINDOWS.map((value) => ({
            value,
            label: CALENDAR_LABELS[value] ?? value,
          }))}
          selected={selectedCalendar}
        />
      </FieldGroup>

      <p className="border-t border-rule pt-5 text-[12px] leading-relaxed text-mute">
        Saved when you finish onboarding. Edits in /approvals teach the
        fleet too — no resave needed.
      </p>
    </div>
  );
}

const CALENDAR_LABELS: Record<string, string> = {
  "9-5 weekdays": "9–5 weekdays",
  "8-7 + Sat AM": "8–7 + Sat AM",
  custom: "Custom",
};

function RadioPills({
  name,
  options,
  selected,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  selected: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isOn = opt.value === selected;
        return (
          <label
            key={opt.value}
            className={
              isOn
                ? "cursor-pointer border border-clay bg-clay px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase text-paper"
                : "cursor-pointer border border-rule bg-paper px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute hover:border-ink hover:text-ink"
            }
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              defaultChecked={isOn}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
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
  partner,
}: {
  workspaceName: string;
  verticalContent: VerticalContent | null;
  verticalLabel: string;
  tier: string;
  verticalIsLive: boolean;
  currentStep: StepId;
  partner: string;
}) {
  const integrationLine =
    currentStep === "connect_integration" || currentStep === "set_preferences"
      ? "first integration · wiring up"
      : "first integration · not yet";
  const preferencesLine =
    currentStep === "set_preferences"
      ? "preferences · defaults applied"
      : "preferences · pending";

  return (
    <div className="border border-rule bg-paper-deep p-5">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        preview · what {partner} sees
      </p>
      <div className="mt-3 border border-rule bg-paper p-5">
        <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
          workspace
        </p>
        <p className="mt-1 font-display text-xl leading-tight text-ink">
          {workspaceName}
        </p>

        <dl className="mt-4 space-y-2 text-[13px]">
          <PreviewRow
            label="vertical"
            value={
              verticalIsLive
                ? verticalLabel
                : `${verticalLabel} — early access`
            }
          />
          <PreviewRow label="tier" value={tier} />
          <PreviewRow label="status" value={integrationLine} />
          <PreviewRow label="defaults" value={preferencesLine} />
        </dl>

        {verticalContent ? (
          <p className="mt-4 border-t border-rule pt-3 text-[12px] leading-relaxed text-ink-soft">
            {verticalContent.hero.headline}
          </p>
        ) : null}
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-mute">
        Updates as you complete each step.
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

// Best-effort first-name extraction from email local-part. Returns "there"
// when the local-part doesn't yield anything human-shaped.
function firstNameFromEmail(email: string): string {
  if (!email) return "there";
  const local = email.split("@", 1)[0] ?? "";
  if (!local) return "there";
  const first = local.split(/[.\-_+]/, 1)[0] ?? "";
  if (!first) return "there";
  if (/^\d+$/.test(first)) return "there";
  return first[0]!.toUpperCase() + first.slice(1);
}

export const dynamic = "force-dynamic";
