import { ApRootedLoader } from "@/components/ui/ap";

// Help-page loading fallback. We check for any recent support note's
// status before render so the page can pre-fill the "your last note"
// banner. Contextual copy per design language §3.6 — what's happening,
// not a generic spinner.

export default function HelpLoading() {
  return (
    <div className="mx-auto max-w-2xl py-2">
      <ApRootedLoader kind="default" label="Reaching your service partner…" />
    </div>
  );
}
