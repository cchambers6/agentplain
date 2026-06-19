import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal/PortalShell";
import { getPortalContext } from "@/lib/portal/server";

export const dynamic = "force-dynamic";

interface PortalLayoutProps {
  children: React.ReactNode;
  params: Promise<{ customerSlug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ customerSlug: string }>;
}): Promise<Metadata> {
  const { customerSlug } = await params;
  const ctx = await getPortalContext(customerSlug);
  const name = ctx?.brand.brandName ?? "Client portal";
  return {
    title: `${name} — Client portal`,
    // Private surface — never index a customer's client portal.
    robots: { index: false, follow: false },
  };
}

/**
 * Public portal chrome. Resolves the portal by slug and 404s when it's unknown
 * or disabled — no client ever lands on a half-built portal. Renders the
 * OWNER's brand around whatever the child page provides.
 */
export default async function PortalLayout({ children, params }: PortalLayoutProps) {
  const { customerSlug } = await params;
  const ctx = await getPortalContext(customerSlug);
  if (!ctx) notFound();

  return (
    <PortalShell brand={ctx.brand} clientName={ctx.signedIn?.name ?? undefined}>
      {children}
    </PortalShell>
  );
}
