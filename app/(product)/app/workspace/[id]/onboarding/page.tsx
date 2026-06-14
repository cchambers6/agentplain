import Link from "next/link";
import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
  PlainoStatus,
} from "@/components/ui/ap";
import { withWorkspace } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { listDisciplines } from "@/lib/disciplines";
import {
  listIntegrations,
  oauthStartPath,
} from "@/lib/integrations/marketplace";
import { isIntegrationConfigured } from "@/lib/integrations/config-status";
import {
  INPUT_STEPS,
  STEP_META,
  isStepId,
  type StepId,
} from "@/lib/onboarding/steps";
import {
  readPickedSlugs,
  resolvePickableSkills,
  type PickableSkill,
} from "@/lib/onboarding/picked-skills";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { buildActivationCardFromConnectedProviders } from "@/lib/plaino/activation-card-server";
import type { MarketplaceProviderKey } from "@/lib/integrations/marketplace";
import { PlainoCardView } from "@/components/plaino/PlainoCardView";
import {
  CALENDAR_WINDOWS,
  DRAFTING_TONES,
  getWorkspacePreference,
  type DraftingTone,
  type WorkspacePreferenceView,
} from "@/lib/preferences";
import { getVerticalContent } from "@/lib/verticals";
import type { VerticalContent } from "@/lib/verticals/types";
import { FirstFireWatch } from "./FirstFireWatch";
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

  // Activation card — the killer-workflow lead a brand-new customer SEES in
  // their first session. Deterministic, zero LLM: it reads the workspace
  // vertical + the connected-integration set (both already loaded above) and
  // renders the one workflow that matters for this vertical, with the single
  // connect CTA that unlocks it. Mounted on the onboarding surface because
  // that is the real first-10-minutes experience and it renders without any
  // model credential (the /talk dispatcher short-circuits in degraded mode;
  // this never does). Additive + accessible: the onboarding prose above is
  // always the source of truth — the card follows it, never replaces it.
  const connectedProviderKeys = new Set<MarketplaceProviderKey>(
    connectedIntegrations.map((c) => c.provider as MarketplaceProviderKey),
  );
  const activationCard = buildActivationCardFromConnectedProviders({
    workspaceId,
    vertical: workspace.vertical,
    // Always a first session here — the completedAt branch returns early.
    firstSession: true,
    connectedProviders: connectedProviderKeys,
    onboarding: {
      verticalPicked: workspace.vertical !== null,
      firstToolConnected: connectedIntegrations.length > 0,
      scheduleWindowSet: existingPreference !== null,
      firstDraftReviewed: false,
    },
  });

  // Wave-9 — pickable skills (filtered to runtime:'live' + connector
  // gates). The pick_skills step renders these as checkboxes; the
  // first-fire preview footer on set_preferences names them; the
  // first_fire_watch step polls SkillRun for them.
  const hasInbox = connectedIntegrations.some(
    (c) => c.provider === "GOOGLE" || c.provider === "M365",
  );
  const pickableSkills = resolvePickableSkills({
    verticalSlug: verticalSlug ?? undefined,
    hasInbox,
  });
  const pickedSlugsFromState = readPickedSlugs(state.pickedSkillSlugs);
  // First visit to pick_skills: default to all pickable. Returning visit:
  // honor what they saved (including an empty list — that's a real opt-out).
  const isFirstVisitToPicker = !state.completedSteps
    ? true
    : !(state.completedSteps as unknown[]).some((s) => s === "pick_skills");
  const effectivePickedSlugs = isFirstVisitToPicker
    ? pickableSkills.filter((p) => p.defaultPicked).map((p) => p.slug)
    : pickedSlugsFromState;

  if (state.completedAt) {
    return (
      <div className="mx-auto max-w-3xl">
        <ApEyebrow className="mb-3">onboarding · complete</ApEyebrow>
        <h1 className="font-display text-4xl leading-tight text-ink md:text-5xl">
          Your workspace is rooted.
        </h1>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          {partner}&rsquo;s fleet is running on your workspace. The first
          fire landed in your approvals queue; the morning briefing files
          on the next 9am block. Revisit any setup choice from{" "}
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
            href={`/app/workspace/${workspaceId}/welcome`}
          >
            see your first draft
          </ApHeritageButton>
          <ApHeritageButton
            variant="secondary"
            withArrow
            href={`/app/workspace/${workspaceId}`}
          >
            open workspace
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
          <PlainoStatus state="sit" size={56} />
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

        {/* Activation lead — the one workflow that matters for this kind of
            business, with the single connection that brings it to life. The
            prose above stands on its own; this card points the way. */}
        <div className="mt-8 max-w-prose">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            here&rsquo;s the first thing I&rsquo;ll do for your shop
          </p>
          <PlainoCardView card={activationCard} />
        </div>

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
              ) : currentStep === "pick_skills" ? (
                <PickSkills
                  pickable={pickableSkills}
                  preChecked={new Set(effectivePickedSlugs)}
                  partner={partner}
                  hasInbox={hasInbox}
                  workspaceId={workspaceId}
                />
              ) : currentStep === "set_preferences" ? (
                <>
                  <SetPreferences
                    partner={partner}
                    existing={existingPreference}
                  />
                  <FirstFirePreview
                    partner={partner}
                    pickedSlugs={effectivePickedSlugs}
                    pickable={pickableSkills}
                  />
                </>
              ) : (
                <FirstFireWatchSection
                  workspaceId={workspaceId}
                  partner={partner}
                  pickedSlugs={effectivePickedSlugs}
                  pickable={pickableSkills}
                  requestedAt={state.firstFireRequestedAt ?? null}
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
              {currentStep === "pick_skills"
                ? // Hidden inputs name the selected skill slugs so the
                  // server action can read them without a separate
                  // form. The PickSkills body renders the visible
                  // checkboxes; here we mirror the default-picked set
                  // when the customer hasn't interacted yet. Customers
                  // who uncheck see their real selection persist because
                  // the checkbox name matches the hidden-input fallback
                  // (browsers submit visible checked checkboxes; the
                  // hidden mirrors are inside PickSkills already).
                  null
                : null}
              <ApHeritageButton variant="primary" withArrow type="submit">
                {currentStep === "set_preferences"
                  ? "save & start the first fire"
                  : currentStep === "first_fire_watch"
                    ? "open workspace"
                    : currentStep === "pick_skills"
                      ? "looks right — continue"
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
  return (
    <ol className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-5">
      {INPUT_STEPS.map((s) => {
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
  // Wave-9 — show the disciplines that will be installed so the customer
  // sees what's about to be rooted before they continue. The 8
  // disciplines are universal (every workspace gets all of them); the
  // copy below names the ones most concrete in the first session.
  const disciplines = listDisciplines();
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
      <div className="mt-6 border border-rule bg-paper-deep p-4">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          your fleet covers · {disciplines.length} disciplines
        </p>
        <ul className="mt-3 grid gap-x-4 gap-y-2 text-[14px] text-ink-soft sm:grid-cols-2">
          {disciplines.map((d) => (
            <li key={d.id} className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] uppercase text-mute">
                ·
              </span>
              <span className="text-ink">{d.name}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-relaxed text-mute">
          Every workspace gets all eight. The next step picks which
          ones we&rsquo;ll watch from day one — you can turn any of
          them off from settings later.
        </p>
      </div>
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
        helper={`What should the router treat as hot vs. information-only vs. skip? Free-form prose — ${partner} reads it on every fire.`}
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
  const stepIdx = INPUT_STEPS.indexOf(currentStep);
  const integrationLine =
    stepIdx >= INPUT_STEPS.indexOf("connect_integration") &&
    stepIdx > INPUT_STEPS.indexOf("connect_integration") - 1
      ? stepIdx > INPUT_STEPS.indexOf("connect_integration")
        ? "first integration · wired"
        : "first integration · wiring up"
      : "first integration · not yet";
  const skillsLine =
    stepIdx > INPUT_STEPS.indexOf("pick_skills")
      ? "skills · picked"
      : stepIdx === INPUT_STEPS.indexOf("pick_skills")
        ? "skills · picking now"
        : "skills · pending";
  const preferencesLine =
    stepIdx > INPUT_STEPS.indexOf("set_preferences")
      ? "preferences · defaults applied"
      : stepIdx === INPUT_STEPS.indexOf("set_preferences")
        ? "preferences · setting"
        : "preferences · pending";
  const fireLine =
    currentStep === "first_fire_watch"
      ? "first fire · in progress"
      : "first fire · queued";

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
          <PreviewRow label="picks" value={skillsLine} />
          <PreviewRow label="defaults" value={preferencesLine} />
          <PreviewRow label="first fire" value={fireLine} />
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

// ─── Pick skills (wave-9 step 3) ────────────────────────────────────────────

function PickSkills({
  pickable,
  preChecked,
  partner,
  hasInbox,
  workspaceId,
}: {
  pickable: PickableSkill[];
  preChecked: Set<string>;
  partner: string;
  hasInbox: boolean;
  workspaceId: string;
}) {
  if (pickable.length === 0) {
    return (
      <div className="border border-rule bg-paper-deep p-5 text-[14px] text-ink-soft">
        <p>
          Nothing in the live catalog matches your workspace yet. We&rsquo;re
          rooting your fleet in — {partner} will pick this back up on the
          welcome call.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        {hasInbox
          ? `${partner} will fire each of these once you finish onboarding. Uncheck anything you'd rather skip for now — you can re-enable any skill later from the marketplace.`
          : (
            <>
              {partner} can fire the items below from internal workspace data
              today.{" "}
              <Link
                href={`/app/workspace/${workspaceId}/integrations`}
                className="text-ink underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
              >
                Connect your inbox now
              </Link>{" "}
              to unlock inbox triage, the chief of staff, and follow-up chasing.
            </>
          )}
      </p>
      <ul className="grid gap-px overflow-hidden border border-rule bg-rule">
        {pickable.map((p) => (
          <li key={p.slug} className="bg-paper p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="pickedSkillSlugs"
                value={p.slug}
                defaultChecked={preChecked.has(p.slug)}
                className="mt-1"
              />
              <span>
                <span className="block font-display text-base leading-tight text-ink">
                  {p.name}
                </span>
                <span className="mt-1 block font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  {p.discipline.replace(/-/g, " ")}
                </span>
                <span className="mt-2 block text-[14px] leading-relaxed text-ink-soft">
                  {p.firstFirePromise}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="border-t border-rule pt-4 text-[12px] leading-relaxed text-mute">
        Honest scope: only skills that can produce real output on first
        fire are shown. The full catalog of {partner}&rsquo;s skills lives
        in the marketplace — pick any of them once you&rsquo;re in.
      </p>
    </div>
  );
}

// ─── First-fire preview (wave-9 set_preferences footer) ─────────────────────

function FirstFirePreview({
  partner,
  pickedSlugs,
  pickable,
}: {
  partner: string;
  pickedSlugs: string[];
  pickable: PickableSkill[];
}) {
  const bySlug = new Map(pickable.map((p) => [p.slug, p] as const));
  const visible = pickedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((p): p is PickableSkill => p !== undefined);
  return (
    <div className="mt-8 border border-ink bg-paper-deep p-5">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        next: first fire
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">
        When you save, {partner} runs each of these once. Results land on
        the next screen as they&rsquo;re ready — typically inside a few
        minutes.
      </p>
      {visible.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          No skills picked. You can pick from the marketplace any time,
          and the normal cron starts watching your workspace right after.
        </p>
      ) : (
        <ul className="mt-3 space-y-1 text-[14px] text-ink-soft">
          {visible.map((p) => (
            <li key={p.slug}>
              <span className="font-mono text-[12px] text-mute">·</span>{" "}
              <span className="text-ink">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── First-fire watch section (wave-9 step 5) ───────────────────────────────

async function FirstFireWatchSection({
  workspaceId,
  partner,
  pickedSlugs,
  pickable,
  requestedAt,
}: {
  workspaceId: string;
  partner: string;
  pickedSlugs: string[];
  pickable: PickableSkill[];
  requestedAt: Date | null;
}) {
  const bySlug = new Map(pickable.map((p) => [p.slug, p] as const));
  const initialPicked = pickedSlugs.map((slug) => {
    const entry = bySlug.get(slug);
    return {
      slug,
      name: entry?.name ?? slug.replace(/-/g, " "),
      status: "pending" as const,
    };
  });
  return (
    <div className="space-y-4">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        {partner}&rsquo;s fetching that for you. Each card below updates
        as the first fire lands. You can leave this screen and open the
        workspace whenever you&rsquo;re ready — the fleet keeps running
        on its normal cadence either way.
      </p>
      <FirstFireWatch
        workspaceId={workspaceId}
        initial={{
          picked: initialPicked,
          resolved: pickedSlugs.length === 0,
          requestedAt: requestedAt ? requestedAt.toISOString() : null,
        }}
      />
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
