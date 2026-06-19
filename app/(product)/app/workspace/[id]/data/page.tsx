import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApPaperCard,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { listMemoryAudit } from "@/lib/memory/audit";
import { regionForWorkspace } from "@/lib/memory/byo-storage";
import type { DataRegion, MemoryStorageProvider, MemoryTier } from "@prisma/client";

// "Where your data lives" — the data-residency + storage-location surface for
// the broker-owner. Read-mostly: it makes the isolation, tiering, residency,
// and customer-hosted-storage posture legible, and links to the existing
// export + closure controls. Switching to BYO storage is operator-assisted
// (credentials are added + probed out-of-band, then the migration script
// runs) — this page shows the current state and the steps, rather than
// faking an in-page credential form that doesn't exist yet.

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

const REGION_LABEL: Record<DataRegion, string> = {
  US_EAST: "US East (us-east-1)",
  US_WEST: "US West (us-west-2)",
  EU_WEST: "EU West — Ireland (eu-west-1)",
  AP_SOUTHEAST: "Asia Pacific — Singapore (ap-southeast-1)",
};

const STORAGE_LABEL: Record<MemoryStorageProvider, string> = {
  AGENTPLAIN: "agentplain-managed (Vercel Blob)",
  CUSTOMER: "your own bucket (customer-hosted)",
};

const TIER_LABEL: Record<MemoryTier, string> = {
  HOT: "Hot — last 7 days, instant",
  WARM: "Warm — 7–90 days, indexed",
  COLD: "Cold — 90+ days, archived",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="text-ink-soft">
      <span className="mr-2 text-mute">{label}</span>
      {children}
    </span>
  );
}

export default async function DataResidencyPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const workspace = await withRls(ctx, (tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        memoryStorage: true,
        dataRegion: true,
        storageConfig: {
          select: {
            endpoint: true,
            bucket: true,
            region: true,
            kmsProvider: true,
            verifiedAt: true,
            lastError: true,
          },
        },
      },
    }),
  );
  if (!workspace) return null;

  const tierCounts = await withRls(ctx, (tx) =>
    tx.workspaceMemoryEntry.groupBy({
      by: ["tier"],
      where: { workspaceId },
      _count: { _all: true },
    }),
  );
  const countFor = (tier: MemoryTier): number =>
    tierCounts.find((t) => t.tier === tier)?._count._all ?? 0;

  const recentAudit = await listMemoryAudit(ctx, workspaceId, { limit: 10 });

  const isCustomerHosted = workspace.memoryStorage === "CUSTOMER";
  const cfg = workspace.storageConfig;

  return (
    <div className="space-y-12">
      <header>
        <ApEyebrow className="mb-3">your data</ApEyebrow>
        <h1 className="font-display text-3xl text-ink">
          Where your data lives, and who has touched it.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Every workspace is isolated at the database level — Postgres
          row-level security drops another tenant&rsquo;s rows before a query
          ever sees them. Below is where {workspace.name}&rsquo;s memory
          physically lives, how it ages into cold storage, and a log of every
          read and write against it.
        </p>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-mute">
          <Link
            href={`/app/workspace/${workspaceId}/settings`}
            className="underline-offset-2 hover:underline"
          >
            ← back to settings
          </Link>
        </p>
      </header>

      {/* ─── Where it lives ─────────────────────────────────────────── */}
      <section>
        <ApEyebrow className="mb-3">residency</ApEyebrow>
        <ApPaperCard title="Where your data lives">
          <ApHairlineList aria-label="Data residency">
            <ApHairlineRow>
              <Field label="Data region">{REGION_LABEL[workspace.dataRegion]}</Field>
            </ApHairlineRow>
            <ApHairlineRow>
              <Field label="Memory storage">{STORAGE_LABEL[workspace.memoryStorage]}</Field>
            </ApHairlineRow>
            <ApHairlineRow>
              <Field label="Isolation">
                Postgres row-level security (enforced at the database, not just
                the app)
              </Field>
            </ApHairlineRow>
            <ApHairlineRow>
              <Field label="Encryption at rest">
                AES-256-GCM — memory bodies and credentials are ciphertext
                before they reach disk
              </Field>
            </ApHairlineRow>
          </ApHairlineList>
          <p className="mt-4 text-[13px] leading-relaxed text-mute">
            Your region commitment is{" "}
            <code className="text-ink-soft">
              {regionForWorkspace(workspace.dataRegion)}
            </code>
            . The customer-hosted option below gives the hardest residency
            guarantee — the bytes only ever land in a bucket you control.
          </p>
        </ApPaperCard>
      </section>

      {/* ─── Tiering ────────────────────────────────────────────────── */}
      <section>
        <ApEyebrow className="mb-3">memory tiering</ApEyebrow>
        <ApPaperCard title="How your memory ages, so it stays fast at scale">
          <ApHairlineList aria-label="Memory tiers">
            <ApHairlineRow right={`${countFor("HOT")} entries`}>
              <span className="text-ink-soft">{TIER_LABEL.HOT}</span>
            </ApHairlineRow>
            <ApHairlineRow right={`${countFor("WARM")} entries`}>
              <span className="text-ink-soft">{TIER_LABEL.WARM}</span>
            </ApHairlineRow>
            <ApHairlineRow right={`${countFor("COLD")} entries`}>
              <span className="text-ink-soft">{TIER_LABEL.COLD}</span>
            </ApHairlineRow>
          </ApHairlineList>
          <p className="mt-4 text-[13px] leading-relaxed text-mute">
            Hot and warm memory stays in the fast path. Cold memory (90+ days,
            unpinned) is archived to object storage and re-hydrated on demand —
            nothing is ever deleted by tiering. Pinned entries always stay hot.
          </p>
        </ApPaperCard>
      </section>

      {/* ─── Customer-hosted storage ────────────────────────────────── */}
      <section>
        <ApEyebrow className="mb-3">customer-hosted storage</ApEyebrow>
        <ApPaperCard
          title={
            isCustomerHosted
              ? "Your data is hosted in your own bucket"
              : "Host your data in your own infrastructure"
          }
        >
          {isCustomerHosted && cfg ? (
            <ApHairlineList aria-label="Customer storage config">
              <ApHairlineRow>
                <Field label="Endpoint">{cfg.endpoint}</Field>
              </ApHairlineRow>
              <ApHairlineRow>
                <Field label="Bucket">{cfg.bucket}</Field>
              </ApHairlineRow>
              <ApHairlineRow>
                <Field label="Region">{cfg.region}</Field>
              </ApHairlineRow>
              <ApHairlineRow>
                <Field label="Encryption keys">
                  {cfg.kmsProvider === "NONE"
                    ? "Bucket server-side encryption"
                    : `Customer-managed (${cfg.kmsProvider})`}
                </Field>
              </ApHairlineRow>
              <ApHairlineRow>
                <Field label="Status">
                  {cfg.verifiedAt
                    ? `Verified ${cfg.verifiedAt.toISOString().slice(0, 10)}`
                    : cfg.lastError
                      ? `Not verified — ${cfg.lastError}`
                      : "Pending verification"}
                </Field>
              </ApHairlineRow>
            </ApHairlineList>
          ) : (
            <>
              <p className="text-[14px] leading-relaxed text-ink-soft">
                On Partner and Max plans you can keep your cold-tier memory and
                archives in an S3-compatible bucket you own — AWS S3, Cloudflare
                R2, MinIO, or Wasabi. We write through your bucket; the keys
                never leave your control. Optionally bring your own KMS key
                (AWS KMS, GCP KMS, or a raw key we envelope-encrypt with).
              </p>
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-mute">
                <li>Create a bucket in the region you need.</li>
                <li>
                  Send your service partner the endpoint, bucket, region, and a
                  scoped access key (we store it encrypted, never in plaintext).
                </li>
                <li>
                  We run a connectivity + round-trip probe, then migrate your
                  existing cold data over and verify every object byte-for-byte
                  before switching you across.
                </li>
              </ol>
            </>
          )}
        </ApPaperCard>
      </section>

      {/* ─── Audit log ──────────────────────────────────────────────── */}
      <section>
        <ApEyebrow className="mb-3">memory access log</ApEyebrow>
        <ApPaperCard title="Every read and write against your memory">
          {recentAudit.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-ink-soft">
              No memory access recorded yet.
            </p>
          ) : (
            <ApHairlineList aria-label="Memory access log">
              {recentAudit.map((e) => (
                <ApHairlineRow
                  key={e.id}
                  right={e.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                >
                  <span className="text-ink-soft">
                    <span className="font-mono text-ink">{e.action}</span>
                    <span className="mx-2 text-mute">·</span>
                    {e.recordType}
                    <span className="mx-2 text-mute">·</span>
                    <span className="text-mute">
                      {e.actorType.toLowerCase()} ({e.actorId}) — {e.intent}
                    </span>
                  </span>
                </ApHairlineRow>
              ))}
            </ApHairlineList>
          )}
          <p className="mt-4 text-[13px] leading-relaxed text-mute">
            Showing the 10 most recent entries. The full trail is in your data
            export.
          </p>
        </ApPaperCard>
      </section>

      {/* ─── Export & deletion ──────────────────────────────────────── */}
      <section>
        <ApEyebrow className="mb-3">export &amp; deletion</ApEyebrow>
        <ApPaperCard title="Take it with you, or close the workspace">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Download a full JSON copy of everything in this workspace, or close
            the workspace to schedule a purge of everything we hold.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
            <a
              href={`/api/workspaces/${workspaceId}/export`}
              download
              className="text-ink underline-offset-2 hover:underline"
            >
              download export (json)
            </a>
            <Link
              href={`/app/workspace/${workspaceId}/settings/data`}
              className="text-ink underline-offset-2 hover:underline"
            >
              export &amp; close controls →
            </Link>
          </div>
        </ApPaperCard>
      </section>
    </div>
  );
}
