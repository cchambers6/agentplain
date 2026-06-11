import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls, withSystemContext } from "@/lib/db";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import { ApEyebrow, ApRootedEmptyState } from "@/components/ui/ap";
import { isBuildiumLive } from "@/lib/integrations/buildium-mcp";
import { RENT_COLLECTION_CHASE_AGENT_SLUG } from "@/lib/skills/property-management-rent-collection-chase";
import { SyncButton } from "./SyncButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

type Bucket = "grace" | "soft-chase" | "formal-notice" | "escalation";

interface ChasePayload {
  leaseId: string;
  bucket: Bucket;
  daysPastDue: number;
  outstandingBalanceUsd: number;
  subject: string;
}

function readChasePayload(raw: unknown): ChasePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const bucket = p.bucket;
  if (
    bucket !== "soft-chase" &&
    bucket !== "formal-notice" &&
    bucket !== "escalation" &&
    bucket !== "grace"
  ) {
    return null;
  }
  return {
    leaseId: typeof p.leaseId === "string" ? p.leaseId : "—",
    bucket,
    daysPastDue: typeof p.daysPastDue === "number" ? p.daysPastDue : 0,
    outstandingBalanceUsd:
      typeof p.outstandingBalanceUsd === "number" ? p.outstandingBalanceUsd : 0,
    subject: typeof p.subject === "string" ? p.subject : "",
  };
}

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const BUCKET_LABEL: Record<Bucket, string> = {
  grace: "Grace",
  "soft-chase": "Soft chase",
  "formal-notice": "Formal notice",
  escalation: "Escalation",
};

export default async function RentCollectionPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { vertical: true },
    }),
  );
  // Rent collection is a property-management workflow; other verticals have
  // no rent roll. Keep the surface honest rather than rendering an empty page.
  if (!workspace || workspace.vertical !== "PROPERTY_MANAGEMENT") notFound();

  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [credential, items] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.integrationCredential.findFirst({
        where: { workspaceId, provider: "BUILDIUM" },
        orderBy: { updatedAt: "desc" },
        select: { status: true, accountEmail: true },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.workApprovalQueueItem.findMany({
        where: { workspaceId, agentSlug: RENT_COLLECTION_CHASE_AGENT_SLUG },
        orderBy: { proposedAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          proposedAt: true,
          payload: true,
        },
      }),
    ),
  ]);

  const connected = credential !== null && credential.status === "ACTIVE";
  const live = isBuildiumLive();

  const decoded = items.map((it) => ({
    id: it.id,
    status: it.status,
    proposedAt: it.proposedAt,
    chase: readChasePayload(decryptPayloadForRead(it.payload)),
  }));

  const pending = decoded.filter((d) => d.status === "PENDING");
  const bucketCounts: Record<Bucket, number> = {
    grace: 0,
    "soft-chase": 0,
    "formal-notice": 0,
    escalation: 0,
  };
  let atRiskUsd = 0;
  for (const d of pending) {
    if (!d.chase) continue;
    bucketCounts[d.chase.bucket] += 1;
    atRiskUsd += d.chase.outstandingBalanceUsd;
  }
  const recent = decoded.slice(0, 8);
  const base = `/app/workspace/${workspaceId}`;

  return (
    <div>
      <ApEyebrow className="mb-3">rent collection</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">Rent collection autopilot.</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Every morning Plaino reads your Buildium rent roll, finds every
        delinquent unit, and drafts the right tenant chase for where it sits —
        friendly reminder, firmer notice, or escalation. Nothing sends on its
        own; each draft waits for your yes in{" "}
        <Link href={`${base}/approvals`} className="underline underline-offset-4 hover:text-ink">
          Approvals
        </Link>
        .
      </p>

      {/* Connection / configuration status */}
      {!connected ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="lone-tree"
            reality="Buildium isn't connected yet."
            change="Connect your Buildium account and Plaino starts reading the rent roll on the next nightly run."
            cta={
              <Link
                href={`${base}/integrations/buildium`}
                className="font-mono text-[12px] tracking-eyebrow uppercase text-ink underline underline-offset-4 hover:text-ink-soft"
              >
                connect buildium →
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 border border-moss/40 bg-moss/10 px-3 py-1 text-[12px] text-ink">
              <span aria-hidden>●</span> Buildium connected · {credential?.accountEmail}
            </span>
            {!live && (
              <span className="inline-flex items-center gap-2 border border-flag/40 bg-flag/5 px-3 py-1 text-[12px] text-ink">
                needs configuration — live sync turns on after your key is verified
              </span>
            )}
          </div>

          {/* Today's status — at-risk + bucket breakdown */}
          <div className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="unpaid rent at stake" value={USD.format(atRiskUsd)} emphasis />
            <Stat label="soft chases" value={String(bucketCounts["soft-chase"])} />
            <Stat label="formal notices" value={String(bucketCounts["formal-notice"])} />
            <Stat label="escalations" value={String(bucketCounts.escalation)} />
          </div>

          <div className="mt-6">
            <SyncButton workspaceId={workspaceId} />
          </div>

          {/* Action queue + recent activity */}
          <ApEyebrow className="mt-10 mb-3">recent chases</ApEyebrow>
          {recent.length === 0 ? (
            <p className="text-[14px] text-ink-soft">
              No chases drafted yet. They appear here after the nightly run (or
              tap “sync now”).
            </p>
          ) : (
            <ul className="divide-y divide-rule border border-rule">
              {recent.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 bg-paper p-4">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">
                      {d.chase?.subject || "Rent chase draft"}
                    </p>
                    <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      {d.chase ? BUCKET_LABEL[d.chase.bucket] : "—"}
                      {d.chase ? ` · ${d.chase.daysPastDue}d past due` : ""}
                      {d.chase && d.chase.outstandingBalanceUsd > 0
                        ? ` · ${USD.format(d.chase.outstandingBalanceUsd)}`
                        : ""}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {statusLabel(d.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-paper p-5">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">{label}</p>
      <p className={`mt-1 ${emphasis ? "font-display text-2xl" : "text-2xl"} text-ink`}>
        {value}
      </p>
    </div>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "PENDING":
      return "waiting on you";
    case "APPROVED":
      return "approved";
    case "DECLINED":
      return "declined";
    default:
      return s.toLowerCase();
  }
}
