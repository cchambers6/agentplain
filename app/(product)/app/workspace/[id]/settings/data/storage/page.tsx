import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApPaperCard,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { buildWorkspaceStorageSummary } from "@/lib/storage/workspace-storage-summary";
import { readStorageAuditTrail } from "@/lib/storage/audit";
import { DEFAULT_RETENTION_DAYS } from "@/lib/plaino/chat-retention";
import type { DataCategoryClassification } from "@/lib/storage/data-categories";
import { purgeCategoryAction, saveChatRetentionAction } from "./actions";

// Customer-visible "exactly what we store about you" surface. Renders the
// LIVE per-category row counts for THIS workspace, the chat-retention window
// in effect, proof of the pass-through (reads that stored nothing), and a
// per-category one-tap delete. The data-minimization commitment, made
// inspectable — not just asserted in copy.

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

const CLASSIFICATION_LABEL: Record<DataCategoryClassification, string> = {
  necessary: "necessary",
  retention: "your retention setting",
  audit: "audit record",
  "opt-in": "your choice",
  ephemeral: "never stored",
};

export default async function StorageSurfacePage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [summary, trail] = await Promise.all([
    buildWorkspaceStorageSummary({ ctx, workspaceId }),
    readStorageAuditTrail(ctx, workspaceId, { limit: 25 }),
  ]);

  const retentionOptions = [1, 2, 7, 14, 30, 60, 90, 180, 365].filter(
    (d) => d <= summary.retention.tierMaxDays,
  );

  return (
    <div className="space-y-12">
      <header>
        <ApEyebrow className="mb-3">what we store</ApEyebrow>
        <h1 className="font-display text-3xl text-ink">
          Exactly what we hold about you. Nothing else.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          agentplain is a service layer, not a data warehouse. This page is the
          live, row-by-row truth of what is in our database for this workspace
          — grouped by why we keep it. The data inside the systems you connect
          (your inbox, your CRM) never lands here; we read it in-flight and
          give it back.
        </p>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-mute">
          <Link
            href={`/app/workspace/${workspaceId}/settings/data`}
            className="underline-offset-2 hover:underline"
          >
            ← back to your data
          </Link>
          {"  ·  "}
          <a
            href={`/api/workspaces/${workspaceId}/export`}
            download
            className="underline-offset-2 hover:underline"
          >
            download a full copy (JSON)
          </a>
        </p>
      </header>

      {/* Pass-through proof */}
      <section>
        <ApEyebrow className="mb-3">connector data — pass-through</ApEyebrow>
        <ApPaperCard title="We read your connected systems in-flight and store none of it.">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            When Plaino needs an email, a deal, or a contact, it fetches it with
            your token, does the work in memory, drafts a result for your
            approval, and discards the source. The canonical copy stays in your
            system.
          </p>
          <p className="mt-3 font-mono text-[12px] uppercase tracking-eyebrow text-clay">
            {summary.ephemeralFetchCount} pass-through{" "}
            {summary.ephemeralFetchCount === 1 ? "read" : "reads"} logged — 0 stored
          </p>
        </ApPaperCard>
      </section>

      {/* Chat retention control */}
      <section>
        <ApEyebrow className="mb-3">conversation retention</ApEyebrow>
        <ApPaperCard title="How long Plaino keeps your chat history.">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            By default we keep your conversations with Plaino for{" "}
            <strong>{DEFAULT_RETENTION_DAYS} days</strong>, then a daily sweep
            deletes them. You can keep more if you want Plaino to hold longer
            context — your call, up to {summary.retention.tierMaxDays} days on
            your plan.
          </p>
          <form
            action={saveChatRetentionAction}
            className="mt-5 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                retention window
              </span>
              <select
                name="retentionDays"
                defaultValue={
                  summary.retention.customerOverrideDays === null
                    ? "default"
                    : String(summary.retention.customerOverrideDays)
                }
                className="rounded-none border border-ink bg-paper px-3 py-2 font-sans text-sm text-ink"
              >
                <option value="default">
                  default ({DEFAULT_RETENTION_DAYS} days)
                </option>
                {retentionOptions.map((d) => (
                  <option key={d} value={String(d)}>
                    {d} {d === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-none border border-ink bg-ink px-5 py-2 font-sans text-sm font-medium text-paper transition hover:bg-ink-soft"
            >
              save
            </button>
          </form>
          <p className="mt-3 text-[12px] leading-relaxed text-mute">
            In effect now: <strong>{summary.retention.effectiveDays} days</strong>
            {summary.retention.customerOverrideDays === null
              ? " (default)"
              : " (your setting)"}
            .
          </p>
        </ApPaperCard>
      </section>

      {/* Per-category live inventory */}
      <section className="space-y-6">
        <ApEyebrow>your stored data, by category</ApEyebrow>
        {summary.categories.map((cat) => (
          <ApPaperCard
            key={cat.id}
            title={cat.label}
            footer={
              cat.classification !== "ephemeral" && cat.customerDeletable ? (
                <DeleteCategoryForm
                  workspaceId={workspaceId}
                  categoryId={cat.id}
                  label={cat.label}
                />
              ) : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-clay">
                {CLASSIFICATION_LABEL[cat.classification]}
              </span>
              {cat.classification !== "ephemeral" ? (
                <span className="font-mono text-[11px] text-mute">
                  {cat.totalRows} {cat.totalRows === 1 ? "row" : "rows"}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
              {cat.detail}
            </p>
            {cat.classification !== "ephemeral" && cat.tables.length > 0 ? (
              <ApHairlineList className="mt-4">
                {cat.tables.map((t) => (
                  <ApHairlineRow key={t.table} right={String(t.count)}>
                    <span className="font-mono text-[11px] text-mute">
                      {t.table}
                    </span>
                  </ApHairlineRow>
                ))}
              </ApHairlineList>
            ) : null}
          </ApPaperCard>
        ))}
      </section>

      {/* Storage activity trail */}
      <section>
        <ApEyebrow className="mb-3">recent storage activity</ApEyebrow>
        <ApPaperCard title="When we wrote — or read without storing.">
          {trail.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-mute">
              No storage-transparency events recorded yet. They appear here as
              your fleet works.
            </p>
          ) : (
            <ApHairlineList>
              {trail.map((entry) => (
                <ApHairlineRow
                  key={entry.id}
                  right={new Date(entry.occurredAt).toLocaleString()}
                >
                  <span className="font-mono text-[11px] text-mute">
                    {entry.kind === "ephemeral_fetch"
                      ? `read ${String(entry.payload.itemCount ?? "")} from ${String(
                          entry.payload.provider ?? "connector",
                        )} — not stored`
                      : `wrote ${entry.model ?? "record"} (${String(
                          entry.payload.operation ?? "",
                        )})`}
                  </span>
                </ApHairlineRow>
              ))}
            </ApHairlineList>
          )}
        </ApPaperCard>
      </section>
    </div>
  );
}

function DeleteCategoryForm({
  workspaceId,
  categoryId,
  label,
}: {
  workspaceId: string;
  categoryId: string;
  label: string;
}) {
  return (
    <form action={purgeCategoryAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="category" value={categoryId} />
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
          type &ldquo;delete&rdquo; to clear {label.toLowerCase()}
        </span>
        <input
          name="confirm"
          autoComplete="off"
          placeholder="delete"
          className="rounded-none border border-ink bg-paper px-3 py-2 font-sans text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-none border border-clay px-5 py-2 font-sans text-sm font-medium text-clay transition hover:bg-clay hover:text-paper"
      >
        delete this category
      </button>
    </form>
  );
}
