import { AnalyzerClient } from "@/components/AnalyzerClient";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50">
          Analisis Screenshot Chart XAUUSD
        </h1>
        <p className="text-sm text-zinc-400 max-w-3xl">
          Unggah screenshot TradingView <strong className="text-zinc-200">H1, M15, dan M5</strong>. Server mengevaluasi kerangka{" "}
          <span className="text-amber-300">Trend → Area → Pattern → Trigger → Entry/Exit</span> dengan playbook ter-cache dan menghitung ukuran lot serta Risk-to-Reward secara deterministik.
        </p>
      </div>

      <AnalyzerClient />
    </div>
  );
}
