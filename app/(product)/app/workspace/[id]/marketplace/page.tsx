// Wave-2 skill marketplace. The catalog at `lib/skills/registry.ts` is
// the source of truth; this page surfaces it with honest install /
// uninstall affordances and runtime-status badges per audit §9 #5.
//
// Honesty rules:
//   - `runtime: 'live'` skills install by default for matching vertical
//     or 'all' verticals. The customer can uninstall to opt out.
//   - `runtime: 'schema-only'` skills are NOT installed by default. The
//     customer can install them, but the card carries a "schema-only"
//     badge so they understand the skill won't fire until the runtime
//     wiring lands.
//   - Discipline + vertical facet filters (URL `?discipline=...` and
//     `?vertical=...`) narrow the visible list without bouncing pages.

import { ApEyebrow, ApHeritageButton, ApPaperCard } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls, withSystemContext } from "@/lib/db";
import { SKILL_CATALOG } from "@/lib/skills/registry";
import {
  isSkillInstalledByDefault,
  listSkillInstallationRows,
} from "@/lib/skills/marketplace";
import { SKILL_DISCIPLINE } from "@/lib/disciplines/skill-mapping";
import { listDisciplines } from "@/lib/disciplines";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { installSkillAction, uninstallSkillAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ discipline?: string; vertical?: string }>;
}

export default async function MarketplacePage({ params, searchParams }: PageProps) {
  const { id: workspaceId } = await params;
  const search = await searchParams;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const [workspace, installations] = await Promise.all([
    withSystemContext((tx) =>
      tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { vertical: true },
      }),
    ),
    listSkillInstallationRows(workspaceId, {
      systemContext: (fn) => withRls(ctx, fn),
    }),
  ]);

  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const byCatalog = new Map(installations.map((r) => [r.skillSlug, r] as const));
  const disciplines = listDisciplines();

  const disciplineFilter = (search.discipline ?? "").toLowerCase();
  const verticalFilter = (search.vertical ?? "").toLowerCase();

  const skills = SKILL_CATALOG.map((entry) => {
    const runtime = entry.runtime ?? "schema-only";
    const row = byCatalog.get(entry.slug);
    const installed = row
      ? row.disabledAt === null
      : runtime === "live" && isSkillInstalledByDefault(entry, verticalSlug);
    const customerExplicit = row != null;
    const disciplineId = SKILL_DISCIPLINE[entry.slug] ?? null;
    return {
      entry,
      runtime,
      installed,
      customerExplicit,
      disciplineId,
    };
  }).filter((s) => {
    if (disciplineFilter && s.disciplineId !== disciplineFilter) return false;
    if (verticalFilter) {
      if (verticalFilter === "all") {
        if (s.entry.vertical !== "all") return false;
      } else if (s.entry.vertical !== verticalFilter) {
        return false;
      }
    }
    return true;
  });

  return (
    <div>
      <ApEyebrow className="mb-3">marketplace</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Your fleet — install, uninstall, keep honest.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Every skill in the catalog. Live skills install by default for
        your vertical (and cross-vertical skills install everywhere).
        Schema-only skills carry a badge so you don&rsquo;t install
        something that won&rsquo;t fire yet — when its runtime wiring
        lands, the badge flips.
      </p>

      {/* Facets */}
      <nav className="mt-6 flex flex-wrap gap-3 text-[12px] text-mute">
        <span className="font-mono uppercase tracking-eyebrow">
          discipline:
        </span>
        <FacetLink
          workspaceId={workspaceId}
          field="discipline"
          value=""
          current={disciplineFilter}
          label="all"
          otherField="vertical"
          otherValue={verticalFilter}
        />
        {disciplines.map((d) => (
          <FacetLink
            key={d.id}
            workspaceId={workspaceId}
            field="discipline"
            value={d.id}
            current={disciplineFilter}
            label={d.name}
            otherField="vertical"
            otherValue={verticalFilter}
          />
        ))}
      </nav>
      <nav className="mt-3 flex flex-wrap gap-3 text-[12px] text-mute">
        <span className="font-mono uppercase tracking-eyebrow">
          vertical:
        </span>
        <FacetLink
          workspaceId={workspaceId}
          field="vertical"
          value=""
          current={verticalFilter}
          label="all"
          otherField="discipline"
          otherValue={disciplineFilter}
        />
        <FacetLink
          workspaceId={workspaceId}
          field="vertical"
          value="all"
          current={verticalFilter}
          label="cross-vertical"
          otherField="discipline"
          otherValue={disciplineFilter}
        />
        {Array.from(new Set(SKILL_CATALOG.map((s) => s.vertical)))
          .filter((v) => v !== "all")
          .sort()
          .map((v) => (
            <FacetLink
              key={v}
              workspaceId={workspaceId}
              field="vertical"
              value={v}
              current={verticalFilter}
              label={v.replace(/-/g, " ")}
              otherField="discipline"
              otherValue={disciplineFilter}
            />
          ))}
      </nav>

      {/* Skill list */}
      {skills.length === 0 ? (
        <p className="mt-8 text-[14px] text-ink-soft">
          No skills match the current filters.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {skills.map((s) => (
            <li key={s.entry.slug}>
              <ApPaperCard
                eyebrow={
                  <span className="flex items-center gap-2">
                    <span>{s.entry.slug}</span>
                    <RuntimeBadge runtime={s.runtime} />
                    {s.installed ? (
                      <span className="rounded-sm border border-clay px-2 py-[2px] font-mono text-[10px] tracking-eyebrow uppercase text-clay">
                        installed
                      </span>
                    ) : null}
                    {!s.customerExplicit ? (
                      <span className="rounded-sm border border-rule px-2 py-[2px] font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                        default
                      </span>
                    ) : null}
                  </span>
                }
                title={s.entry.name}
              >
                <p className="text-[14px] leading-relaxed text-ink-soft">
                  {s.entry.description}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-mute">
                  <span>vertical: {s.entry.vertical}</span>
                  <span>kind: {s.entry.kind}</span>
                  {s.disciplineId ? (
                    <span>discipline: {s.disciplineId}</span>
                  ) : null}
                </div>
                <form
                  action={
                    s.installed ? uninstallSkillAction : installSkillAction
                  }
                  className="mt-5"
                >
                  <input
                    type="hidden"
                    name="workspaceId"
                    value={workspaceId}
                  />
                  <input
                    type="hidden"
                    name="skillSlug"
                    value={s.entry.slug}
                  />
                  <ApHeritageButton
                    variant={s.installed ? "ghost" : "secondary"}
                    type="submit"
                  >
                    {s.installed ? "uninstall" : "install"}
                  </ApHeritageButton>
                  {!s.installed && s.runtime === "schema-only" ? (
                    <p className="mt-2 text-[12px] text-mute">
                      Schema-only: installing persists the row, but the
                      skill won&rsquo;t fire until its runtime caller ships.
                    </p>
                  ) : null}
                </form>
              </ApPaperCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RuntimeBadge({ runtime }: { runtime: "live" | "schema-only" | "coming-soon" }) {
  const styles =
    runtime === "live"
      ? "border-clay text-clay"
      : runtime === "coming-soon"
        ? "border-rule text-mute"
        : "border-mute text-mute";
  return (
    <span
      className={`rounded-sm border px-2 py-[2px] font-mono text-[10px] tracking-eyebrow uppercase ${styles}`}
      title={
        runtime === "live"
          ? "Live — production caller fires this skill on real workspace data."
          : runtime === "schema-only"
            ? "Schema-only — module exists with tests but no production caller."
            : "Coming soon — not yet implemented."
      }
    >
      {runtime}
    </span>
  );
}

function FacetLink({
  workspaceId,
  field,
  value,
  current,
  label,
  otherField,
  otherValue,
}: {
  workspaceId: string;
  field: "discipline" | "vertical";
  value: string;
  current: string;
  label: string;
  otherField: "discipline" | "vertical";
  otherValue: string;
}) {
  const params = new URLSearchParams();
  if (value) params.set(field, value);
  if (otherValue) params.set(otherField, otherValue);
  const href = `/app/workspace/${workspaceId}/marketplace${
    params.toString() ? `?${params.toString()}` : ""
  }`;
  const isActive = current === value;
  return (
    <a
      href={href}
      className={`rounded-sm border px-2 py-[2px] font-mono text-[10px] tracking-eyebrow uppercase ${
        isActive
          ? "border-clay text-clay"
          : "border-rule text-mute hover:border-ink hover:text-ink"
      }`}
    >
      {label}
    </a>
  );
}
