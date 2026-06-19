import { ApPaperCard } from "@/components/ui/ap";
import type { MarketplaceEntry } from "@/lib/integrations/marketplace";

// Connection-time data disclosure. Rendered ABOVE the connect CTA on the
// integration detail page so the customer sees EXACTLY what we'll store
// before they grant access — not buried in a policy doc.
//
// The shape is always the same three lines:
//   1. what we store  (the encrypted token — the only thing we keep)
//   2. what we DON'T   (the data behind that token — pass-through, in-flight)
//   3. the per-connector specific (tuned by category)
//
// Document/file connectors are the one nuance: when you point us at a Drive
// or Notion, the documents you ask us to index ARE stored (so Plaino can
// search them) — and disconnecting deletes them. We say that plainly rather
// than over-claim "we store nothing".

interface DisclosureCopy {
  /** What flows through, in-flight, and is never stored. */
  passThrough: string;
  /** Set when this connector DOES persist something (indexed docs). */
  storedNote?: string;
}

function disclosureFor(entry: MarketplaceEntry): DisclosureCopy {
  switch (entry.category) {
    case "Email":
      return {
        passThrough:
          "We read the messages in your mailbox in-flight to triage, draft, and schedule. Your emails are never copied into our database — Plaino reads them, does the work, and the source stays in your mailbox.",
      };
    case "CRM":
      return {
        passThrough: `We read the contacts, deals, and records in ${entry.name} in-flight when Plaino needs them. None of your CRM data is copied into our database — it stays in ${entry.name}.`,
      };
    case "Accounting":
    case "Payments":
      return {
        passThrough: `We read the invoices, balances, and transactions in ${entry.name} in-flight to do the work (e.g. chasing an overdue invoice). Your financial records are never copied into our database.`,
      };
    case "Messaging":
      return {
        passThrough: `We read the channels and threads you point us at in ${entry.name} in-flight, and write back into the threads you already work in. Your messages are not copied into our database.`,
      };
    case "Documents":
    case "Spreadsheets":
      return {
        passThrough: `We read the files you point us at in ${entry.name} in-flight, and write new versions back where you keep them.`,
        storedNote:
          "When you explicitly ask us to make a document searchable, we store the indexed text + a private vector index scoped to your workspace — so Plaino can ground its work in it. Disconnecting deletes everything we indexed from this source. This is the only connector data we persist, and only because you asked us to.",
      };
    case "Calendar":
      return {
        passThrough: `We read your ${entry.name} availability in-flight to propose and coordinate times. Your calendar is never copied into our database.`,
      };
    case "Creative":
    default:
      return {
        passThrough: `We read what ${entry.name} returns in-flight to do the work, and never copy it into our database.`,
      };
  }
}

export function ConnectStorageDisclosure({ entry }: { entry: MarketplaceEntry }) {
  const copy = disclosureFor(entry);
  return (
    <ApPaperCard
      eyebrow="before you connect"
      title={`What we'll store when you connect ${entry.name}.`}
    >
      <ul className="space-y-4">
        <li>
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-clay">
            we store
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            Your authorization token, encrypted at rest (AES-256-GCM), so we can
            reach {entry.name} when there's work to do. That token is the only
            thing we keep — you can revoke it any time by disconnecting.
          </p>
        </li>
        <li>
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-clay">
            we do not store
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            {copy.passThrough}
          </p>
        </li>
        {copy.storedNote ? (
          <li>
            <p className="font-mono text-[10px] uppercase tracking-eyebrow text-clay">
              the one exception
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              {copy.storedNote}
            </p>
          </li>
        ) : null}
      </ul>
      <p className="mt-5 text-[12px] leading-relaxed text-mute">
        See exactly what we hold for you any time on your{" "}
        <span className="font-mono">Account → Your data → What we store</span>{" "}
        page.
      </p>
    </ApPaperCard>
  );
}
