import type { Metadata } from "next";
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
    "agentplain lifts up local businesses by doing the work that takes their time and money away from the people they serve. A fleet of capable AI partners across ten verticals — real estate, mortgage, insurance, property management, title & escrow, recruiting, home services, CPA / tax, law, and RIA. Intelligence rooted in reality.",
  metadataBase: new URL("https://agentplain.com"),
  openGraph: {
    title: tokens.wordmark,
    description:
      "We lift up local businesses by doing the work that takes their time and money away from the people they serve. Intelligence rooted in reality.",
    url: "https://agentplain.com",
    siteName: tokens.wordmark,
    type: "website",
    images: [
      {
        url: "/brand/direction-13/og-image.png",
        width: 1200,
        height: 630,
        alt: `${tokens.wordmark} — ${tokens.tagline}`,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
  // Favicons + touch icons — the public robot-dog brand mark (ratified
  // 2026-06-06). direction-13 is the higher-fidelity hound shipping candidate
  // wired as the production default while the human-pixel-artist v2 is
  // commissioned separately. Flip the direction-N path here to change it.
  icons: {
    icon: [
      { url: "/brand/direction-13/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/direction-13/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/direction-13/logo-icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/brand/direction-13/favicon.ico",
    apple: { url: "/brand/direction-13/apple-touch-icon.png", sizes: "180x180" },
  },
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
