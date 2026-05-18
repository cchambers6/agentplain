import type { SVGProps } from "react";

// Single line-illustrated plains motifs — lone-tree, silo, wheat, sheaf,
// horizon, seed, plow, big-sky. Per design language §2.6: 1.5px stroke,
// currentColor, never filled, never two-tone, never gradient. Use sparingly
// in empty states, sign-up / sign-in, and the welcome strip on first-load.
// NOT for inside working surfaces.

export type ApMotifName =
  | "lone-tree"
  | "silo"
  | "wheat"
  | "sheaf"
  | "horizon"
  | "seed"
  | "plow"
  | "big-sky";

interface ApMotifProps extends SVGProps<SVGSVGElement> {
  name?: ApMotifName;
  /** Logical pixel height. Default 96. */
  size?: number;
}

const svgBase = (size: number) => ({
  height: size,
  width: "auto" as const,
  viewBox: "0 0 96 96",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/**
 * @example
 * <ApMotif name="lone-tree" className="text-ink" />
 * <ApMotif name="wheat" size={64} className="text-mute" />
 */
export function ApMotif({
  name = "lone-tree",
  size = 96,
  className,
  ...rest
}: ApMotifProps) {
  const props = { ...svgBase(size), className, ...rest };
  switch (name) {
    case "silo":
      return <SiloMotif {...props} />;
    case "wheat":
      return <WheatMotif {...props} />;
    case "sheaf":
      return <SheafMotif {...props} />;
    case "horizon":
      return <HorizonMotif {...props} />;
    case "seed":
      return <SeedMotif {...props} />;
    case "plow":
      return <PlowMotif {...props} />;
    case "big-sky":
      return <BigSkyMotif {...props} />;
    case "lone-tree":
    default:
      return <LoneTreeMotif {...props} />;
  }
}

function LoneTreeMotif(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      {/* horizon line */}
      <path d="M4 76 H92" />
      {/* trunk */}
      <path d="M48 76 V52" />
      {/* canopy — asymmetric, sketch-like */}
      <path d="M38 52 Q48 30 58 52" />
      <path d="M40 48 Q48 36 56 48" />
      {/* distant fenceline */}
      <path d="M10 76 V72 M18 76 V73 M26 76 V72" />
    </svg>
  );
}

function SiloMotif(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      <path d="M4 76 H92" />
      {/* silo body */}
      <path d="M50 76 V42" />
      <path d="M68 76 V42" />
      {/* silo cap */}
      <path d="M50 42 Q59 32 68 42" />
      {/* adjacent shed */}
      <path d="M16 76 V62 H40 V76" />
      <path d="M16 62 L28 54 L40 62" />
    </svg>
  );
}

function WheatMotif(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      {/* stalk */}
      <path d="M48 88 V28" />
      {/* head grains, paired */}
      <path d="M48 32 Q40 30 38 36" />
      <path d="M48 32 Q56 30 58 36" />
      <path d="M48 40 Q40 38 38 44" />
      <path d="M48 40 Q56 38 58 44" />
      <path d="M48 48 Q40 46 38 52" />
      <path d="M48 48 Q56 46 58 52" />
      <path d="M48 56 Q42 54 40 60" />
      <path d="M48 56 Q54 54 56 60" />
      {/* tip */}
      <path d="M48 28 L46 22 M48 28 L50 22 M48 28 L48 20" />
      {/* ground */}
      <path d="M30 88 H66" />
    </svg>
  );
}

function SheafMotif(props: SVGProps<SVGSVGElement>) {
  // A bundled sheaf — three stalks tied at the waist. Visual cue for
  // "harvest gathered, ready to hand over" — fits the approvals queue's
  // "drafts gathered, waiting on you" framing.
  return (
    <svg {...props}>
      {/* three stalks, fanning slightly */}
      <path d="M40 88 V36 L36 24" />
      <path d="M48 88 V32 L48 20" />
      <path d="M56 88 V36 L60 24" />
      {/* heads */}
      <path d="M36 24 Q30 22 30 30" />
      <path d="M36 24 Q38 22 42 28" />
      <path d="M48 20 Q42 22 42 26" />
      <path d="M48 20 Q54 22 54 26" />
      <path d="M60 24 Q66 22 66 30" />
      <path d="M60 24 Q58 22 54 28" />
      {/* binding cord at the waist */}
      <path d="M36 60 Q48 56 60 60" />
      <path d="M36 64 Q48 60 60 64" />
      {/* ground line */}
      <path d="M28 88 H68" />
    </svg>
  );
}

function HorizonMotif(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      <path d="M0 60 H96" />
      <path d="M10 60 V56 M22 60 V54 M34 60 V57 M46 60 V52 M58 60 V56 M70 60 V53 M82 60 V57" />
    </svg>
  );
}

function SeedMotif(props: SVGProps<SVGSVGElement>) {
  // Single seed dropped in soil with a hairline-thin root taking hold —
  // "rooting in," the visual cousin of the ApRootedLoader.
  return (
    <svg {...props}>
      {/* ground line */}
      <path d="M4 60 H92" />
      {/* seed body — almond shape */}
      <path d="M44 58 Q48 50 52 58 Q48 62 44 58 Z" />
      {/* sprouting taproot below */}
      <path d="M48 62 V76" />
      <path d="M48 70 Q44 74 42 80" />
      <path d="M48 72 Q52 76 54 82" />
      {/* faint first leaves above */}
      <path d="M48 52 Q44 48 42 44" />
      <path d="M48 52 Q52 48 54 44" />
    </svg>
  );
}

function PlowMotif(props: SVGProps<SVGSVGElement>) {
  // Three plowed rows running to a low horizon — "the work is done; the
  // field is ready." Fits compliance-clean and post-handoff empty states.
  return (
    <svg {...props}>
      {/* low horizon */}
      <path d="M0 50 H96" />
      {/* receding plowed furrows, foreshortened */}
      <path d="M4 84 Q48 74 92 84" />
      <path d="M8 72 Q48 64 88 72" />
      <path d="M14 62 Q48 56 82 62" />
      {/* a single seed-mound at center */}
      <path d="M46 82 Q48 78 50 82" />
    </svg>
  );
}

function BigSkyMotif(props: SVGProps<SVGSVGElement>) {
  // Wide horizon, three drifting cloud bands and a low ground line —
  // "two weeks of mornings" fits this; briefings empty state uses it.
  return (
    <svg {...props}>
      {/* low ground */}
      <path d="M0 78 H96" />
      {/* receding tussock marks */}
      <path d="M14 78 V74 M30 78 V75 M50 78 V73 M70 78 V75 M86 78 V74" />
      {/* three flat cloud bands in the sky */}
      <path d="M10 36 Q24 30 38 36" />
      <path d="M48 24 Q62 18 76 24" />
      <path d="M20 52 Q40 46 58 52" />
    </svg>
  );
}
