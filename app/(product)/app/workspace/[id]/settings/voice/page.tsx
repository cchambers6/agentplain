import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import {
  listWorkspaceTemplates,
  type WorkspaceTemplate,
} from "@/lib/customer-files";
import { getWorkspacePreference, DRAFTING_TONES } from "@/lib/preferences";
import { renderApprovalPayload } from "../../approvals/renderApprovalPayload";
import { saveDraftingToneAction, saveVoiceCorrectionAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

const TONE_LABELS: Record<string, string> = {
  plain: "Plain — clear and unfussy",
  "warm-professional": "Warm-professional — friendly but buttoned-up",
  formal: "Formal — precise and reserved",
};

/** Approval kinds that carry a customer-facing draft body — these are
 *  what we surface as a "sample draft in your voice". */
const DRAFT_KINDS = new Set<string>([
  "BUYER_INQUIRY_REPLY_DRAFT",
  "CHIEF_OF_STAFF_REPLY_DRAFT",
  "FOLLOW_UP_NUDGE",
  "INBOX_TRIAGE",
  "SUPPORT_HANDLER_REPLY_DRAFT",
  "LEAD_TRIAGE",
  "PLAINO_INSTRUCTION",
]);

export default async function VoiceSettingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);

  const [prefs, templates] = await Promise.all([
    getWorkspacePreference(ctx, workspaceId),
    listWorkspaceTemplates(ctx, workspaceId),
  ]);

  // Most-recent draft-bearing approval item → a real sample of the voice.
  const recentItems = await withRls(ctx, (tx) =>
    tx.workApprovalQueueItem.findMany({
      where: { workspaceId },
      orderBy: { proposedAt: "desc" },
      take: 25,
    }),
  );
  const sample = pickSampleDraft(recentItems);

  const tone = prefs?.draftingTone ?? null;
  const learnedNotes = prefs?.learnedDraftNotes ?? [];
  const templateCount = templates.length;

  return (
    <div>
      <ApEyebrow className="mb-3">settings · voice &amp; templates</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Drafts that sound like you.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Point {partner} at your own templates, past replies, and playbooks
        and the fleet writes in your voice — not generic boilerplate. This
        is what {partner} has learned so far, and where you can correct it.
      </p>

      {/* ── Voice fingerprint ─────────────────────────────────────── */}
      <section className="mt-8">
        <ApEyebrow className="mb-3">your voice fingerprint</ApEyebrow>
        <ApPaperCard eyebrow="default tone" title={toneTitle(tone)}>
          <form
            action={saveDraftingToneAction}
            className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <label
              htmlFor="voice-tone"
              className="flex flex-col gap-1 text-sm"
            >
              <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                how your fleet should sound
              </span>
              <select
                id="voice-tone"
                name="draftingTone"
                defaultValue={tone ?? "warm-professional"}
                className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                {DRAFTING_TONES.map((t) => (
                  <option key={t} value={t}>
                    {TONE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </label>
            <ApHeritageButton variant="secondary" type="submit">
              save tone
            </ApHeritageButton>
          </form>

          <div className="mt-6 border-t border-rule pt-5">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              learned from your corrections ({learnedNotes.length})
            </p>
            {learnedNotes.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {learnedNotes.map((note, i) => (
                  <li
                    key={`${i}-${note.slice(0, 24)}`}
                    className="text-[14px] leading-relaxed text-ink-soft"
                  >
                    — {note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[14px] leading-relaxed text-mute">
                Nothing yet. Each time you edit or reject a draft, {partner}
                notes what changed and reflects it on the next one.
              </p>
            )}
          </div>
        </ApPaperCard>
      </section>

      {/* ── Ingested templates ────────────────────────────────────── */}
      <section className="mt-10">
        <ApEyebrow className="mb-3">
          your templates ({templateCount})
        </ApEyebrow>
        {templateCount > 0 ? (
          <ul className="space-y-3">
            {templates.map((t) => (
              <li key={t.fileId}>
                <TemplateRow template={t} />
              </li>
            ))}
          </ul>
        ) : (
          <ApRootedEmptyState
            motif="lone-tree"
            reality="No templates ingested yet."
            change={`Connect Google Drive and ${partner} reads your templates, past replies, and playbooks within a minute — then drafts start matching your voice.`}
            cta={
              <ApHeritageButton
                variant="secondary"
                withArrow
                href={`/app/workspace/${workspaceId}/integrations`}
              >
                connect a source
              </ApHeritageButton>
            }
          />
        )}
        {templateCount > 0 ? (
          <div className="mt-5">
            <ApHeritageButton
              variant="secondary"
              withArrow
              href={`/app/workspace/${workspaceId}/integrations`}
            >
              add more templates
            </ApHeritageButton>
            <p className="mt-2 text-[12px] leading-relaxed text-mute">
              Point a Drive folder at your best work — &ldquo;Templates&rdquo;,
              &ldquo;Past Listings&rdquo;, &ldquo;Playbooks&rdquo;. New files
              are read on connect and refreshed every few hours.
            </p>
          </div>
        ) : null}
      </section>

      {/* ── Sample draft preview ──────────────────────────────────── */}
      <section className="mt-10">
        <ApEyebrow className="mb-3">sample draft</ApEyebrow>
        {sample ? (
          <ApPaperCard
            eyebrow={sample.kindLabel}
            title="A recent draft in your voice"
          >
            {sample.recipientLine ? (
              <p className="mb-3 font-mono text-[12px] text-mute">
                {sample.recipientLine}
              </p>
            ) : null}
            <div className="space-y-3">
              {sample.body.map((para, i) => (
                <p
                  key={i}
                  className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink"
                >
                  {para}
                </p>
              ))}
            </div>
            {sample.metaLine ? (
              <p className="mt-4 border-t border-rule pt-3 font-mono text-[11px] text-mute">
                {sample.metaLine}
              </p>
            ) : null}
          </ApPaperCard>
        ) : (
          <p className="max-w-2xl text-[14px] leading-relaxed text-mute">
            Once {partner} drafts its first reply, a sample lands here so you
            can see how close the voice match is. Connect a source and an
            inbox to get the first one moving.
          </p>
        )}
      </section>

      {/* ── "This doesn't sound like me" feedback ─────────────────── */}
      <section className="mt-10">
        <ApEyebrow className="mb-3">correct the voice</ApEyebrow>
        <ApPaperCard
          eyebrow="this doesn't sound like me"
          title="Tell Plaino what's off"
        >
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Describe what doesn&rsquo;t fit — too stiff, too chatty, wrong
            sign-off, a phrase you&rsquo;d never use. {partner} folds it into
            the next draft and keeps it on file.
          </p>
          <form action={saveVoiceCorrectionAction} className="mt-4">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <label htmlFor="voice-note" className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                what to change
              </span>
              <textarea
                id="voice-note"
                name="note"
                rows={3}
                maxLength={2000}
                placeholder="e.g. Drop the “I hope this finds you well.” I always open with the buyer's first name."
                className="border border-rule bg-paper px-3 py-2 text-[14px] leading-relaxed text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              />
            </label>
            <div className="mt-3">
              <ApHeritageButton variant="secondary" type="submit">
                save correction
              </ApHeritageButton>
            </div>
          </form>
        </ApPaperCard>
      </section>

      <p className="mt-10 border-t border-rule pt-6 max-w-2xl text-[13px] leading-relaxed text-mute">
        {partner} never sends anything. Everything it drafts in your voice
        waits for your yes on the approvals screen — your own system is what
        actually replies.
      </p>
    </div>
  );
}

function toneTitle(tone: string | null): string {
  if (!tone) return "Not set yet";
  return TONE_LABELS[tone] ?? tone;
}

interface SampleDraft {
  kindLabel: string;
  recipientLine?: string;
  body: string[];
  metaLine?: string;
}

/** Walk recent approval items newest-first and return the first one that
 *  carries a real draft body. Returns null when none do. */
function pickSampleDraft(
  items: Array<{ kind: string; payload: unknown }>,
): SampleDraft | null {
  for (const item of items) {
    if (!DRAFT_KINDS.has(item.kind)) continue;
    let rendered;
    try {
      rendered = renderApprovalPayload(
        item.kind as Parameters<typeof renderApprovalPayload>[0],
        decryptPayloadForRead(item.payload),
      );
    } catch {
      continue;
    }
    const hasBody =
      (rendered.editableBody && rendered.editableBody.trim().length > 0) ||
      rendered.body.some((b) => b.trim().length > 0);
    if (!hasBody) continue;
    return {
      kindLabel: rendered.kindLabel,
      recipientLine: rendered.recipientLine,
      body: rendered.body.length > 0 ? rendered.body : ["(empty draft)"],
      metaLine: rendered.metaLine,
    };
  }
  return null;
}

function TemplateRow({ template }: { template: WorkspaceTemplate }) {
  const meta = [
    template.category,
    `${template.chunkCount} chunk${template.chunkCount === 1 ? "" : "s"}`,
    template.source ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="border border-rule bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-base leading-tight text-ink">
          {template.sourceUrl ? (
            <a
              href={template.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-rule underline-offset-4 hover:decoration-ink"
            >
              {template.title}
            </a>
          ) : (
            template.title
          )}
        </p>
        <span className="shrink-0 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {template.category}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-mute">{meta}</p>
    </div>
  );
}
