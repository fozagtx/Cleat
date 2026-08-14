import { TextLink, primaryBtn, secondaryBtn } from "@/components/landing/chrome";
import { CheckMockup } from "@/components/landing/mockups";
import { PhotoStage } from "@/components/landing/photo-stage";
import { WalletReviewButton } from "@/components/wallet-review-button";

export function LandingHero() {
  return (
    <div className="relative overflow-hidden pb-8 pt-24">
      <div className="px-4 sm:px-8 lg:px-[30px]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl space-y-6 lg:max-w-none">
            <h1 className="text-4xl font-normal leading-[0.98] tracking-[-0.5px] text-balance sm:text-5xl lg:text-[3.75rem] xl:text-[4.25rem]">
              Customer, amount, and the rest of the book stay{" "}
              <span className="text-[var(--landing-brand)]">confidential</span>.
            </h1>
            <p className="max-w-lg text-base leading-8 text-[var(--landing-muted-fg)] sm:text-xl">
              A lender asks if this one invoice is already pledged as collateral. They get yes or no. They never see the customer list.
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <WalletReviewButton className={primaryBtn} />
              <TextLink className={secondaryBtn} href="/borrower">
                Open your invoices
              </TextLink>
            </div>
          </div>
          <div className="overflow-hidden rounded-[10px]">
            <PhotoStage src="/landing/hero.jpg">
              <CheckMockup />
            </PhotoStage>
          </div>
        </div>
      </div>
    </div>
  );
}
