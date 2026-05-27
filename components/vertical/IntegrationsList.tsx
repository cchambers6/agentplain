import Section from "@/components/Section";
import type { IntegrationsSection } from "@/lib/verticals/types";

// Per `project_integration_roadmap.md` + `feedback_integration_acceptance_is_functional.md`,
// no integrations are shipped as of 2026-05-11. The "planned" framing is
// allowed under the no-vapor rule because it's framed as future, not present.

export default function IntegrationsList({
  integrations,
}: {
  integrations: IntegrationsSection;
}) {
  const hasShipped = integrations.shipped.length > 0;

  return (
    <Section
      eyebrow="Integrations"
      title={
        hasShipped
          ? "What's live, and what's coming."
          : `Integrations launching ${integrations.plannedWindow}.`
      }
      intro={
        hasShipped
          ? "Shipped means the adapter has passed integration-acceptance — real reads, real categorization, real coordination, real drafts on a real customer system. Planned means committed-with-window, not vaporware."
          : "Integration-acceptance is the bar — read + categorize + coordinate + schedule + draft, end-to-end on a customer's live system. None have cleared the bar today; the planned list below is committed-with-window, not vaporware."
      }
    >
      {hasShipped && (
        <div className="mb-10">
          <p className="eyebrow mb-4">Shipped</p>
          <List items={integrations.shipped} variant="shipped" />
        </div>
      )}

      <div>
        <p className="eyebrow mb-4">
          Planned · {integrations.plannedWindow}
        </p>
        <List items={integrations.planned} variant="planned" />
      </div>

      <p className="mt-10 max-w-3xl font-mono text-[12px] leading-relaxed text-mute">
        Sync-diff alone is a subtest. Integration-acceptance means the agent
        completes the full functional value loop — read, categorize,
        coordinate, schedule, draft — end-to-end on a real customer system.
      </p>
    </Section>
  );
}

function List({
  items,
  variant,
}: {
  items: { name: string; category: string; note?: string }[];
  variant: "shipped" | "planned";
}) {
  return (
    <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.name} className="bg-paper p-5">
          <p
            className={`font-mono text-[11px] tracking-eyebrow ${
              variant === "shipped" ? "text-moss" : "text-mute"
            }`}
          >
            {item.category}
          </p>
          <p className="mt-2 font-display text-lg leading-tight text-ink">
            {item.name}
          </p>
          {item.note && (
            <p className="mt-2 text-[13px] leading-relaxed text-mute">
              {item.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
