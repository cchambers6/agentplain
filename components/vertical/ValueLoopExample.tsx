import Section from "@/components/Section";
import type { ValueLoopExample as ValueLoopExampleType } from "@/lib/verticals/types";

// Day-in-the-life value-loop renderer. Required on every vertical page per
// `project_agentplain_mission_and_positioning.md` — the rule says "every
// vertical landing page should show ONE concrete example of the value loop."
//
// Two-column "before / after" layout with a closing outcome banner. The
// before column reads in mute tone; the after column reads in ink to mirror
// the time-recovery the fleet creates.
export default function ValueLoopExample({
  example,
  verticalName,
}: {
  example: ValueLoopExampleType;
  verticalName: string;
}) {
  return (
    <Section
      tone="paper"
      eyebrow="A day in the life"
      title="What the fleet drafts before you open the laptop."
      intro={`One concrete example from a ${verticalName.toLowerCase()} practitioner's week — the scenario, what the practitioner does today, and what changes after the fleet lands.`}
    >
      <div className="border border-rule bg-paper p-6 md:p-10">
        <p className="max-w-3xl font-display text-2xl leading-snug text-ink md:text-3xl md:leading-snug">
          {example.scenario}
        </p>

        <div className="mt-10 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <Side label="Today" body={example.before} tone="mute" />
          <Side label="With agentplain" body={example.after} tone="ink" />
        </div>

        <div className="mt-8 border-l-2 border-clay pl-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
            Outcome
          </p>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink">
            {example.outcome}
          </p>
        </div>
      </div>
    </Section>
  );
}

function Side({
  label,
  body,
  tone,
}: {
  label: string;
  body: string;
  tone: "mute" | "ink";
}) {
  const labelColor = tone === "ink" ? "text-clay" : "text-mute";
  const bodyColor = tone === "ink" ? "text-ink" : "text-ink-soft";
  return (
    <div className="bg-paper p-6 md:p-7">
      <p
        className={`font-mono text-[11px] tracking-eyebrow uppercase ${labelColor}`}
      >
        {label}
      </p>
      <p
        className={`mt-3 text-[15px] leading-relaxed ${bodyColor}`}
      >
        {body}
      </p>
    </div>
  );
}
