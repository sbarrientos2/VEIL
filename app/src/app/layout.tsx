import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "VEIL | Private Prediction Markets",
  description:
    "Place encrypted bets on future events. Your position stays hidden until resolution.",
  keywords: ["prediction market", "crypto", "solana", "privacy", "encrypted betting"],
  openGraph: {
    title: "VEIL | Private Prediction Markets",
    description: "Place encrypted bets on future events. Your position stays hidden until resolution.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Navigation />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
