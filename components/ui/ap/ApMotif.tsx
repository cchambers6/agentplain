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
  | "big-sky"
  | "windmill"
  | "homestead"
  | "creek"
  | "gate";

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
    case "windmill":
      return <WindmillMotif {...props} />;
    case "homestead":
      return <HomesteadMotif {...props} />;
    case "creek":
      return <CreekMotif {...props} />;
    case "gate":
      return <GateMotif {...props} />;
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

function WindmillMotif(props: SVGProps<SVGSVGElement>) {
  // Prairie water-pump windmill — steady background work, running whether or
  // not anyone is watching. Fits "the fleet works overnight" moments and the
  // reports surfaces (heritage expansion, 2026-07-08).
  return (
    <svg {...props}>
      {/* ground */}
      <path d="M4 80 H92" />
      {/* tower — two legs with a cross-brace */}
      <path d="M42 80 L48 34" />
      <path d="M58 80 L52 34" />
      <path d="M44.5 62 H55.5" />
      <path d="M46 50 H54" />
      {/* hub + four sails, offset like a paused rotation */}
      <path d="M50 30 L58 22" />
      <path d="M50 30 L58 38" />
      <path d="M50 30 L42 22" />
      <path d="M50 30 L42 38" />
      {/* tail vane */}
      <path d="M50 30 H64 L68 27 V33 Z" />
      {/* low outbuilding on the horizon */}
      <path d="M14 80 V72 H28 V80" />
    </svg>
  );
}

function HomesteadMotif(props: SVGProps<SVGSVGElement>) {
  // The home place — a small house with a lit doorway and a fence run. The
  // firm itself: what all the work is in service of. Fits welcome strips and
  // account/settings empty states (heritage expansion, 2026-07-08).
  return (
    <svg {...props}>
      {/* ground */}
      <path d="M4 76 H92" />
      {/* house body */}
      <path d="M34 76 V54 H66 V76" />
      {/* gable roof with an eave overhang */}
      <path d="M30 56 L50 40 L70 56" />
      {/* doorway */}
      <path d="M46 76 V62 H54 V76" />
      {/* chimney */}
      <path d="M60 47 V38 H64 V50" />
      {/* fence run to the edge */}
      <path d="M10 76 V70 M18 76 V70 M26 76 V70 M12 72 H26" />
      <path d="M74 76 V70 M82 76 V70 M76 72 H82" />
    </svg>
  );
}

function CreekMotif(props: SVGProps<SVGSVGElement>) {
  // A creek crossing the plain — steady flow, always moving, never rushed.
  // Fits activity feeds and briefing/report dividers (heritage expansion,
  // 2026-07-08).
  return (
    <svg {...props}>
      {/* far bank */}
      <path d="M4 50 H92" />
      {/* creek — two meandering banks widening toward the viewer */}
      <path d="M40 50 Q34 62 44 70 Q54 78 46 88" />
      <path d="M54 50 Q62 60 54 70 Q46 80 58 88" />
      {/* current marks inside the channel */}
      <path d="M46 60 Q49 62 52 60" />
      <path d="M48 74 Q51 76 54 74" />
      {/* tussocks on the banks */}
      <path d="M22 50 V45 M30 50 V47 M70 50 V46 M80 50 V47" />
    </svg>
  );
}

function GateMotif(props: SVGProps<SVGSVGElement>) {
  // An opened field gate — access granted, a connection made. Fits the
  // connections/integrations surfaces and the first-connect moment
  // (heritage expansion, 2026-07-08).
  return (
    <svg {...props}>
      {/* ground */}
      <path d="M4 76 H92" />
      {/* posts */}
      <path d="M30 76 V44" />
      <path d="M70 76 V44" />
      {/* gate leaf, swung open toward the viewer (foreshortened) */}
      <path d="M30 48 L58 58" />
      <path d="M30 64 L58 70" />
      <path d="M30 48 V64 M58 58 V70" />
      <path d="M30 64 L58 58" />
      {/* fence wires running off both posts */}
      <path d="M4 52 H30 M4 62 H30" />
      <path d="M70 52 H92 M70 62 H92" />
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
