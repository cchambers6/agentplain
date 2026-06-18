import type { MarketplaceEntry } from "@/lib/integrations/marketplace";
import {
  dataFlowForEntry,
  UNIVERSAL_STORED_LINE,
} from "@/lib/integrations/data-flow";

/**
 * The per-connector data-flow disclosure rendered on the integration detail
 * page (`/app/workspace/[id]/integrations/[integrationId]`). Shows, at connect
 * time, exactly what flows where, what we store, and what we don't — so the
 * "we process, we don't hoard" stance is concrete at the moment of consent.
 *
 * Pure presentational Server Component. Brand tokens only.
 */
export function ConnectorDataFlow({ entry }: { entry: MarketplaceEntry }) {
  const flow = dataFlowForEntry(entry);

  return (
    <section className="mt-8 border border-rule bg-paper p-5 md:p-6">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        when you connect {entry.name}, here&rsquo;s what flows where
      </p>

      {/* The journey: source → Plaino (in-flight) → output → destination. */}
      <ol className="mt-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-stretch">
        {flow.flow.map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-2 md:flex-1 md:min-w-[160px]"
          >
            <span className="flex flex-1 items-center border border-rule bg-paper-deep px-3 py-2 text-[13px] leading-snug text-ink">
              {step}
            </span>
            {i < flow.flow.length - 1 ? (
              <span
                aria-hidden
                className="font-mono text-sm text-clay md:rotate-0"
              >
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
        <div className="bg-paper p-4 md:p-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-moss">
            we store
          </p>
          <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-ink-soft">
            {flow.stores.map((s) => (
              <li key={s} className="flex gap-2">
                <span aria-hidden className="mt-0.5 text-moss">
                  ✓
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-paper p-4 md:p-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            we don&rsquo;t store
          </p>
          <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-ink-soft">
            {flow.doesNotStore.map((s) => (
              <li key={s} className="flex gap-2">
                <span aria-hidden className="mt-0.5 text-mute">
                  ✗
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {flow.note ? (
        <p className="mt-4 max-w-2xl border-l-2 border-clay pl-4 text-[13px] leading-relaxed text-ink-soft">
          {flow.note}
        </p>
      ) : null}

      <p className="mt-4 text-[12px] leading-relaxed text-mute">
        {UNIVERSAL_STORED_LINE} It&rsquo;s encrypted at rest and walled off to
        your workspace alone.
      </p>
    </section>
  );
}
