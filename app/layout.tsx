import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Inter, JetBrains_Mono } from "next/font/google";
import { tokens } from "@/lib/brand/tokens";
import "./globals.css";

const display = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${tokens.wordmark} — ${tokens.tagline}`,
    template: `${tokens.wordmark} — %s`,
  },
  description:
    "agentplain is the service layer on top of Claude for local businesses — a managed AI fleet across ten verticals. Intelligence rooted in reality.",
  metadataBase: new URL("https://agentplain.com"),
  openGraph: {
    title: tokens.wordmark,
    description:
      "We lift up local businesses by doing the work that takes their time and money away from the people they serve. Intelligence rooted in reality.",
    url: "https://agentplain.com",
    siteName: tokens.wordmark,
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  // PWA: name the app for the iOS "Add to Home Screen" splash. The web app
  // manifest (app/manifest.ts) and the apple-icon (app/apple-icon.png) are
  // auto-linked by the App Router; this names the installed experience.
  appleWebApp: {
    capable: true,
    title: tokens.wordmark,
    statusBarStyle: "default",
  },
};

// Brand theme colour for the browser/PWA chrome — Ink #1A1A1F, no blue.
// In Next 14 themeColor lives on the viewport export, not metadata.
export const viewport: Viewport = {
  themeColor: tokens.colors.ink.hex,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
