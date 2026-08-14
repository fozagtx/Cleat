import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/app/providers";
import { LandingThemeProvider } from "@/components/landing/theme";
import { SmoothScroll } from "@/components/smooth-scroll";
import "lenis/dist/lenis.css";
import "./globals.css";
import "@/styles/landing.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://cleat-finance.vercel.app"),
  title: "Cleat | Private invoice checks",
  description: "Check one invoice without sharing the whole customer list.",
  openGraph: {
    description: "Check one invoice without sharing the whole customer list.",
    siteName: "Cleat",
    title: "Cleat | Private invoice checks",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    description: "Check one invoice without sharing the whole customer list.",
    title: "Cleat | Private invoice checks",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${plex.variable}`}>
        <Providers>
          <SmoothScroll>
            <LandingThemeProvider className={geist.className}>{children}</LandingThemeProvider>
          </SmoothScroll>
        </Providers>
      </body>
    </html>
  );
}
