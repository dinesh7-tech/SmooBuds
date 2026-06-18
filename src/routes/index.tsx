import { createFileRoute } from "@tanstack/react-router";
import { PageLoader } from "@/components/smoobuds/Loader";
import { CursorGlow } from "@/components/smoobuds/CursorGlow";
import { Navbar } from "@/components/smoobuds/Navbar";
import { Hero } from "@/components/smoobuds/Hero";
import { BestSellers } from "@/components/smoobuds/BestSellers";
import { Story } from "@/components/smoobuds/Story";
import { IceCream } from "@/components/smoobuds/IceCream";
import { Shakes } from "@/components/smoobuds/Shakes";
import { StoreExperience } from "@/components/smoobuds/StoreExperience";
import { Gallery } from "@/components/smoobuds/Gallery";
import { Reviews } from "@/components/smoobuds/Reviews";
import { ReservationTable } from "@/components/smoobuds/ReservationTable";
import { Contact } from "@/components/smoobuds/Contact";
import { Footer } from "@/components/smoobuds/Footer";
import { MotionProvider } from "@/components/smoobuds/MotionToggle";

const TITLE = "SMOOBUDS Kakinada — Luxury Dessert Lounge | Handcrafted Desserts, Ice Cream & Shakes";
const DESCRIPTION =
  "Kakinada's premier luxury dessert lounge. Handcrafted desserts, premium ice creams and signature shakes — served in a cinematic, design-led space.";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "SMOOBUDS Kakinada",
  servesCuisine: ["Desserts", "Ice Cream", "Shakes", "Cafe"],
  priceRange: "₹₹",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Kakinada",
    addressRegion: "Andhra Pradesh",
    addressCountry: "IN",
  },
  url: "/",
  image: "/",
  description: DESCRIPTION,
  acceptsReservations: "True",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "Smoobuds, Smoobuds Kakinada, luxury desserts Kakinada, dessert lounge, ice cream Kakinada, shakes Kakinada, cafe Kakinada, handcrafted desserts",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { name: "theme-color", content: "#4F706B" },
      { name: "geo.region", content: "IN-AP" },
      { name: "geo.placename", content: "Kakinada" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "restaurant" },
      { property: "og:url", content: "/" },
      { property: "og:site_name", content: "SMOOBUDS Kakinada" },
      { property: "og:locale", content: "en_IN" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:site", content: "@smoobuds" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(jsonLd),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <MotionProvider>
      <div className="relative bg-cream">
        <PageLoader />
        <CursorGlow />
        <Navbar />
        <main>
          <Hero />
          <BestSellers />
          <Story />
          <IceCream />
          <Shakes />
          <StoreExperience />
          <Gallery />
          <Reviews />
          <ReservationTable />
          <Contact />
        </main>
        <Footer />
      </div>
    </MotionProvider>
  );
}
