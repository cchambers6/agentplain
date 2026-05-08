import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { saveThresholdAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const KINDS: Array<{
  kind: "COMPLIANCE_FLAG" | "LISTING_RECOMMENDATION" | "BUYER_INQUIRY_REPLY_DRAFT" | "PRICING_RECOMMENDATION";
  label: string;
  description: string;
}> = [
  {
    kind: "COMPLIANCE_FLAG",
    label: "Compliance flags",
    description:
      "Sentinel-raised flags on customer-facing drafts. Defaults to severity ≥ MEDIUM.",
  },
  {
    kind: "BUYER_INQUIRY_REPLY_DRAFT",
    label: "Buyer-inquiry reply drafts",
    description:
      "Drafts surfaced to your individual agents before they reply. Defaults to manual review.",
  },
  {
    kind: "LISTING_RECOMMENDATION",
    label: "Listing recommendations",
    description:
      "Per-listing suggestions (price drops, copy edits). Defaults to manual review.",
  },
  {
    kind: "PRICING_RECOMMENDATION",
    label: "Pricing recommendations",
    description:
      "Standalone pricing recommendations not tied to a single listing.",
  },
];

const SEVERITIES: Array<"INFO" | "LOW" | "MEDIUM" | "HIGH" | "BLOCKER" | "NONE"> = [
  "NONE",
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "BLOCKER",
];

export default async function WorkThresholdsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const existing = await withRls(ctx, (tx) =>
    tx.workThresholdConfig.findMany({ where: { workspaceId } }),
  );
  const byKind = new Map(existing.map((e) => [e.kind, e] as const));

  return (
    <div>
      <p className="eyebrow mb-3">Settings · work thresholds</p>
      <h1 className="font-display text-3xl text-ink">
        Decide what needs your eyes.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Phase 1 ships with one knob per work-execution kind: the minimum
        severity that requires your explicit approval. Items below threshold
        flow through automatically. Per-action allowlists land in Phase 2.
      </p>

      <ul className="mt-8 space-y-4">
        {KINDS.map((k) => {
          const current = byKind.get(k.kind);
          const currentSeverity = current?.requiresApprovalAboveSeverity ?? "NONE";
          return (
            <li key={k.kind} className="border border-rule bg-paper p-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                {k.kind}
              </p>
              <p className="mt-1 font-display text-xl text-ink">{k.label}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                {k.description}
              </p>
              <form action={saveThresholdAction} className="mt-4 flex flex-wrap items-center gap-3">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="kind" value={k.kind} />
                <label className="text-sm">
                  <span className="font-mono text-[11px] tracking-eyebrow uppercase text-slate">
                    Approve when severity ≥
                  </span>
                  <select
                    name="severity"
                    defaultValue={currentSeverity}
                    className="ml-3 border border-rule bg-paper px-2 py-1 text-[14px] text-ink"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn-primary">
                  Save
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
