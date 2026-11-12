import { AlertTriangle } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs text-zinc-400">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-amber-300 font-medium">Disclaimer:</strong>{" "}
            Gold Chart Analyzer adalah alat bantu analisis teknikal dan manajemen risiko berbasis AI,{" "}
            <strong className="text-zinc-200">bukan nasihat keuangan</strong>, ajakan transaksi, ataupun jaminan profit. Perdagangan XAUUSD memiliki risiko tinggi; seluruh keputusan eksekusi sepenuhnya merupakan tanggung jawab Anda pribadi.
          </p>
        </div>
      </div>
    </footer>
  );
}
