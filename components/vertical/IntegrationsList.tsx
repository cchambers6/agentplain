import Section from "@/components/Section";
import type { IntegrationsSection } from "@/lib/verticals/types";

// Three honesty tiers (see `IntegrationsSection` in lib/verticals/types.ts):
//   - shipped   → live on a customer's system today (connect path open).
//   - supported → adapter built + tested behind the port; live calls need a
//                 connected credential + the per-vendor `<VENDOR>_ADAPTER_LIVE`
//                 flag. The wave-1/1b vertical adapters (Buildium, EZLynx,
//                 Encompass, Qualia) live here — real code, not vaporware, but
//                 not "live on your system" until you connect it.
//   - planned   → committed-with-window, not yet built.
// Per `feedback_integration_acceptance_is_functional.md` the bar for each tier
// is stated in the copy below so the page never overclaims.

export default function IntegrationsList({
  integrations,
}: {
  integrations: IntegrationsSection;
}) {
  const supported = integrations.supported ?? [];
  const hasShipped = integrations.shipped.length > 0;
  const hasSupported = supported.length > 0;
  const hasAny = hasShipped || hasSupported;

  return (
    <Section
      eyebrow="Integrations"
      title={
        hasAny
          ? "What's live, what's ready, and what's coming."
          : `Integrations launching ${integrations.plannedWindow}.`
      }
      intro={
        hasAny
          ? "Live means the connect path is open and your service partner reads, categorizes, coordinates, schedules, and drafts on your real system. Ready means the adapter is built and tested behind the port — going live takes a connected credential, not new code. Planned means committed-with-window, not vaporware."
          : "Integration-acceptance is the bar — read + categorize + coordinate + schedule + draft, end-to-end on a customer's live system. None have cleared the bar today; the planned list below is committed-with-window, not vaporware."
      }
    >
      {hasShipped && (
        <div className="mb-10">
          <p className="eyebrow mb-4">Live</p>
          <List items={integrations.shipped} variant="shipped" />
        </div>
      )}

      {hasSupported && (
        <div className="mb-10">
          <p className="eyebrow mb-4">Ready to connect</p>
          <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-mute">
            The adapter is built and tested. Connecting your account turns it
            on — no new engineering, just your credential.
          </p>
          <List items={supported} variant="supported" />
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
  variant: "shipped" | "supported" | "planned";
}) {
  const categoryColor =
    variant === "shipped"
      ? "text-moss"
      : variant === "supported"
        ? "text-ink"
        : "text-mute";

  return (
    <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.name} className="bg-paper p-5">
          <p className={`font-mono text-[11px] tracking-eyebrow ${categoryColor}`}>
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
