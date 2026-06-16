import Section from "@/components/Section";
import { verticalFaqQuestion } from "@/lib/seo/structured-data";

// AEO direct-answer block. Renders the vertical's `directAnswer` under the
// exact heading "What is agentplain for {name}?" so the question and its
// self-contained answer are both VISIBLE on the page — the precondition for
// emitting that same Q&A as the first entry of the page's FAQPage JSON-LD
// (Google requires FAQ structured data to mirror visible content).
//
// The block sits high on the page (right after the hero) because answer
// engines and skimming buyers both want the "what is this" paragraph before
// the JTBD detail. The paragraph is styled large and quotable — one idea, no
// list, no scare quotes — so it lifts cleanly into an AI answer.
export default function VerticalDirectAnswer({
  name,
  answer,
}: {
  name: string;
  answer: string;
}) {
  return (
    <Section
      tone="paper"
      eyebrow="The short answer"
      title={verticalFaqQuestion(name)}
    >
      <p className="max-w-3xl font-display text-xl leading-relaxed text-ink md:text-2xl md:leading-relaxed">
        {answer}
      </p>
    </Section>
  );
}
