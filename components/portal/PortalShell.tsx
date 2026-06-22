import * as React from "react";
import type { PortalBrand } from "@/lib/portal/config";

/**
 * The branded portal chrome. Renders the OWNER's brand — name, logo, accent
 * color (pulled from PortalConfig) — not agentplain's. The accent color is a
 * per-customer runtime value, so it's applied via inline style + a CSS custom
 * property (`--portal-accent`) that inner components read; layout/typography
 * use the global paper/ink tokens. A small, quiet "secured by agentplain" line
 * sits in the footer — the owner's clients see the owner's business, with
 * agentplain as the plumbing.
 */
export function PortalShell({
  brand,
  clientName,
  children,
}: {
  brand: PortalBrand;
  clientName?: string | null;
  children: React.ReactNode;
}) {
  const accent = sanitizeColor(brand.brandColor);
  return (
    <div
      className="min-h-screen bg-paper text-ink"
      style={{ ["--portal-accent" as string]: accent }}
    >
      <header className="border-b border-rule" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          {brand.brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.brandLogoUrl}
              alt={brand.brandName}
              className="h-9 w-auto"
              style={{ maxHeight: 36 }}
            />
          ) : (
            <span
              className="font-display text-xl leading-none"
              style={{ color: accent }}
            >
              {brand.brandName}
            </span>
          )}
          <span className="ml-auto text-sm text-mute">Client portal</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        {clientName ? (
          <p className="mb-6 text-sm text-mute">Signed in as {clientName}</p>
        ) : null}
        {children}
      </main>

      <footer className="mx-auto max-w-3xl px-5 py-8 text-xs text-mute">
        <p>
          This portal is provided by {brand.brandName}. Your messages and
          documents are private to {brand.brandName}.
        </p>
        <p className="mt-1 opacity-70">Secured by agentplain.</p>
      </footer>
    </div>
  );
}

/** Accept only a safe hex color; fall back to agentplain clay otherwise so a
 *  bad value can never inject CSS. */
function sanitizeColor(raw: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(raw.trim()) ? raw.trim() : "#B85540";
}

/** A primary action button rendered in the portal accent color. */
export function PortalAccentButton({
  children,
  type = "submit",
  disabled,
}: {
  children: React.ReactNode;
  type?: "submit" | "button";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      style={{ backgroundColor: "var(--portal-accent, #B85540)" }}
    >
      {children}
    </button>
  );
}
