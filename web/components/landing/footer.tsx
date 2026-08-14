import { TextLink } from "@/components/landing/chrome";
import { WalletReviewButton } from "@/components/wallet-review-button";

const product = [
  { name: "Features", href: "#features" },
  { name: "How it works", href: "#how" },
  { name: "Open your invoices", href: "/borrower" },
];

const help = [
  { name: "Questions", href: "#faq" },
  { name: "History", href: "/activity" },
];

export function LandingFooter() {
  return (
    <footer className="bg-[var(--landing-card)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20 lg:px-[30px]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
          <p className="hidden text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-[var(--landing-slogan)] sm:block">
            Check one
            <br />
            Keep the book
            <br />
            Fund it
          </p>
          <div className="grid grid-cols-2 gap-6 sm:gap-8">
            <div>
              <h3 className="text-sm">Product</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <WalletReviewButton className="text-sm text-[var(--landing-muted-fg)] transition-colors hover:text-[var(--landing-fg)]" />
                </li>
                {product.map((item) => (
                  <li key={item.name}>
                    <TextLink className="text-sm text-[var(--landing-muted-fg)] transition-colors hover:text-[var(--landing-fg)]" href={item.href}>
                      {item.name}
                    </TextLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm">Help</h3>
              <ul className="mt-4 space-y-3">
                {help.map((item) => (
                  <li key={item.name}>
                    <TextLink className="text-sm text-[var(--landing-muted-fg)] transition-colors hover:text-[var(--landing-fg)]" href={item.href}>
                      {item.name}
                    </TextLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-12 text-xs text-[var(--landing-muted-fg)]">Cleat. Keep the customer list.</p>
      </div>
    </footer>
  );
}
