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
  title: "Cleat",
  description: "Confidential check on one invoice. Stop sending your whole customer list just to finance it.",
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
