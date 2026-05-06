import Link from "next/link";

type LogoProps = {
  variant?: "ink" | "color";
  className?: string;
  withWordmark?: boolean;
};

export default function Logo({
  variant = "ink",
  className = "",
  withWordmark = true,
}: LogoProps) {
  const markFill = variant === "color" ? "#5F8060" : "#2A2620";

  return (
    <Link
      href="/"
      aria-label="agentplain — home"
      className={`inline-flex items-baseline gap-3 ${className}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="translate-y-[3px]"
      >
        <rect x="2" y="2" width="16" height="16" fill={markFill} />
        <line
          x1="0"
          y1="19"
          x2="20"
          y2="19"
          stroke="#2A2620"
          strokeWidth="0.75"
        />
      </svg>
      {withWordmark && (
        <span className="font-display text-[1.6rem] leading-none tracking-tight text-ink">
          agentplain
        </span>
      )}
    </Link>
  );
}
