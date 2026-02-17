import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rulers - Game Tracker",
  description: "Track your game of Rulers: conquest, politics, and civilization-building",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen relative">
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
