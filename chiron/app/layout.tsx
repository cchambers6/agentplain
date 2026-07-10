import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Wordmark face: Cormorant Garamond Bold, self-hosted (OFL — license in
// app/fonts/OFL.txt). Used for the "Chiron" wordmark and headings only.
const wordmark = localFont({
  src: "./fonts/CormorantGaramond-Bold.ttf",
  weight: "700",
  variable: "--font-wordmark",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chiron",
  description:
    "One wise tutor over everything your homeschool already uses.",
  robots: { index: false, follow: false }, // POC — not for indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={wordmark.variable}>
      <body>{children}</body>
    </html>
  );
}
