import Link from "next/link";
import type { MarketplaceEntry } from "@/lib/integrations/marketplace";
import { oauthStartPath, waitlistPath } from "@/lib/integrations/marketplace";

export type TileStatus = "connected" | "available" | "coming-soon";

interface IntegrationTileProps {
  entry: MarketplaceEntry;
  status: TileStatus;
  workspaceId: string;
  /** Account label rendered under the title when connected (e.g. "you@firm.com"). */
  accountLabel?: string;
}

export function IntegrationTile({
  entry,
  status,
  workspaceId,
  accountLabel,
}: IntegrationTileProps) {
  const isComingSoon = status === "coming-soon";
  const isConnected = status === "connected";

  const tileClasses = [
    "flex h-full flex-col bg-paper p-5 transition",
    isComingSoon ? "opacity-70" : "hover:bg-paper-deep",
  ].join(" ");

  return (
    <div data-testid={`integration-tile-${entry.id}`} className={tileClasses}>
      <div className="flex items-start justify-between gap-3">
        <IntegrationIcon id={entry.id} />
        <StatusBadge status={status} />
      </div>
      <p className="mt-4 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {entry.category}
      </p>
      <p className="mt-1 font-display text-xl text-ink">{entry.name}</p>
      {accountLabel && (
        <p className="mt-1 font-mono text-[11px] tracking-wide text-mute">
          {accountLabel}
        </p>
      )}
      <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-soft">
        {entry.description}
      </p>
      <div className="mt-5">
        <TileAction entry={entry} status={status} workspaceId={workspaceId} />
      </div>
    </div>
  );
}

function TileAction({
  entry,
  status,
  workspaceId,
}: {
  entry: MarketplaceEntry;
  status: TileStatus;
  workspaceId: string;
}) {
  const focusRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
  if (status === "connected") {
    return (
      <Link
        prefetch={false}
        href={`/app/workspace/${workspaceId}/integrations/${entry.id}`}
        className={`inline-flex items-center gap-2 font-mono text-[11px] tracking-eyebrow uppercase text-ink underline-offset-4 hover:underline ${focusRing}`}
      >
        manage <span aria-hidden>→</span>
      </Link>
    );
  }
  if (status === "available") {
    return (
      <Link
        prefetch={false}
        href={oauthStartPath(entry, workspaceId)}
        className={`inline-flex items-center gap-2 border border-clay bg-clay px-4 py-2 font-sans text-[13px] font-medium text-paper transition hover:border-clay-deep hover:bg-clay-deep ${focusRing}`}
      >
        connect <span aria-hidden>→</span>
      </Link>
    );
  }
  return (
    <Link
      prefetch={false}
      href={waitlistPath(entry)}
      className={`inline-flex items-center gap-2 border border-ink/30 px-4 py-2 font-sans text-[13px] font-medium text-ink transition hover:border-ink hover:bg-ink/[0.03] ${focusRing}`}
    >
      join the waitlist <span aria-hidden>→</span>
    </Link>
  );
}

function StatusBadge({ status }: { status: TileStatus }) {
  const map: Record<TileStatus, { label: string; classes: string }> = {
    connected: {
      label: "connected",
      classes: "border-moss/40 bg-moss/10 text-moss",
    },
    available: {
      label: "available",
      classes: "border-ink/30 bg-paper text-ink",
    },
    "coming-soon": {
      label: "coming soon",
      classes: "border-rule bg-paper text-mute",
    },
  };
  const { label, classes } = map[status];
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] tracking-eyebrow uppercase ${classes}`}
    >
      {label}
    </span>
  );
}

function IntegrationIcon({ id }: { id: string }) {
  const cls = "h-7 w-7 text-ink";
  switch (id) {
    case "gmail":
    case "outlook":
      return <MailIcon className={cls} />;
    case "quickbooks":
    case "paypal":
      return <CoinIcon className={cls} />;
    case "hubspot":
      return <CrmIcon className={cls} />;
    case "docusign":
      return <SignatureIcon className={cls} />;
    case "slack":
    case "teams":
      return <ChatIcon className={cls} />;
    case "canva":
      return <PaletteIcon className={cls} />;
    case "onedrive":
      return <FolderIcon className={cls} />;
    case "excel":
      return <SpreadsheetIcon className={cls} />;
    default:
      return <PlugIcon className={cls} />;
  }
}

function svgProps(className: string) {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function MailIcon({ className }: { className: string }) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function CoinIcon({ className }: { className: string }) {
  return (
    <svg {...svgProps(className)}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

function CrmIcon({ className }: { className: string }) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="6" r="2" />
      <path d="M14 14a4 4 0 0 1 7 2" />
    </svg>
  );
}

function SignatureIcon({ className }: { className: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 17c2-4 4-6 6-6s2 4 4 4 3-4 5-4 3 2 3 4" />
      <path d="M3 21h18" />
    </svg>
  );
}

function ChatIcon({ className }: { className: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 4A8 8 0 0 1 21 12Z" />
    </svg>
  );
}

function PaletteIcon({ className }: { className: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 9 9 0 0 0-9-9Z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}

function PlugIcon({ className }: { className: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M9 7V3M15 7V3" />
      <rect x="6" y="7" width="12" height="6" rx="1" />
      <path d="M12 13v4a4 4 0 0 1-4 4" />
    </svg>
  );
}

function FolderIcon({ className }: { className: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function SpreadsheetIcon({ className }: { className: string }) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 10h18M3 16h18M9 4v16M15 4v16" />
    </svg>
  );
}
