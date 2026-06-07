// /operator/creative-briefs — the human-creator handoff queue.
//
// When the Creative discipline's router decides a job is brand-defining
// (or no design tool meets the bar), it lands a DRAFT CreatorBrief here
// instead of improvising raw SVG/PNG
// (feedback_creative_assets_use_tools_or_humans). The operator dispatches the
// brief to an outside creator out of band, pastes the finished asset back, and
// runs the acceptance review. Nothing here sends
// (project_no_outbound_architecture).

import type { CreatorBriefKind, CreatorBriefStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { listBriefs } from "@/lib/creative-handoff";
import type { CreatorBriefPacket } from "@/lib/creative-handoff";
import {
  acceptBriefAction,
  cancelBriefAction,
  deliverBriefAction,
  dispatchBriefAction,
  rebriefAction,
  rejectBriefAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_FILTER_OPTIONS = [
  { value: "open", label: "Open (draft → delivered)" },
  { value: "draft", label: "Draft" },
  { value: "briefed", label: "Briefed" },
  { value: "delivered", label: "Delivered" },
  { value: "closed", label: "Closed (accepted / rejected / cancelled)" },
  { value: "all", label: "All" },
] as const;

const STATUS_LABEL: Record<CreatorBriefStatus, string> = {
  DRAFT: "Draft",
  BRIEFED: "Briefed",
  DELIVERED: "Delivered",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<CreatorBriefStatus, string> = {
  DRAFT: "border-clay bg-paper text-ink",
  BRIEFED: "border-ink bg-paper-deep text-ink",
  DELIVERED: "border-clay bg-paper-deep text-ink",
  ACCEPTED: "border-moss bg-paper text-ink-soft",
  REJECTED: "border-flag bg-paper text-ink",
  CANCELLED: "border-rule bg-paper text-mute",
};

const KIND_LABEL: Record<CreatorBriefKind, string> = {
  BRAND_MARK: "Brand mark",
  HERO_ILLUSTRATION: "Hero illustration",
  MASCOT_ILLUSTRATION: "Mascot illustration",
  PHOTOGRAPHY_DIRECTION: "Photography direction",
  MOTION_IDENT: "Motion ident",
  PRINT_COLLATERAL: "Print collateral",
  OTHER: "Other",
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

function statusesFor(filter: string): CreatorBriefStatus[] | null {
  switch (filter) {
    case "draft":
      return ["DRAFT"];
    case "briefed":
      return ["BRIEFED"];
    case "delivered":
      return ["DELIVERED"];
    case "closed":
      return ["ACCEPTED", "REJECTED", "CANCELLED"];
    case "all":
      return null;
    case "open":
    default:
      return ["DRAFT", "BRIEFED", "DELIVERED"];
  }
}

export default async function OperatorCreativeBriefsPage({
  searchParams,
}: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) redirect("/app");

  const { status: statusParam } = await searchParams;
  const filter = statusParam ?? "open";
  const statuses = statusesFor(filter);
  const briefs = await listBriefs({ statuses: statuses ?? undefined });

  return (
    <div className="container-wide py-8">
      <p className="eyebrow mb-2 text-clay">operator · creative briefs</p>
      <h1 className="font-display text-4xl leading-tight text-ink">
        Human-creator handoff
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        Brand-defining work the fleet does <em>not</em> improvise — brand marks,
        hero and mascot illustration, photography direction. The creative router
        assembles the brief; you dispatch it to a creator from your own channel,
        paste the finished asset back, and run the acceptance review. Nothing
        here sends.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => {
          const active = opt.value === filter;
          return (
            <a
              key={opt.value}
              href={`/operator/creative-briefs?status=${opt.value}`}
              className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-eyebrow ${
                active
                  ? "border-ink bg-paper-deep text-ink"
                  : "border-rule bg-paper text-mute hover:border-ink-soft"
              }`}
            >
              {opt.label}
            </a>
          );
        })}
      </div>

      {briefs.length === 0 ? (
        <p className="mt-10 border border-rule bg-paper-deep p-6 text-[15px] text-ink-soft">
          No briefs in this view yet.
        </p>
      ) : (
        <ul className="mt-8 space-y-5">
          {briefs.map((brief) => {
            const packet = brief.packet as unknown as CreatorBriefPacket;
            const delivery = brief.delivery as
              | { assetRef?: string; note?: string }
              | null;
            return (
              <li key={brief.id} className="border border-rule bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl text-ink">{brief.title}</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                      {KIND_LABEL[brief.kind]} · {brief.routedReason}
                      {brief.createdByAgent ? ` · ${brief.createdByAgent}` : ""} ·{" "}
                      {new Date(brief.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-eyebrow ${STATUS_TONE[brief.status]}`}
                  >
                    {STATUS_LABEL[brief.status]}
                  </span>
                </div>

                <BriefPacket packet={packet} />

                {delivery?.assetRef ? (
                  <p className="mt-3 break-all border-l-2 border-moss pl-3 font-mono text-[12px] text-ink-soft">
                    delivered: {delivery.assetRef}
                    {delivery.note ? ` — ${delivery.note}` : ""}
                  </p>
                ) : null}

                {brief.reviewNotes ? (
                  <p className="mt-2 whitespace-pre-wrap border-l-2 border-rule pl-3 text-[14px] text-ink-soft">
                    {brief.reviewNotes}
                  </p>
                ) : null}

                <BriefActions
                  briefId={brief.id}
                  status={brief.status}
                  creatorRef={brief.creatorRef}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BriefPacket({ packet }: { packet: CreatorBriefPacket }) {
  if (!packet || typeof packet !== "object") return null;
  return (
    <details className="mt-3 border border-rule bg-paper-deep">
      <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-ink-soft">
        Brief packet
      </summary>
      <div className="space-y-3 px-4 py-3 text-[13px] leading-relaxed text-ink">
        <Section title="Guardrails" items={packet.guardrails} />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
            Delivery
          </p>
          <p className="mt-1">
            {packet.delivery?.formats?.join(", ")} ·{" "}
            {packet.delivery?.dimensions?.join(", ")} · {packet.delivery?.colorSpace}
          </p>
          {packet.delivery?.constraints?.length ? (
            <ul className="mt-1 list-disc pl-5 text-ink-soft">
              {packet.delivery.constraints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <Section title="Acceptance criteria" items={packet.acceptanceCriteria} />
        {packet.references?.length ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
              References
            </p>
            <ul className="mt-1 list-disc pl-5 text-ink-soft">
              {packet.references.map((r, i) => (
                <li key={i} className="break-all">
                  [{r.role}] {r.ref}
                  {r.note ? ` — ${r.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
        {title}
      </p>
      <ul className="mt-1 list-disc pl-5 text-ink-soft">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

// Status-aware action forms. Each only renders the legal transitions for the
// current status (the lifecycle guard in lib/creative-handoff/lifecycle is the
// backstop if a stale form posts an illegal move).
function BriefActions({
  briefId,
  status,
  creatorRef,
}: {
  briefId: string;
  status: CreatorBriefStatus;
  creatorRef: string | null;
}) {
  if (status === "ACCEPTED" || status === "CANCELLED") return null;

  return (
    <div className="mt-4 space-y-3 border-t border-rule pt-4">
      {status === "DRAFT" ? (
        <form action={dispatchBriefAction.bind(null, briefId)} className="flex flex-wrap items-center gap-2">
          <input
            name="creatorRef"
            placeholder="Creator (name / handle / marketplace)"
            className="min-w-[16rem] flex-1 border border-rule bg-paper px-3 py-1.5 text-[13px] text-ink placeholder:text-mute"
          />
          <SubmitBtn label="Mark briefed" />
        </form>
      ) : null}

      {status === "BRIEFED" || status === "REJECTED" ? (
        <form action={(status === "REJECTED" ? rebriefAction : deliverBriefAction).bind(null, briefId)} className="flex flex-wrap items-center gap-2">
          {status === "REJECTED" ? (
            <>
              <input
                name="creatorRef"
                defaultValue={creatorRef ?? ""}
                placeholder="Creator (re-brief)"
                className="min-w-[16rem] flex-1 border border-rule bg-paper px-3 py-1.5 text-[13px] text-ink placeholder:text-mute"
              />
              <SubmitBtn label="Re-brief" />
            </>
          ) : (
            <>
              <input
                name="assetRef"
                placeholder="Delivered asset URL / path"
                className="min-w-[16rem] flex-1 border border-rule bg-paper px-3 py-1.5 text-[13px] text-ink placeholder:text-mute"
              />
              <input
                name="note"
                placeholder="Note (optional)"
                className="min-w-[10rem] flex-1 border border-rule bg-paper px-3 py-1.5 text-[13px] text-ink placeholder:text-mute"
              />
              <SubmitBtn label="Mark delivered" />
            </>
          )}
        </form>
      ) : null}

      {status === "DELIVERED" ? (
        <div className="space-y-2">
          <form action={acceptBriefAction.bind(null, briefId)} className="flex flex-wrap items-center gap-2">
            <input
              name="reviewNotes"
              placeholder="Acceptance note (optional)"
              className="min-w-[16rem] flex-1 border border-rule bg-paper px-3 py-1.5 text-[13px] text-ink placeholder:text-mute"
            />
            <SubmitBtn label="Accept" />
          </form>
          <form action={rejectBriefAction.bind(null, briefId)} className="flex flex-wrap items-center gap-2">
            <input
              name="reviewNotes"
              placeholder="Rejection reason"
              className="min-w-[16rem] flex-1 border border-rule bg-paper px-3 py-1.5 text-[13px] text-ink placeholder:text-mute"
            />
            <SubmitBtn label="Reject" />
          </form>
        </div>
      ) : null}

      {status === "DRAFT" || status === "BRIEFED" || status === "REJECTED" ? (
        <form action={cancelBriefAction.bind(null, briefId)}>
          <button
            type="submit"
            className="font-mono text-[11px] uppercase tracking-eyebrow text-mute underline-offset-4 hover:text-flag hover:underline"
          >
            Cancel brief
          </button>
        </form>
      ) : null}
    </div>
  );
}

function SubmitBtn({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="border border-rule bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-eyebrow text-ink-soft transition hover:border-ink"
    >
      {label}
    </button>
  );
}
