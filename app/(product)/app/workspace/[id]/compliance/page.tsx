import {
  ApEyebrow,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";

interface PageProps {
  params: Promise<{ id: string }>;
}

const SEVERITY_ORDER = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "INFO"];

export default async function CompliancePage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const flags = await withRls(ctx, (tx) =>
    tx.complianceFlag.findMany({
      where: { workspaceId, state: "OPEN" },
      orderBy: [{ severity: "desc" }, { slaDueAt: "asc" }],
      take: 50,
    }),
  );

  // SLA-aware ordering at app layer (DB sort is stable but enum order != severity order).
  flags.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      (a.slaDueAt?.getTime() ?? Infinity) - (b.slaDueAt?.getTime() ?? Infinity),
  );

  const partner = servicePartnerForWorkspace(workspaceId);

  return (
    <div>
      <ApEyebrow className="mb-3">compliance</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        {flags.length === 0
          ? "Nothing flagged for review."
          : `${flags.length} open flag${flags.length === 1 ? "" : "s"}.`}
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Compliance Sentinel raises flags on customer-facing drafts before
        they leave your brokerage. Triage them in order of severity and
        SLA — your broker-of-record review still gates every send.
      </p>

      {flags.length === 0 ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="plow"
            reality={`Nothing flagged. ${partner} is reading every draft before it goes out.`}
            change="New flags surface here the moment Sentinel catches one. Severity ordered, SLA tracked."
          />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-rule border border-rule bg-paper">
          {flags.map((f) => (
            <li key={f.id} className="p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {f.severity} · {f.rule}
                  </p>
                  <p className="mt-1 text-[15px] text-ink">{f.claim}</p>
                </div>
                <span className="font-mono text-[11px] uppercase text-mute shrink-0">
                  {f.slaDueAt
                    ? `due ${new Date(f.slaDueAt).toLocaleString()}`
                    : "no SLA"}
                </span>
              </div>
              {f.suggestedRewrite ? (
                <p className="mt-3 border-l-2 border-rule bg-paper-deep p-3 text-[14px] leading-relaxed text-ink-soft">
                  {f.suggestedRewrite}
                </p>
              ) : null}
              <p className="mt-3 text-[13px] text-mute">
                Source: {f.sourceRecordTable}:{f.sourceRecordId} · raised by{" "}
                <span className="font-mono">{f.raisedByAgent}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
