import type { Metadata } from "next";
import { ApAppShell } from "@/components/ui/ap";

// Product surface chrome. Per design language §3.1: no sidebar; header +
// optional workspace strip + main + footer. Per §1.8 + §5.2: no customer-
// facing "v1 · phase 1" / "alpha" / "beta" stamps — internal product-
// development language never reaches the customer surface.

export const metadata: Metadata = {
  title: "agentplain",
  robots: { index: false, follow: false },
};

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ApAppShell>{children}</ApAppShell>;
}
