import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PlainoWidget from "@/components/marketing/PlainoWidget";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      {/* Floating "chat with Plaino" widget — mounted once here so it rides
          every marketing route (home, pricing, custom, /verticals, the ten
          vertical pages + /general, about, privacy, terms, security). */}
      <PlainoWidget />
    </>
  );
}
