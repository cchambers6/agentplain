import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chiron",
  description:
    "Personal classical education orchestration for homeschool families.",
  robots: { index: false, follow: false }, // POC — not for indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
