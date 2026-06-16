import Section from "@/components/Section";
import { FaqList } from "@/components/FAQ";
import type { VerticalFaqItem } from "@/lib/verticals/types";

// Per-vertical FAQ. Reuses the shared `FaqList` disclosure renderer so the
// homepage, /pricing, and every vertical page present FAQ content identically.
// The same `items` array drives the rendered list here AND the FAQPage
// JSON-LD on the vertical page — Google requires the structured data to
// mirror visible content, so there is exactly one source of truth.
export default function VerticalFaq({
  name,
  items,
}: {
  name: string;
  items: VerticalFaqItem[];
}) {
  return (
    <Section
      tone="deep"
      eyebrow="Questions worth asking"
      title={`agentplain for ${name.toLowerCase()} — the honest version.`}
    >
      <FaqList items={items} />
    </Section>
  );
}
