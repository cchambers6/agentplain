import type { Metadata } from "next";
import Logo from "@/components/brand/Logo";

// Product surface chrome. Per product_spec §9: customer surfaces are calm,
// dense, specific. No exclamation points, no emoji, no marketing voice.

export const metadata: Metadata = {
  title: "agentplain",
  robots: { index: false, follow: false },
};

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-rule bg-paper">
        <div className="container-wide flex h-14 items-center justify-between">
          <Logo size="sm" />
          <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            v1 · phase 1
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-rule">
        <div className="container-wide flex h-10 items-center justify-between text-[11px] font-mono tracking-wide text-mute">
          <Logo size="sm" asLink={false} />
          <span>{new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
