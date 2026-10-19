import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./store.css";

const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
  variable: "--font-display",
  display: "swap",
});
const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Yamoura | Beauty end Luxury",
  description: "Cosmétiques authentiques sélectionnés avec soin, livrés partout au Maroc. Paiement à la livraison.",
  openGraph: {
    title: "Yamoura | Beauty end Luxury",
    description: "Skin care, maquillage, parfums et soins capillaires authentiques, livrés partout au Maroc.",
    images: ["/images/beauty-hero.png"],
    locale: "fr_MA",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf3f0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable}`}>
      <body>
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
