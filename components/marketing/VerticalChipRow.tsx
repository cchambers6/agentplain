import Link from "next/link";
import { getAllVerticals } from "@/lib/verticals";

// VerticalChipRow — renders all 10 active verticals as chips on page 1 of any
// marketing surface. Required by `project_agentplain_mission_and_positioning.md`:
// "Page 1 of any marketing surface mentions ALL 10 verticals upfront. Real
// estate is NOT the only mention."
//
// Source for the list: `lib/verticals/index.ts` (locked at 10 per
// `project_vertical_tier_mapping.md`). Adding an 11th vertical requires a memory
// ratification — this component will pick it up automatically once the registry
// gains it, which is the intended coupling.
//
// Hrefs: each chip links to `/{slug}` which is served by
// `app/(marketing)/[vertical]/page.tsx`. The vertical pages already exist with
// full content; no TODO needed.

type Props = {
  eyebrow?: string;
};

export default function VerticalChipRow({
  eyebrow = "Built for ten kinds of local business — pick yours",
}: Props) {
  const verticals = getAllVerticals();

  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {eyebrow}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {verticals.map((v) => (
          <Link
            key={v.slug}
            href={`/${v.slug}`}
            className="group inline-flex items-center gap-2 border border-rule bg-paper px-3 py-2 text-sm text-ink transition hover:border-ink hover:bg-paper-deep"
          >
            <span className="font-display">{v.name}</span>
            <span
              aria-hidden
              className="font-mono text-[10px] tracking-eyebrow text-mute group-hover:text-clay"
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
