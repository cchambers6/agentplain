import Section from "@/components/Section";
import type { JtbdRoleTable } from "@/lib/verticals/types";

// Renders one table per role. If `role.draft` is true, surface a visible
// `[DRAFT — needs vertical-CEO review]` badge so Conner and the head-of-
// vertical see the gap at-a-glance per feedback_no_quick_fixes.md.

export default function JtbdTables({ tables }: { tables: JtbdRoleTable[] }) {
  return (
    <Section
      eyebrow="Jobs to be done"
      title="The recurring work, role by role."
      intro="One row per recurring job the role does today. The right column is what the role does after agentplain lands — the agent drafts; the human still owns the customer-facing decision."
    >
      <div className="space-y-12">
        {tables.map((table) => (
          <RoleTable key={table.role} table={table} />
        ))}
      </div>
    </Section>
  );
}

function RoleTable({ table }: { table: JtbdRoleTable }) {
  return (
    <div className="border border-rule bg-paper">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-6 py-5">
        <h3 className="font-display text-2xl leading-tight text-ink md:text-3xl">
          {table.role}
        </h3>
        {table.draft && (
          <span className="inline-flex items-center gap-2 border border-flag/40 bg-flag/10 px-3 py-1 font-mono text-[11px] tracking-eyebrow text-flag">
            [DRAFT — needs vertical-CEO review]
          </span>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-rule bg-paper-deep">
              <Th>Job</Th>
              <Th>When</Th>
              <Th>Today</Th>
              <Th>With agentplain</Th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, idx) => (
              <tr
                key={row.job + idx}
                className="border-b border-rule last:border-b-0 align-top"
              >
                <Td emphasized>{row.job}</Td>
                <Td muted>{row.when}</Td>
                <Td muted>{row.today}</Td>
                <Td>{row.withAgentplain}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
      {children}
    </th>
  );
}

function Td({
  children,
  muted = false,
  emphasized = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
  emphasized?: boolean;
}) {
  const color = emphasized
    ? "text-ink"
    : muted
    ? "text-mute"
    : "text-ink-soft";
  const weight = emphasized ? "font-medium" : "font-normal";
  return (
    <td className={`px-5 py-4 leading-relaxed ${color} ${weight}`}>
      {children}
    </td>
  );
}
