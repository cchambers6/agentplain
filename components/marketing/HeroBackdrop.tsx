import { PlainoScene, type PlainoSceneName } from "@/components/ui/ap";

// Shared marketing hero backdrop — the right-anchored heritage Plaino scene
// with paper scrims, md+ only. Mirrors the homepage hero pattern (see
// app/(marketing)/page.tsx) so every marketing hero gets the same calm,
// legible "dog on the plain behind the headline" treatment.
//
// Wired to a placeholder scene today (see PlainoScene); a real asset swap is
// one line in PlainoScene's SRC map and every consuming hero updates at once.
//
// The parent <section> MUST be `relative overflow-hidden` and the content
// wrapper `relative` so the copy sits above this aria-hidden decoration.
// Below md the hero is portrait with no horizontal room for art, so the whole
// backdrop drops — zero content/SEO loss.
export function HeroBackdrop({ scene }: { scene: PlainoSceneName }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden md:block"
    >
      <PlainoScene
        name={scene}
        className="absolute inset-0 h-full w-full object-cover object-right opacity-90"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/95 to-paper/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/30 to-transparent" />
    </div>
  );
}

export default HeroBackdrop;
