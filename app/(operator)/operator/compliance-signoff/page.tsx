// /operator/compliance-signoff — pfd-5 counsel sign-off console.
//
// The single surface where an operator records that counsel has signed off on
// a vertical's compliance corpus — the durable act that lets rewrite-and-stage
// draft replacement legal text for that industry. Until a vertical is signed
// (AND env-permitted) Plaino flags compliance issues but withholds the rewrite.
//
// Shows, per compliance-corpus vertical:
//   - corpus presence + counsel-review metadata
//   - env kill-switch state (COMPLIANCE_CORPUS_COUNSEL_REVIEWED)
//   - durable sign-off state (signed / unsigned / revoked / future-dated)
//   - the resolved GATE answer (live vs gated, with the reason)
//   - upload-ref + sign-off form, and a revoke action
//
// Per project_no_outbound_architecture: nothing here sends.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import {
  listCorpusVerticals,
  loadCorpusFor,
  PrismaCounselSignoffStore,
  evaluateCounselGate,
  envPermitsVertical,
  isKnownCorpusVertical,
  type CounselGateResult,
  type CounselSignoff,
} from "@/lib/agents/sentinel";
import { recordSignoffAction, revokeSignoffAction } from "./actions";
import { SignoffForm, RevokeButton } from "./signoff-controls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function reasonLabel(r: CounselGateResult["reason"]): string {
  switch (r) {
    case "live":
      return "LIVE — rewrites flow";
    case "env-killed":
      return "GATED — env kill-switch off for this vertical";
    case "no-signoff-row":
      return "GATED — no counsel sign-off on record";
    case "not-signed":
      return "GATED — row present but never signed";
    case "revoked":
      return "GATED — sign-off revoked";
    case "future-dated":
      return "GATED — sign-off is future-dated";
    case "store-error":
      return "GATED — sign-off store unreachable (fail-closed)";
    case "unknown-vertical":
      return "GATED — unknown vertical";
    default:
      return "GATED";
  }
}

export default async function ComplianceSignoffPage() {
  const session = await requireUser();
  if (!session.isOperator) redirect("/app");

  const store = new PrismaCounselSignoffStore();
  const verticals = listCorpusVerticals();

  // Resolve each vertical's gate + sign-off row for display. Reads are
  // operator-context under RLS.
  const rows = await Promise.all(
    verticals.map(async (verticalSlug) => {
      let signoff: CounselSignoff | null = null;
      let gate: CounselGateResult = { live: false, reason: "store-error" };
      try {
        signoff = await store.get(verticalSlug);
      } catch {
        signoff = null;
      }
      try {
        gate = await evaluateCounselGate({
          verticalSlug,
          store,
          isKnownVertical: isKnownCorpusVertical,
        });
      } catch {
        gate = { live: false, reason: "store-error" };
      }
      const corpus = loadCorpusFor(verticalSlug);
      return {
        verticalSlug,
        corpus,
        envOn: envPermitsVertical(verticalSlug),
        signoff,
        gate,
      };
    }),
  );

  const liveCount = rows.filter((r) => r.gate.live).length;

  return (
    <div className="container-wide py-8">
      <p className="eyebrow mb-2 text-clay">operator · compliance</p>
      <h1 className="font-display text-4xl leading-tight text-ink">
        Counsel sign-off
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        Rewrite-and-stage drafts replacement legal text. It can only do that for
        a vertical once counsel has signed off on that industry&rsquo;s corpus.
        Record the sign-off here after you upload the signed artifact. Until
        then Plaino still flags issues — it just won&rsquo;t draft replacement
        language. The gate is fail-closed: anything ambiguous stays gated.
      </p>
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-mute">
        Precedence: the <code>COMPLIANCE_CORPUS_COUNSEL_REVIEWED</code> env flag
        is a global kill-switch ABOVE these rows — if it doesn&rsquo;t list a
        vertical, that vertical stays gated no matter what you record here.
      </p>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {liveCount} of {rows.length} verticals live for rewrite
      </p>

      <ul className="mt-6 space-y-5">
        {rows.map((row) => {
          const signedAt = row.signoff?.signedAt
            ? new Date(row.signoff.signedAt)
            : null;
          const revokedAt = row.signoff?.revokedAt
            ? new Date(row.signoff.revokedAt)
            : null;
          return (
            <li
              key={row.verticalSlug}
              className="border border-rule bg-paper p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl text-ink">
                    {row.verticalSlug}
                  </p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                    corpus {row.corpus ? "loaded" : "MISSING"}
                    {row.corpus?.metadata?.status
                      ? ` · ${row.corpus.metadata.status}`
                      : ""}
                    {` · env ${row.envOn ? "ON" : "off"}`}
                  </p>
                </div>
                <span
                  className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-eyebrow ${
                    row.gate.live
                      ? "border-ink bg-paper-deep text-ink"
                      : "border-clay bg-paper text-clay"
                  }`}
                >
                  {reasonLabel(row.gate.reason)}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-2 text-[13px] text-ink-soft sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
                    Signed
                  </dt>
                  <dd>
                    {signedAt
                      ? signedAt.toLocaleString("en-US")
                      : "— never signed —"}
                    {row.signoff?.signedByEmail
                      ? ` · ${row.signoff.signedByEmail}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
                    Revoked
                  </dt>
                  <dd>{revokedAt ? revokedAt.toLocaleString("en-US") : "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
                    Artifact
                  </dt>
                  <dd className="break-all">
                    {row.signoff?.artifactRef ? (
                      <a
                        href={row.signoff.artifactRef}
                        className="underline decoration-rule hover:decoration-ink"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.signoff.artifactRef}
                      </a>
                    ) : (
                      "— none —"
                    )}
                  </dd>
                </div>
                {row.signoff?.note ? (
                  <div className="sm:col-span-2">
                    <dt className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
                      Note
                    </dt>
                    <dd>{row.signoff.note}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-5 border-t border-rule pt-4">
                <SignoffForm
                  verticalSlug={row.verticalSlug}
                  action={recordSignoffAction}
                />
                {row.signoff && !revokedAt && signedAt ? (
                  <div className="mt-3">
                    <RevokeButton
                      verticalSlug={row.verticalSlug}
                      action={revokeSignoffAction}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
