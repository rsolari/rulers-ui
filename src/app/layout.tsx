import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, EB_Garamond } from "next/font/google";
import "./globals.css";
import { DevTools } from "./dev-tools";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rulers",
    template: "%s | Rulers",
  },
  description:
    "Track your game of Rulers: conquest, politics, and civilization-building",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://rulers.tally.xyz"
  ),
  openGraph: {
    title: "Rulers",
    description:
      "Track your game of Rulers: conquest, politics, and civilization-building",
    siteName: "Rulers",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Rulers — Conquest. Politics. Civilization.",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rulers",
    description:
      "Track your game of Rulers: conquest, politics, and civilization-building",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Rulers",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${cormorant.variable} ${ebGaramond.variable}`}
    >
      <body className="min-h-screen relative">
        <div className="relative z-10">
          {children}
        </div>
        <DevTools />
      </body>
    </html>
  );
}
