import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApPaperCard,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { buildWorkspaceStorageSummary } from "@/lib/storage/workspace-storage-summary";
import type { CategoryStorageSummary } from "@/lib/storage/workspace-storage-summary";
import { readStorageAuditTrail } from "@/lib/storage/audit";
import type { DataCategoryClassification } from "@/lib/storage/data-categories";
import { purgeCategoryAction, saveChatRetentionAction } from "./actions";

// Customer-visible "exactly what we store about you" surface. Two clear
// stories, the way Conner framed it:
//   1. "What Plaino has learned about your business" — kept for the life of
//      your account so he gets better; exportable; deleted on close.
//   2. "What we don't keep" — your connected tools' raw data, read in-flight
//      and never copied.
// Plus the account essentials (auth, billing, support) and a live, row-by-row
// count so the commitment is inspectable, not just asserted.

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

const CLASSIFICATION_LABEL: Record<DataCategoryClassification, string> = {
  "partner-memory": "kept while active · yours · deleted on close",
  necessary: "needed to run your account",
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

  const partnerMemory = summary.categories.filter(
    (c) => c.classification === "partner-memory",
  );
  const ephemeral = summary.categories.filter(
    (c) => c.classification === "ephemeral",
  );
  const necessary = summary.categories.filter(
    (c) => c.classification === "necessary",
  );

  const autoPurgeOptions = [30, 90, 180, 365];

  return (
    <div className="space-y-12">
      <header>
        <ApEyebrow className="mb-3">what we store</ApEyebrow>
        <h1 className="font-display text-3xl text-ink">
          Plaino remembers how your business works. He doesn&rsquo;t keep copies
          of your raw data.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          He keeps what he&rsquo;s learned about you — so he&rsquo;s a real
          partner that gets better over time. That lives here, it&rsquo;s yours,
          you can export it any time, and it&rsquo;s deleted when you close the
          account. The raw data inside your connected tools is read in-flight
          and never copied. This page is the live, row-by-row truth of both.
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
            export everything (JSON)
          </a>
        </p>
      </header>

      {/* 1 — What Plaino has learned (the headline) */}
      <section className="space-y-6">
        <div>
          <ApEyebrow>what Plaino has learned about your business</ApEyebrow>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-mute">
            Kept for the life of your account so Plaino keeps getting better.
            Yours to export any time; hard-deleted when you close the account.
          </p>
        </div>

        {/* Retention control lives with conversations */}
        <ApPaperCard title="How long Plaino keeps your chat history.">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            By default Plaino keeps your conversations for the{" "}
            <strong>life of your account</strong> — forgetting them would make
            him a worse partner. If you&rsquo;d rather we auto-purge older chats,
            you can opt into a window below. (Your learned preferences and memory
            are unaffected — only the raw chat threads.)
          </p>
          <form
            action={saveChatRetentionAction}
            className="mt-5 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                chat retention
              </span>
              <select
                name="retentionDays"
                defaultValue={
                  summary.retention.customerOverrideDays === null
                    ? "lifetime"
                    : String(summary.retention.customerOverrideDays)
                }
                className="rounded-none border border-ink bg-paper px-3 py-2 font-sans text-sm text-ink"
              >
                <option value="lifetime">
                  keep for the life of my account (recommended)
                </option>
                {autoPurgeOptions.map((d) => (
                  <option key={d} value={String(d)}>
                    auto-purge after {d} days
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
            In effect now:{" "}
            <strong>
              {summary.retention.effectiveDays === null
                ? "kept for the life of your account"
                : `auto-purge after ${summary.retention.effectiveDays} days`}
            </strong>
            .
          </p>
        </ApPaperCard>

        {partnerMemory.map((cat) => (
          <CategoryCard key={cat.id} cat={cat} workspaceId={workspaceId} />
        ))}
      </section>

      {/* 2 — What we don't keep (pass-through) */}
      <section className="space-y-6">
        <ApEyebrow>what we don&rsquo;t keep</ApEyebrow>
        {ephemeral.map((cat) => (
          <ApPaperCard key={cat.id} title={cat.label}>
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-clay">
              {CLASSIFICATION_LABEL[cat.classification]}
            </span>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
              {cat.detail}
            </p>
            <p className="mt-3 font-mono text-[12px] uppercase tracking-eyebrow text-clay">
              {summary.ephemeralFetchCount} pass-through{" "}
              {summary.ephemeralFetchCount === 1 ? "read" : "reads"} logged — 0
              stored
            </p>
          </ApPaperCard>
        ))}
      </section>

      {/* 3 — Account essentials */}
      <section className="space-y-6">
        <ApEyebrow>needed to run your account</ApEyebrow>
        {necessary.map((cat) => (
          <CategoryCard key={cat.id} cat={cat} workspaceId={workspaceId} />
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

function CategoryCard({
  cat,
  workspaceId,
}: {
  cat: CategoryStorageSummary;
  workspaceId: string;
}) {
  return (
    <ApPaperCard
      title={cat.label}
      footer={
        cat.customerDeletable ? (
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
        <span className="font-mono text-[11px] text-mute">
          {cat.totalRows} {cat.totalRows === 1 ? "row" : "rows"}
        </span>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{cat.detail}</p>
      {cat.tables.length > 0 ? (
        <ApHairlineList className="mt-4">
          {cat.tables.map((t) => (
            <ApHairlineRow key={t.table} right={String(t.count)}>
              <span className="font-mono text-[11px] text-mute">{t.table}</span>
            </ApHairlineRow>
          ))}
        </ApHairlineList>
      ) : null}
    </ApPaperCard>
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
          type &ldquo;delete&rdquo; to clear this
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
        clear {label.toLowerCase()}
      </button>
    </form>
  );
}
