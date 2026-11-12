"use client";

import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Layers,
  PauseCircle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type {
  AnalyzeResponsePayload,
  RiskCalculationResult,
  TimeframeKey,
  UserRiskSettings,
} from "@/lib/schema";

interface AnalysisResultViewProps {
  result: AnalyzeResponsePayload;
  liveRisk: RiskCalculationResult;
  settings: UserRiskSettings;
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatLot(lot: number | null, minLot: number, lotStep: number): string {
  if (lot === null || !Number.isFinite(lot)) return "—";
  const decimals = Math.max(
    minLot.toString().split(".")[1]?.length ?? 2,
    lotStep.toString().split(".")[1]?.length ?? 2,
    2
  );
  return lot.toFixed(Math.min(4, decimals));
}

export function AnalysisResultView({
  result,
  liveRisk,
  settings,
}: AnalysisResultViewProps) {
  const { analysis, meta } = result;
  const currency = settings.accountCurrencyLabel || "USD";

  const biasStyles =
    analysis.bias === "BUY"
      ? {
          container:
            "border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-950/30 to-zinc-900",
          badge: "bg-emerald-500 text-zinc-950",
          accent: "text-emerald-400",
          label: "BUY",
          Icon: TrendingUp,
        }
      : analysis.bias === "SELL"
        ? {
            container:
              "border-rose-500/40 bg-gradient-to-br from-rose-500/15 via-rose-950/30 to-zinc-900",
            badge: "bg-rose-500 text-white",
            accent: "text-rose-400",
            label: "SELL",
            Icon: TrendingDown,
          }
        : {
            container:
              "border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-950",
            badge: "bg-amber-400 text-zinc-950",
            accent: "text-amber-300",
            label: "NO TRADE",
            Icon: PauseCircle,
          };

  const DecisionIcon = biasStyles.Icon;

  const entryZoneText =
    analysis.zonaEntry.min !== null && analysis.zonaEntry.max !== null
      ? `${formatPrice(analysis.zonaEntry.min)} – ${formatPrice(analysis.zonaEntry.max)}`
      : formatPrice(liveRisk.entryPrice);

  return (
    <div className="space-y-5">
      {/* Kartu Keputusan Besar */}
      <section className={`rounded-2xl border p-5 sm:p-6 ${biasStyles.container}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-lg sm:text-xl font-bold tracking-wide ${biasStyles.badge}`}
              >
                <DecisionIcon className="h-5 w-5" />
                {biasStyles.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-300">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                {analysis.estimasiHold}
              </span>
              {meta.isFollowUp && (
                <span className="inline-flex items-center rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-300">
                  Analisis Lanjutan
                </span>
              )}
            </div>

            <p className="text-sm sm:text-base text-zinc-100 leading-relaxed max-w-3xl">
              {analysis.statusPasar}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {(["H1", "M15", "M5"] as TimeframeKey[]).map((tf) => {
                const available = meta.uploadedTimeframes.includes(tf);
                return (
                  <span
                    key={tf}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                      available
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-700 bg-zinc-900 text-zinc-500 line-through"
                    }`}
                  >
                    {tf} {available ? "Tersedia" : "Tidak Ada"}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-zinc-800/90 bg-zinc-950/75 px-5 py-4 min-w-[180px] text-left md:text-right">
            <div className="text-xs text-zinc-400 uppercase tracking-wider">
              Tingkat Keyakinan
            </div>
            <div className={`text-3xl font-bold font-mono mt-1 ${biasStyles.accent}`}>
              {analysis.tingkatKeyakinan}%
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-800 mt-2 overflow-hidden">
              <div
                className={`h-full ${
                  analysis.bias === "BUY"
                    ? "bg-emerald-400"
                    : analysis.bias === "SELL"
                      ? "bg-rose-400"
                      : "bg-amber-400"
                }`}
                style={{ width: `${analysis.tingkatKeyakinan}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Peringatan Risiko & Validasi Deterministik */}
      {(liveRisk.minLotWarning || liveRisk.rrBelowMinimum || !liveRisk.geometryValid) && (
        <div className="space-y-2.5">
          {liveRisk.minLotWarning && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">
                  Peringatan Lot Minimum Broker Melebihi Batas Risiko
                </p>
                <p className="text-xs sm:text-sm text-amber-200/90 mt-1 leading-relaxed">
                  {liveRisk.minLotWarning}
                </p>
              </div>
            </div>
          )}

          {liveRisk.rrBelowMinimum && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              <AlertOctagon className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-300">
                  Risk-to-Reward Di Bawah Aturan Playbook (Minimal 1:2)
                </p>
                <p className="text-xs sm:text-sm text-rose-200/90 mt-0.5">
                  RR TP1 terukur <strong>1 : {liveRisk.rr1?.toFixed(2)}</strong>. Sesuai aturan playbook, sebaiknya lewati setup ini atau tunggu retracement ke harga yang memberi SL lebih ketat.
                </p>
              </div>
            </div>
          )}

          {!liveRisk.geometryValid && liveRisk.geometryWarning && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              <AlertOctagon className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-300">Anomali Geometri Level Harga</p>
                <p className="text-xs sm:text-sm mt-0.5">{liveRisk.geometryWarning}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabel Level Harga & Kalkulasi Lot Deterministik */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            Level Harga &amp; Sizing Posisi (Deterministik)
          </h3>
          <span className="text-[11px] text-zinc-400 font-mono">
            Saldo: {formatMoney(settings.accountBalance, currency)} · Risk Target: {settings.riskPercent}% · Min Lot: {settings.minLot}
          </span>
        </div>

        <div className="sm:hidden divide-y divide-zinc-800/70">
          {[
            {
              label: "Zona Entry",
              value: entryZoneText,
              valueClass: "text-zinc-100",
              note: analysis.zonaEntry.keterangan,
            },
            {
              label: "Entry Ideal",
              value: formatPrice(liveRisk.entryPrice),
              valueClass: "text-amber-300 font-semibold",
              note: "Titik acuan kalkulasi SL, TP, dan lot",
            },
            {
              label: "Stop Loss (SL)",
              value: formatPrice(analysis.stopLoss),
              valueClass: "text-rose-400 font-semibold",
              note:
                liveRisk.slDistancePoints !== null
                  ? `Jarak ${liveRisk.slDistancePoints.toFixed(2)} poin harga XAUUSD`
                  : "Di balik struktur HL/LH",
            },
            {
              label: "Take Profit 1",
              value: formatPrice(analysis.takeProfit1),
              valueClass: "text-emerald-400 font-semibold",
              note:
                liveRisk.rr1 !== null
                  ? `RR 1 : ${liveRisk.rr1.toFixed(2)} · +${formatMoney(liveRisk.potentialProfitTp1, currency)}`
                  : "Target likuiditas pertama",
            },
            {
              label: "Take Profit 2",
              value: formatPrice(analysis.takeProfit2),
              valueClass: "text-emerald-300 font-semibold",
              note:
                liveRisk.rr2 !== null
                  ? `RR 1 : ${liveRisk.rr2.toFixed(2)} · +${formatMoney(liveRisk.potentialProfitTp2, currency)}`
                  : "Target likuiditas lanjutan",
            },
            {
              label: "Lot Rekomendasi",
              value: liveRisk.isCalculable
                ? `${formatLot(liveRisk.recommendedLot, settings.minLot, settings.lotStep)} lot`
                : "—",
              valueClass: "text-amber-300 text-base font-bold",
              note: liveRisk.isCalculable
                ? `Risiko aktual: ${formatMoney(liveRisk.actualRiskAmount, currency)} (${liveRisk.actualRiskPercent?.toFixed(2)}%)`
                : (liveRisk.reasonIfNotCalculable ?? "—"),
            },
          ].map((row) => (
            <div key={row.label} className="p-4 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-zinc-400">{row.label}</span>
                <span className={`font-mono text-sm ${row.valueClass}`}>{row.value}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{row.note}</p>
            </div>
          ))}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-950/70 text-xs uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Parameter</th>
                <th className="px-4 py-3 font-medium">Nilai / Harga</th>
                <th className="px-4 py-3 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              <tr>
                <td className="px-4 py-3 text-zinc-300 font-medium">Zona Entry</td>
                <td className="px-4 py-3 font-mono text-zinc-100">{entryZoneText}</td>
                <td className="px-4 py-3 text-xs text-zinc-400">{analysis.zonaEntry.keterangan}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-zinc-300 font-medium">Entry Ideal (Acuan Kalkulasi)</td>
                <td className="px-4 py-3 font-mono text-amber-300 font-semibold">
                  {formatPrice(liveRisk.entryPrice)}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  Titik referensi perhitungan SL, TP, dan lot
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-zinc-300 font-medium">Stop Loss (SL)</td>
                <td className="px-4 py-3 font-mono text-rose-400 font-semibold">
                  {formatPrice(analysis.stopLoss)}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {liveRisk.slDistancePoints !== null
                    ? `Jarak ${liveRisk.slDistancePoints.toFixed(2)} poin harga XAUUSD`
                    : "Di balik struktur HL/LH"}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-zinc-300 font-medium">Take Profit 1 (TP1)</td>
                <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                  {formatPrice(analysis.takeProfit1)}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {liveRisk.rr1 !== null
                    ? `RR 1 : ${liveRisk.rr1.toFixed(2)} · Potensi +${formatMoney(liveRisk.potentialProfitTp1, currency)}`
                    : "Target likuiditas pertama"}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-zinc-300 font-medium">Take Profit 2 (TP2)</td>
                <td className="px-4 py-3 font-mono text-emerald-300 font-semibold">
                  {formatPrice(analysis.takeProfit2)}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {liveRisk.rr2 !== null
                    ? `RR 1 : ${liveRisk.rr2.toFixed(2)} · Potensi +${formatMoney(liveRisk.potentialProfitTp2, currency)}`
                    : "Target likuiditas lanjutan"}
                </td>
              </tr>
              <tr className="bg-zinc-950/50">
                <td className="px-4 py-3.5 text-amber-300 font-semibold">Lot Rekomendasi</td>
                <td className="px-4 py-3.5 font-mono text-lg font-bold text-amber-300">
                  {liveRisk.isCalculable
                    ? `${formatLot(liveRisk.recommendedLot, settings.minLot, settings.lotStep)} lot`
                    : "—"}
                </td>
                <td className="px-4 py-3.5 text-xs text-zinc-300">
                  {liveRisk.isCalculable ? (
                    <span>
                      Risiko aktual:{" "}
                      <strong
                        className={
                          liveRisk.exceedsRiskByMinLot ? "text-amber-300" : "text-emerald-300"
                        }
                      >
                        {formatMoney(liveRisk.actualRiskAmount, currency)} ({liveRisk.actualRiskPercent?.toFixed(2)}%)
                      </strong>{" "}
                      (target {formatMoney(liveRisk.targetRiskAmount, currency)})
                    </span>
                  ) : (
                    liveRisk.reasonIfNotCalculable
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Ringkasan Multi-Timeframe */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {(["H1", "M15", "M5"] as TimeframeKey[]).map((tf) => {
          const available = meta.uploadedTimeframes.includes(tf);
          return (
            <div
              key={tf}
              className={`rounded-2xl border p-4 space-y-2 ${
                available
                  ? "border-zinc-800 bg-zinc-900/50"
                  : "border-zinc-800/60 bg-zinc-950/60 opacity-80"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wide text-amber-300 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Ringkasan {tf}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    available
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-700 bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {available ? "Chart Dianalisis" : "Tidak Tersedia"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                {analysis.ringkasanTimeframe[tf]}
              </p>
            </div>
          );
        })}
      </section>

      {/* Alasan Utama & Syarat / Kondisi Exit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Alasan Utama (Maks. 5 Poin)
          </h3>
          <ul className="space-y-2">
            {analysis.alasanUtama.map((reason, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-300 leading-relaxed"
              >
                <span className="h-5 w-5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-zinc-100">Kondisi Exit &amp; Invalidasi</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {analysis.kondisiExit}
            </p>
          </div>

          {(analysis.bias === "NO_TRADE" || analysis.syaratSebelumEntry.length > 0) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                {analysis.bias === "NO_TRADE"
                  ? "Syarat Wajib Sebelum Entry"
                  : "Catatan Pengawasan Sebelum Eksekusi"}
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm text-zinc-200">
                {analysis.syaratSebelumEntry.map((cond, idx) => (
                  <li key={idx}>{cond}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Catatan Fundamental & Metadata */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Globe className="h-4 w-4 text-sky-400" />
            Konteks Fundamental XAUUSD
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`px-2 py-0.5 rounded-md border ${
                analysis.catatanFundamental.digunakan
                  ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400"
              }`}
            >
              {analysis.catatanFundamental.digunakan
                ? meta.fundamentalFromCache
                  ? "Data Fundamental (Cache Server 20 Menit)"
                  : "Data Fundamental (Live Web Search)"
                : "Teknikal Murni"}
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
          {analysis.catatanFundamental.ringkasan}
        </p>

        {analysis.catatanFundamental.sumber.length > 0 && (
          <div className="pt-1 space-y-1.5">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Sumber Terverifikasi:
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.catatanFundamental.sumber.map((src, idx) => (
                <a
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-950/70 hover:border-sky-500/40 px-2.5 py-1 text-xs text-sky-300 transition-colors"
                >
                  <span className="text-zinc-500 font-mono text-[10px]">{src.tanggal}</span>
                  <span className="truncate max-w-[220px]">{src.judul}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 font-mono">
          <span>
            Model: {meta.provider}/{meta.modelName} · Dianalisis:{" "}
            {new Date(meta.analyzedAt).toLocaleString("id-ID")}
          </span>
          {meta.tokenUsage && (
            <span>
              Token In: {meta.tokenUsage.inputTokens ?? "—"}
              {meta.tokenUsage.cachedInputTokens
                ? ` (Cached: ${meta.tokenUsage.cachedInputTokens})`
                : ""}{" "}
              · Out: {meta.tokenUsage.outputTokens ?? "—"}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

