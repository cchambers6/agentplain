import { PRESS_MENTIONS, TRUST_EMPTY_COPY } from "@/lib/trust/proof";

// "As seen in" strip — press, podcast appearances, awards. Populated: a
// single hairline row of outlet marks, each linked to the mention itself
// (a mention we can't link doesn't ship). Empty: one honest line, kept
// compact — an empty press bar earns a sentence, not a band.

const KIND_LABEL: Record<string, string> = {
  press: "Press",
  podcast: "Podcast",
  award: "Award",
};

export function PressBar() {
  const copy = TRUST_EMPTY_COPY.press;

  if (PRESS_MENTIONS.length === 0) {
    return (
      <div className="border border-rule bg-paper p-7 md:p-8">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {copy.eyebrow}
        </p>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink">
          {copy.reality}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {copy.eyebrow}
      </p>
      <div className="mt-4 flex flex-wrap gap-px overflow-hidden border border-rule bg-rule">
        {PRESS_MENTIONS.map((m) => (
          <a
            key={m.href}
            href={m.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-w-[10rem] flex-1 flex-col justify-center bg-paper px-5 py-4 transition hover:bg-paper-deep"
          >
            {m.logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- outlet raster; next/image avoided product-wide (see Plaino.tsx)
              <img
                src={m.logoSrc}
                alt={m.outlet}
                className="block h-6 w-auto max-w-full object-contain"
              />
            ) : (
              <p className="font-display text-lg leading-tight text-ink">
                {m.outlet}
              </p>
            )}
            <p className="mt-2 font-mono text-[10px] tracking-eyebrow uppercase text-mute group-hover:text-clay">
              {KIND_LABEL[m.kind]}
              {m.date ? ` · ${m.date}` : ""}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

export default PressBar;
