import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
} from "@/components/ui/ap";
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
      <ApEyebrow className="mb-3">settings · work thresholds</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Decide what needs your eyes.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        One knob per work kind: the minimum severity that requires your
        explicit approval. Items below threshold flow through
        automatically. Per-action allowlists land in the next release.
      </p>

      <ul className="mt-8 space-y-4">
        {KINDS.map((k) => {
          const current = byKind.get(k.kind);
          const currentSeverity = current?.requiresApprovalAboveSeverity ?? "NONE";
          const fieldId = `threshold-${k.kind.toLowerCase()}`;
          return (
            <li key={k.kind}>
              <ApPaperCard
                eyebrow={k.kind}
                title={k.label}
              >
                <p className="text-[14px] leading-relaxed text-ink-soft">
                  {k.description}
                </p>
                <form
                  action={saveThresholdAction}
                  className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="kind" value={k.kind} />
                  <label htmlFor={fieldId} className="flex flex-col gap-1 text-sm">
                    <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      approve when severity ≥
                    </span>
                    <select
                      id={fieldId}
                      name="severity"
                      defaultValue={currentSeverity}
                      className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ApHeritageButton variant="secondary" type="submit">
                    save
                  </ApHeritageButton>
                </form>
              </ApPaperCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
