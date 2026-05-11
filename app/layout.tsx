import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
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
  title: "agentplain — Intelligence. Rooted in reality.",
  description:
    "A pre-trained AI agent fleet for professional-services firms. Realty first; mortgage, insurance, property mgmt, title & escrow, recruiting, home services, CPA / tax, law, and RIA on the roadmap.",
  metadataBase: new URL("https://agentplain.com"),
  openGraph: {
    title: "agentplain",
    description:
      "Intelligence. Rooted in reality. A pre-trained AI agent fleet for professional-services firms — realty first.",
    url: "https://agentplain.com",
    siteName: "agentplain",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
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
