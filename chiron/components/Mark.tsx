// The Chiron mark. POC: text wordmark ONLY — no drawn centaur. The real
// centaur mark is with a human illustrator (brief:
// docs/brand/chiron-logo-brief-2026-07-10.md on the flatsbo repo). When it
// lands, drop the SVG into public/brand/chiron/mark.svg and update this
// component to render it alongside the wordmark (and swap app/icon.svg).
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-wordmark font-bold tracking-tight text-ink ${className}`}
    >
      Chiron
    </span>
  );
}
