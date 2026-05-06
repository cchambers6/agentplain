type AgentCardProps = {
  index: string;
  name: string;
  description: string;
};

export default function AgentCard({ index, name, description }: AgentCardProps) {
  return (
    <article className="group flex h-full flex-col border border-rule bg-paper p-6 transition hover:border-ink/50">
      <div className="mb-5 flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-eyebrow text-slate-soft">
          {index}
        </span>
        <span
          aria-hidden
          className="inline-block h-2 w-2 bg-signal opacity-70 group-hover:opacity-100"
        />
      </div>
      <h3 className="font-display text-2xl leading-tight text-ink">{name}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        {description}
      </p>
    </article>
  );
}
