import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CapacitorBoot } from "@/components/CapacitorBoot";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gold Chart Analyzer — Analisis XAUUSD Multi-Timeframe",
  description:
    "Alat bantu analisis screenshot TradingView XAUUSD (H1, M15, M5) dengan playbook terstruktur, prompt caching, dan kalkulator risiko deterministik.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 selection:bg-amber-500/30 selection:text-amber-200 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <CapacitorBoot />
        <Navbar />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          {children}
        </main>
        <DisclaimerBanner />
      </body>
    </html>
  );
}
