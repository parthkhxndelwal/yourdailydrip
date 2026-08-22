import { createFileRoute } from "@tanstack/react-router";

import { BrandStatement } from "@/components/landing/BrandStatement";
import { FaqSection } from "@/components/landing/FaqSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { IngredientSection } from "@/components/landing/IngredientSection";
import { PreLaunchBenefits } from "@/components/landing/PreLaunchBenefits";
import { PromotionBanner } from "@/components/landing/PromotionBanner";
import { TrustSection } from "@/components/landing/TrustSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Daily Drip — Advanced Hair Density Serum | Pre-Launch Sale",
      },
      {
        name: "description",
        content:
          "Science-backed hair density serum powered by 14 active ingredients. Pre-launch flat 20% off — ₹559 instead of ₹699. Dermatologically tested, made for Indian hair.",
      },
      {
        property: "og:title",
        content: "Daily Drip — Advanced Hair Density Serum | Pre-Launch Sale",
      },
      {
        property: "og:description",
        content:
          "Science-backed hair density serum powered by 14 active ingredients. Pre-launch flat 20% off — ₹559 instead of ₹699. Dermatologically tested, made for Indian hair.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <HeroSection />
      <PreLaunchBenefits />
      <IngredientSection />
      <PromotionBanner />
      <TrustSection />
      <BrandStatement />
      <FaqSection />
    </>
  );
}
