type StackRow = {
  category: string;
  examples: string;
  low: number;
  high: number;
  replacedBy: string;
};

const rows: StackRow[] = [
  {
    category: "CRM",
    examples: "Follow Up Boss, KW Command, BoomTown, Wise Agent",
    low: 100,
    high: 300,
    replacedBy: "agents read and write inside the CRM you already pay for, and our hygiene agents keep it clean",
  },
  {
    category: "Lead-gen platform",
    examples: "Zillow Premier, Realtor.com, Ylopo, BoldLeads",
    low: 100,
    high: 500,
    replacedBy: "leads land in your existing inbox and get a sub-60-second personalized first reply",
  },
  {
    category: "Listing copy / marketing",
    examples: "Per-listing copywriter or marketing retainer",
    low: 200,
    high: 500,
    replacedBy: "AI-written, compliance-checked copy + property site + social pack — every listing, in 10 minutes",
  },
  {
    category: "Email drip / nurture",
    examples: "ActiveCampaign, Mailchimp, kvCORE drips",
    low: 20,
    high: 50,
    replacedBy: "long-tail nurture drafts ready in your inbox; you approve, your domain sends",
  },
  {
    category: "Social media scheduler",
    examples: "Hootsuite, Later, Buffer",
    low: 20,
    high: 80,
    replacedBy: "weekly social pack drafted, branded to you, queued in your existing tool",
  },
  {
    category: "Transaction management",
    examples: "Dotloop, SkySlope, BackAgent",
    low: 40,
    high: 100,
    replacedBy: "deadlines monitored, parties nudged, documents collected without a tab to maintain",
  },
  {
    category: "Showings + scheduling",
    examples: "ShowingTime add-ons, calendar tools",
    low: 30,
    high: 30,
    replacedBy: "showings coordinated across all parties, confirmations and reschedules logged to CRM",
  },
];

function fmt(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

const totalLow = rows.reduce((sum, r) => sum + r.low, 0);
const totalHigh = rows.reduce((sum, r) => sum + r.high, 0);

export default function StackComparison() {
  return (
    <div className="border border-rule bg-paper">
      <div className="grid grid-cols-[1.4fr_1fr_1.4fr] border-b border-rule bg-paper-deep">
        <div className="p-4 md:p-5">
          <p className="eyebrow">Tool category</p>
        </div>
        <div className="border-l border-rule p-4 md:p-5">
          <p className="eyebrow">Per realtor / mo</p>
        </div>
        <div className="border-l border-rule p-4 md:p-5">
          <p className="eyebrow text-signal">Replaced by agentplain</p>
        </div>
      </div>

      {rows.map((row) => (
        <div
          key={row.category}
          className="grid grid-cols-[1.4fr_1fr_1.4fr] border-b border-rule"
        >
          <div className="p-4 md:p-5">
            <p className="font-display text-lg leading-snug text-ink md:text-xl">
              {row.category}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-soft">
              {row.examples}
            </p>
          </div>
          <div className="border-l border-rule p-4 md:p-5">
            <p className="font-mono text-base text-ink md:text-lg">
              {row.low === row.high
                ? `~${fmt(row.low)}`
                : `${fmt(row.low)}–${fmt(row.high)}`}
            </p>
          </div>
          <div className="border-l border-rule p-4 md:p-5">
            <p className="text-[14px] leading-relaxed text-ink-soft">
              {row.replacedBy}
            </p>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-[1.4fr_1fr_1.4fr] bg-paper-deep">
        <div className="p-4 md:p-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
            Typical realtor stack
          </p>
          <p className="mt-1 font-display text-xl leading-tight text-ink">
            Total per realtor / mo
          </p>
        </div>
        <div className="border-l border-rule p-4 md:p-5">
          <p className="font-mono text-2xl text-ink md:text-3xl">
            {fmt(totalLow)}–{fmt(totalHigh)}
          </p>
        </div>
        <div className="border-l border-rule p-4 md:p-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-signal">
            agentplain
          </p>
          <p className="mt-1 font-display text-xl leading-tight text-ink">
            $79–$199 / realtor / mo
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-soft">
            depending on team size — see pricing
          </p>
        </div>
      </div>
    </div>
  );
}
