import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  listWorkspaceFeedbackSince,
  summarizeWorkspaceWeek,
  type WorkspaceFeedbackWeekSummary,
} from "@/lib/feedback";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { decrypt } from "@/lib/security/encryption";
import type { TopPendingAction } from "@/lib/skills/briefing-generator/types";
import {
  muteBriefingsAction,
  decideTopApprovalFromBriefingAction,
} from "./actions";

const FEEDBACK_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Lever copy mirrors lib/feedback/drift#buildProposalBody, phrased for
 *  the customer instead of the operator. */
const LEVER_COPY: Record<string, string> = {
  tone: "tightening how it sounds",
  structure: "reshaping how it's laid out",
  factual: "adding a fact-check pass before drafts reach you",
  length: "tuning the length",
  other: "a closer look",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

// Wave-2 briefings page. Reads `WorkspaceBriefing` rows written by the
// daily generator cron (`lib/inngest/functions/briefings-generator-sweep`).
// Pre-pivot the page read from a Notion provider with no generator
// upstream — the empty-state copy promised "9am ET each workday" but
// nothing ever populated the list (audit §8 #5, 2026-05-28).
//
// Per `project_no_outbound_architecture.md`: nothing here mutates
// customer-facing state. The mute button toggles
// `WorkspacePreference.briefingsMutedAt`; the generator cron honors it.
export default async function BriefingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [briefings, pref] = await withRls(ctx, async (tx) => {
    const rows = await tx.workspaceBriefing.findMany({
      where: { workspaceId },
      orderBy: { generatedAt: "desc" },
      take: 14,
      select: {
        id: true,
        forDate: true,
        body: true,
        summary: true,
        status: true,
        generatedAt: true,
      },
    });
    const preference = await tx.workspacePreference.findUnique({
      where: { workspaceId },
      select: { briefingsMutedAt: true },
    });
    return [rows, preference] as const;
  });

  const feedbackThisWeek = await listWorkspaceFeedbackSince(
    ctx,
    workspaceId,
    new Date(Date.now() - FEEDBACK_WEEK_MS),
  );
  const feedbackSummary = summarizeWorkspaceWeek(feedbackThisWeek);

  const partner = servicePartnerForWorkspace(workspaceId);
  const muted = pref?.briefingsMutedAt != null;

  const decrypted = briefings.map((b) => ({
    id: b.id,
    forDate: b.forDate,
    body: safeDecrypt(b.body),
    summary: (b.summary as Record<string, unknown>) ?? {},
    status: b.status,
    generatedAt: b.generatedAt.toISOString(),
  }));

  // Wave-5 (theme #7 / ratif #9): pull the top pending action off the most
  // recent briefing's summary, then VERIFY it is still PENDING (the
  // customer may have decided it on /approvals since the briefing was
  // written). Only a still-pending action renders the one-tap card.
  const stagedFromLatest = readStagedAction(decrypted[0]?.summary);
  const stagedAction =
    stagedFromLatest &&
    (await withRls(ctx, async (tx) => {
      const item = await tx.workApprovalQueueItem.findFirst({
        where: {
          id: stagedFromLatest.itemId,
          workspaceId,
          status: "PENDING",
        },
        select: { id: true },
      });
      return item ? stagedFromLatest : null;
    }));

  return (
    <div>
      <ApEyebrow className="mb-3">briefings</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Two weeks of mornings.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Your chief-of-staff agent files one briefing per workday at
        about 9 ET. Read them here — never bounce to another tool.
      </p>

      {/* Mute / unmute control */}
      <form action={muteBriefingsAction} className="mt-6">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input
          type="hidden"
          name="desired"
          value={muted ? "unmute" : "mute"}
        />
        <ApHeritageButton variant="ghost" type="submit">
          {muted
            ? "turn briefings back on"
            : "mute briefings (you can turn them back on later)"}
        </ApHeritageButton>
      </form>

      {stagedAction ? (
        <StagedActionCard
          workspaceId={workspaceId}
          action={stagedAction}
          partner={partner}
        />
      ) : null}

      <FeedbackLoopSection summary={feedbackSummary} partner={partner} />

      {muted ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="big-sky"
            reality={`Briefings are muted. ${partner} won't email you the morning summary until you turn them back on.`}
            change="Existing briefings stay below for reference; new ones won't generate until you unmute."
          />
        </div>
      ) : null}

      {decrypted.length === 0 ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="big-sky"
            reality={`No briefings filed yet. ${partner} writes the first one tomorrow morning around 9 ET.`}
            change="Briefings land daily Mon–Fri once your fleet has read enough to have something to say."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {decrypted.map((b) => (
            <li key={b.id}>
              <ApPaperCard
                title={
                  b.status.startsWith("WEEKLY")
                    ? `Week of ${b.forDate} · what Plaino did for you`
                    : b.forDate
                }
                eyebrow={
                  <>
                    {new Date(b.generatedAt).toLocaleDateString()}
                    {b.status === "EMPTY"
                      ? " · quiet day"
                      : b.status === "WEEKLY_READY"
                        ? " · weekly proof-of-value digest"
                        : b.status === "WEEKLY_EMPTY"
                          ? " · weekly digest · quiet week"
                          : ""}
                  </>
                }
              >
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">
                  {b.body || "(briefing body unavailable)"}
                </p>
              </ApPaperCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * "What we learned from your feedback this week" — the customer-facing end
 * of the closed loop. Surfaces the corrections the customer left on
 * /approvals this week and what the fleet is weighing in response. Derived
 * entirely from the workspace's own PreferenceFeedback rows (no
 * operator-only CapabilityProposal read), so it renders under the
 * customer's RLS context. Renders nothing on a zero-feedback week to keep
 * the page quiet.
 */
function FeedbackLoopSection({
  summary,
  partner,
}: {
  summary: WorkspaceFeedbackWeekSummary;
  partner: string;
}) {
  if (summary.totalCorrections === 0) return null;

  const categoryLine = summary.byCategory
    .map((c) => `${c.category} ×${c.count}`)
    .join(" · ");

  return (
    <section className="mt-8">
      <ApPaperCard
        eyebrow="what we learned from your feedback this week"
        title={`${summary.totalCorrections} correction${
          summary.totalCorrections === 1 ? "" : "s"
        } noted`}
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          You flagged{" "}
          <span className="text-ink">{summary.totalCorrections}</span>{" "}
          draft{summary.totalCorrections === 1 ? "" : "s"} this week
          {categoryLine ? (
            <>
              {" "}
              — <span className="text-ink">{categoryLine}</span>
            </>
          ) : null}
          . {partner} already folded each one into the next draft.
        </p>

        {summary.considering.length > 0 ? (
          <div className="mt-4 border-t border-rule pt-4">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              what we&rsquo;re considering
            </p>
            <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-ink-soft">
              {summary.considering.map((g) => (
                <li key={`${g.targetSkillSlug}-${g.category}`}>
                  <span className="font-mono text-[13px] text-ink">
                    {g.targetSkillSlug}
                  </span>{" "}
                  was corrected {g.count}× for {g.category} — we&rsquo;re
                  weighing {LEVER_COPY[g.category] ?? "a change"} in our weekly
                  review.
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 border-t border-rule pt-4 text-[13px] leading-relaxed text-mute">
            Nothing crossed the threshold to change a skill this week — we keep
            watching, and every correction still shapes your next draft.
          </p>
        )}
      </ApPaperCard>
    </section>
  );
}

/**
 * Wave-5 one-tap action card (theme #7 / ratif #9). Renders the top pending
 * approval pre-staged on the latest briefing with a one-tap Approve and a
 * Review-on-/approvals escape hatch. Both submit forms — Approve drives the
 * SHARED `decideApproval` core via the server action; Review links out. No
 * draft body is shown here (the briefing surface stays redacted); the
 * customer can Review for the full draft before approving if they want.
 */
function StagedActionCard({
  workspaceId,
  action,
  partner,
}: {
  workspaceId: string;
  action: TopPendingAction;
  partner: string;
}) {
  return (
    <section className="mt-8">
      <ApPaperCard
        eyebrow="one tap from done"
        title={action.title}
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          {partner} pre-staged your top pending approval here so you can clear
          it without leaving this page.{" "}
          <span className="font-mono text-[12px] text-mute">
            {action.kind.toLowerCase().replace(/_/g, " ")}
          </span>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <form action={decideTopApprovalFromBriefingAction}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="itemId" value={action.itemId} />
            <input type="hidden" name="decision" value="APPROVED" />
            <ApHeritageButton type="submit">approve</ApHeritageButton>
          </form>
          <a
            href={`/app/workspace/${workspaceId}/approvals`}
            className="font-mono text-[12px] tracking-eyebrow uppercase text-ink-soft underline-offset-4 hover:underline"
          >
            review on approvals →
          </a>
        </div>
      </ApPaperCard>
    </section>
  );
}

/**
 * Read the pre-staged top pending action off a persisted briefing summary
 * JSON. Defensive: the column is `Json`, so we narrow each field before
 * trusting it. Returns null when absent / malformed.
 */
function readStagedAction(
  summary: Record<string, unknown> | undefined,
): TopPendingAction | null {
  if (!summary) return null;
  const raw = summary.topPendingAction;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const itemId = typeof obj.itemId === "string" ? obj.itemId : null;
  const kind = typeof obj.kind === "string" ? obj.kind : null;
  const title = typeof obj.title === "string" ? obj.title : null;
  if (!itemId || !kind || !title) return null;
  return {
    itemId,
    kind,
    title,
    agentSlug: typeof obj.agentSlug === "string" ? obj.agentSlug : null,
  };
}

/**
 * Decrypts the briefing body. If the value is malformed (key rotation
 * failure, mis-encrypted row), surface a flag-string instead of
 * throwing — the briefings page is page-level and a render-time throw
 * would 500 the whole route.
 */
function safeDecrypt(ciphertext: string): string {
  try {
    return decrypt(ciphertext);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return `(briefing body could not be decrypted: ${reason})`;
  }
}
