import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { Nav } from "@/components/nav";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "{{APP_NAME}}",
  description: "Alpaca paper trading and market data dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const paper = process.env.APCA_PAPER !== "false";

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-dvh">
        <Nav paper={paper} />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
