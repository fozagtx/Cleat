import { LandingHeader } from "@/components/landing/header";
import { LandingHero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingFeatures } from "@/components/landing/features";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFooter } from "@/components/landing/footer";

export function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main className="flex flex-col bg-[var(--landing-bg)]">
        <LandingHero />
        <HowItWorks />
        <LandingFeatures />
        <LandingFaq />
      </main>
      <LandingFooter />
    </>
  );
}
