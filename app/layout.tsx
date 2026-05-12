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
    "A pre-trained AI agent fleet for professional-services firms. Realty first; mortgage, insurance, property mgmt, title & escrow, recruiting, home services, CPA / tax, law, and RIA on the roadmap.",
  metadataBase: new URL("https://agentplain.com"),
  openGraph: {
    title: tokens.wordmark,
    description:
      "Intelligence. Rooted in reality. A pre-trained AI agent fleet for professional-services firms — realty first.",
    url: "https://agentplain.com",
    siteName: tokens.wordmark,
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
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
