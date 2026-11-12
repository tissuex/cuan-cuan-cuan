"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CandlestickChart, Settings, Sparkles } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const isSettings = pathname === "/settings" || pathname === "/settings/";

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group min-h-[44px]">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:border-amber-400/60 transition-colors shrink-0">
            <CandlestickChart className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-zinc-100 text-sm sm:text-base">
                Gold Chart Analyzer
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                <Sparkles className="h-3 w-3" />
                XAUUSD
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Multi-Timeframe Playbook &amp; Kalkulator Risiko Deterministik
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/"
            className={`inline-flex items-center justify-center min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              !isSettings
                ? "bg-zinc-800 text-amber-300 border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            }`}
          >
            Analyzer
          </Link>
          <Link
            href="/settings"
            className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              isSettings
                ? "bg-zinc-800 text-amber-300 border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Pengaturan</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
