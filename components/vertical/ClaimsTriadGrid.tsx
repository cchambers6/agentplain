import Section from "@/components/Section";
import type { ClaimsTriad } from "@/lib/verticals/types";

const COLUMNS: Array<{
  key: keyof ClaimsTriad;
  label: string;
  body: string;
}> = [
  {
    key: "replace",
    label: "Replace",
    body: "Work the fleet takes off your desk entirely.",
  },
  {
    key: "integrate",
    label: "Integrate",
    body: "Customer-system tools agentplain reads from and writes to.",
  },
  {
    key: "augment",
    label: "Augment",
    body: "Work the human still owns — the agent drafts, you decide.",
  },
];

export default function ClaimsTriadGrid({ claims }: { claims: ClaimsTriad }) {
  return (
    <Section
      eyebrow="What agentplain does, and doesn't"
      title="Replace. Integrate. Augment."
      intro="The fleet replaces some work, integrates with the rest of your stack, and augments the work that has to stay human. Every entry below is a specific commitment — no marketing fog."
    >
      <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <Column
            key={col.key}
            label={col.label}
            body={col.body}
            items={claims[col.key]}
          />
        ))}
      </div>
    </Section>
  );
}

function Column({
  label,
  body,
  items,
}: {
  label: string;
  body: string;
  items: string[];
}) {
  return (
    <div className="flex flex-col bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow text-signal">
        {label}
      </p>
      <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-slate-soft">
        {body}
      </p>
      <ul className="mt-6 space-y-3 border-t border-rule pt-6 text-[15px] leading-relaxed text-ink">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 inline-block h-px w-3 shrink-0 bg-signal" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
