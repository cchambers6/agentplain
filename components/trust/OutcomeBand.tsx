import { TRUST_EMPTY_COPY, type OutcomeStat } from "@/lib/trust/proof";

// Before/after outcome band — metric-led proof set in the ledger idiom (mono
// figures, hairline rules). Every stat comes from the registry with a `source`
// artifact behind it (the saved-time ledger), never modeled; the empty state
// says exactly that. See lib/trust/proof.ts for the admission rules.

function StatCell({ stat }: { stat: OutcomeStat }) {
  return (
    <div className="flex flex-col bg-paper p-7 md:p-8">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {stat.metric}
      </p>
      <div className="mt-4 flex items-baseline gap-4">
        <div>
          <p className="font-mono text-2xl text-mute line-through decoration-1 md:text-3xl">
            {stat.before}
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
            before
          </p>
        </div>
        <span aria-hidden className="font-mono text-lg text-clay">
          →
        </span>
        <div>
          <p className="font-mono text-3xl text-ink md:text-4xl">{stat.after}</p>
          <p className="mt-1 font-mono text-[10px] tracking-eyebrow uppercase text-clay">
            after
          </p>
        </div>
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
        {stat.context}
      </p>
    </div>
  );
}

export function OutcomeBand({ items }: { items: OutcomeStat[] }) {
  const copy = TRUST_EMPTY_COPY.outcomes;

  if (items.length === 0) {
    return (
      <div className="border border-rule bg-paper p-7 md:p-8">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {copy.eyebrow}
        </p>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink">
          {copy.reality}
        </p>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-mute">
          {copy.change}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {copy.eyebrow}
      </p>
      <div className="mt-4 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <StatCell key={s.metric} stat={s} />
        ))}
      </div>
      <p className="mt-4 max-w-prose text-[12px] leading-relaxed text-mute">
        Measured from live workspace ledgers over full calendar months.
        Published with each partner&apos;s permission.
      </p>
    </div>
  );
}

export default OutcomeBand;
