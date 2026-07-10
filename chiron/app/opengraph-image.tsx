import { ImageResponse } from "next/og";

// Text-only OG card: wordmark + one-line tagline in the Chiron palette.
// No centaur mark until the illustrator-drawn one lands (public/brand/chiron/README.md).
// Edge runtime: the nodejs runtime for next/og hits a fileURLToPath bug on
// Windows builds; the fetch(new URL(...)) font pattern is the documented one.
export const runtime = "edge";
export const alt = "Chiron — one wise tutor over everything your homeschool already uses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const cormorantBold = await fetch(
    new URL("./fonts/CormorantGaramond-Bold.ttf", import.meta.url),
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F1E6",
          color: "#1E1B18",
        }}
      >
        <div
          style={{
            fontFamily: "Cormorant Garamond",
            fontSize: 160,
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          Chiron
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: "Cormorant Garamond",
            fontSize: 40,
            fontWeight: 700,
            color: "#5C4633",
          }}
        >
          One wise tutor over everything your homeschool already uses.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Cormorant Garamond",
          data: cormorantBold,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
