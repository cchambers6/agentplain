import type { Metadata } from "next";
import { Anton, Archivo, JetBrains_Mono } from "next/font/google";
import "./styles.css";

/* Direction 4 loads its own fonts so the showcase is fully self-contained and
   never depends on the main brand fonts. Condensed heavy display (Anton) +
   industrial workhorse body (Archivo) + monospace for stamps and spec codes. */
const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-d4-anton",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-d4-archivo",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-d4-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Direction 4 — Bold Working-Class",
  description:
    "Design exploration: high-contrast, work-boots-and-coffee energy. Bold blocks of color, heavy borders, stamps and badges. Tools that feel like tools.",
  robots: { index: false, follow: false },
};

export default function Direction4Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`d4 ${anton.variable} ${archivo.variable} ${mono.variable}`}>
      {children}
    </div>
  );
}
