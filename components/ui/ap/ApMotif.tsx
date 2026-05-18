import type { SVGProps } from "react";

// Single line-illustrated plains motifs — lone-tree, silo, wheat-stalk, horizon.
// Per design language §2.6: 1.5px stroke, currentColor, never filled, never two-
// tone, never gradient. Use sparingly in empty states, sign-up / sign-in, and
// the welcome strip on first-load. NOT for inside working surfaces.

export type ApMotifName = "lone-tree" | "silo" | "wheat" | "horizon";

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
  switch (name) {
    case "silo":
      return <SiloMotif {...svgBase(size)} className={className} {...rest} />;
    case "wheat":
      return <WheatMotif {...svgBase(size)} className={className} {...rest} />;
    case "horizon":
      return <HorizonMotif {...svgBase(size)} className={className} {...rest} />;
    case "lone-tree":
    default:
      return <LoneTreeMotif {...svgBase(size)} className={className} {...rest} />;
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

function HorizonMotif(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      <path d="M0 60 H96" />
      <path d="M10 60 V56 M22 60 V54 M34 60 V57 M46 60 V52 M58 60 V56 M70 60 V53 M82 60 V57" />
    </svg>
  );
}
