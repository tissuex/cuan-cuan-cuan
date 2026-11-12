"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  KeyRound,
  RotateCcw,
  Save,
  Server,
  Wifi,
} from "lucide-react";
import {
  apiFetch,
  getApiBaseUrlOverride,
  getEnvApiBaseUrl,
  isNativeMobileApp,
  resetApiBaseUrlOverride,
  saveApiBaseUrlOverride,
} from "@/lib/api";
import { calculateDeterministicRisk, sanitizeRiskSettings } from "@/lib/risk-calculator";
import {
  type AiAnalysis,
  type UserRiskSettings,
} from "@/lib/schema";
import {
  loadAppPasswordAsync,
  resetRiskSettings,
  saveAppPasswordAsync,
  saveRiskSettings,
  useRiskSettings,
} from "@/lib/settings-storage";

const SAMPLE_ANALYSIS_FOR_PREVIEW: AiAnalysis = {
  statusPasar: "Simulasi perhitungan risiko",
  bias: "BUY",
  ringkasanTimeframe: { H1: "-", M15: "-", M5: "-" },
  zonaEntry: { min: 2650, max: 2652, hargaIdeal: 2650, keterangan: "Simulasi" },
  stopLoss: 2645,
  takeProfit1: 2660,
  takeProfit2: 2665,
  estimasiHold: "-",
  kondisiExit: "-",
  tingkatKeyakinan: 80,
  alasanUtama: ["Simulasi"],
  syaratSebelumEntry: [],
  catatanFundamental: { digunakan: false, ringkasan: "-", sumber: [] },
};

const emptySubscribe = () => () => {};

export default function SettingsPage() {
  const storedSettings = useRiskSettings();
  const [draftForm, setDraftForm] = useState<UserRiskSettings | null>(null);
  const [simulatedSlPoints, setSimulatedSlPoints] = useState<number>(5);
  const [savedNotice, setSavedNotice] = useState(false);

  // Pengaturan URL Server Vercel & APP_PASSWORD (disimpan di Capacitor Preferences)
  const isNative = useSyncExternalStore(emptySubscribe, isNativeMobileApp, () => false);
  const envServerUrl = getEnvApiBaseUrl();
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [serverSaveMessage, setServerSaveMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [testingServer, setTestingServer] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  useEffect(() => {
    let active = true;

    getApiBaseUrlOverride().then((override) => {
      if (active) setServerUrlInput(override);
    });
    loadAppPasswordAsync().then((pwd) => {
      if (active) setPasswordInput(pwd);
    });

    return () => {
      active = false;
    };
  }, []);

  const form = draftForm ?? storedSettings;
  const sanitized = useMemo(() => sanitizeRiskSettings(form), [form]);

  const simulation = useMemo(() => {
    const slDist =
      Number.isFinite(simulatedSlPoints) && simulatedSlPoints > 0
        ? simulatedSlPoints
        : 5;
    const mockAnalysis: AiAnalysis = {
      ...SAMPLE_ANALYSIS_FOR_PREVIEW,
      stopLoss: 2650 - slDist,
      takeProfit1: 2650 + slDist * 2,
      takeProfit2: 2650 + slDist * 3,
    };
    return calculateDeterministicRisk(mockAnalysis, sanitized);
  }, [sanitized, simulatedSlPoints]);

  const updateForm = (updater: (prev: UserRiskSettings) => UserRiskSettings) => {
    setDraftForm((prev) => updater(prev ?? storedSettings));
  };

  const handleSaveRisk = (e: React.FormEvent) => {
    e.preventDefault();
    saveRiskSettings(form);
    setDraftForm(null);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleResetRisk = () => {
    resetRiskSettings();
    setDraftForm(null);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleSaveServerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setServerSaveMessage(null);

    try {
      const normalized = await saveApiBaseUrlOverride(serverUrlInput);
      setServerUrlInput(normalized);
      await saveAppPasswordAsync(passwordInput);
      setServerSaveMessage(
        normalized
          ? `URL server & password tersimpan (${normalized}).`
          : "Override URL dikosongkan; memakai default aplikasi."
      );
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan server."
      );
    }
  };

  const handleResetServerUrl = async () => {
    setServerError(null);
    setServerSaveMessage(null);
    await resetApiBaseUrlOverride();
    setServerUrlInput("");
    setServerSaveMessage(
      envServerUrl
        ? `Dikembalikan ke URL bawaan build (${envServerUrl}).`
        : "URL server kustom dihapus (mode relatif web)."
    );
  };

  const handleTestConnection = async () => {
    setServerError(null);
    setServerSaveMessage(null);
    setTestingServer(true);

    try {
      if (serverUrlInput.trim()) {
        const normalized = await saveApiBaseUrlOverride(serverUrlInput);
        setServerUrlInput(normalized);
      }
      await saveAppPasswordAsync(passwordInput);

      const res = await apiFetch("/api/config", {
        cache: "no-store",
        appPassword: passwordInput.trim(),
      });
      if (!res.ok) {
        throw new Error(`Server merespons HTTP ${res.status}.`);
      }
      const data = (await res.json()) as {
        provider: string;
        modelName: string;
        apiKeyConfigured: boolean;
      };
      setServerSaveMessage(
        `Terhubung! Model server: ${data.provider}/${data.modelName} (${
          data.apiKeyConfigured ? "API key aktif" : "API key belum diisi di Vercel"
        }).`
      );
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Tidak dapat menjangkau server."
      );
    } finally {
      setTestingServer(false);
    }
  };

  const applyPreset = (preset: "standard" | "micro" | "cent") => {
    if (preset === "standard") {
      setDraftForm({
        accountBalance: 1000,
        riskPercent: 1,
        pointValuePerLot: 100,
        minLot: 0.01,
        lotStep: 0.01,
        accountCurrencyLabel: "USD",
      });
    } else if (preset === "micro") {
      setDraftForm({
        accountBalance: 250,
        riskPercent: 1,
        pointValuePerLot: 100,
        minLot: 0.001,
        lotStep: 0.001,
        accountCurrencyLabel: "USD",
      });
    } else {
      setDraftForm({
        accountBalance: 10000,
        riskPercent: 1,
        pointValuePerLot: 100,
        minLot: 0.001,
        lotStep: 0.001,
        accountCurrencyLabel: "USC",
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 mb-2 min-h-[36px]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Analyzer
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            Pengaturan Akun, Risiko &amp; Server
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Pengaturan risiko disimpan di <code className="text-zinc-300">localStorage</code>, sedangkan URL server &amp; password akses disimpan di <strong className="text-zinc-200">Capacitor Preferences</strong> agar dapat diubah tanpa rebuild APK.
          </p>
        </div>
      </div>

      {/* Pengaturan Server Backend Vercel (untuk Mobile APK / Override) */}
      <form
        onSubmit={handleSaveServerConfig}
        className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Server className="h-4 w-4 text-sky-400" />
              Server API Analisis (Vercel)
            </h2>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {isNative
                ? "Aplikasi Android memanggil API Vercel Anda melalui HTTPS. Isi URL deployment Vercel Anda jika berbeda dari bawaan build."
                : "Untuk versi web Vercel, kosongkan kolom URL agar memakai domain yang sama. Untuk APK Android, isi URL HTTPS deployment Vercel Anda."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="serverUrl" className="block text-xs font-medium text-zinc-300">
              URL Server Vercel (HTTPS)
            </label>
            <input
              id="serverUrl"
              type="url"
              inputMode="url"
              value={serverUrlInput}
              onChange={(e) => setServerUrlInput(e.target.value)}
              placeholder={envServerUrl || "https://nama-proyek-anda.vercel.app"}
              className="w-full min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-500 focus:border-sky-400 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">
              URL bawaan saat build:{" "}
              <span className="font-mono text-zinc-300">
                {envServerUrl || "(kosong — mode web same-origin)"}
              </span>
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="prefAppPassword" className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              Password Akses Server (Opsional — APP_PASSWORD)
            </label>
            <input
              id="prefAppPassword"
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Kosongkan jika server tidak memakai APP_PASSWORD"
              className="w-full min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        {serverError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
            {serverError}
          </div>
        )}
        {serverSaveMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            {serverSaveMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetServerUrl}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 hover:bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-300 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset URL
            </button>
            <button
              type="button"
              disabled={testingServer}
              onClick={() => void handleTestConnection()}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-3.5 py-2 text-xs font-medium text-sky-300 transition-colors disabled:opacity-50"
            >
              <Wifi className="h-3.5 w-3.5" />
              {testingServer ? "Menguji..." : "Tes Koneksi"}
            </button>
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-sky-400 hover:bg-sky-300 text-zinc-950 font-semibold px-5 py-2.5 text-sm transition-colors"
          >
            <Save className="h-4 w-4" />
            Simpan Server &amp; Password
          </button>
        </div>
      </form>

      {/* Preset Cepat */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Preset Cepat Tipe Akun Broker
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset("standard")}
            className="min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 hover:border-amber-400/50 px-3.5 py-2 text-xs font-medium text-zinc-200 transition-colors"
          >
            Akun Standar USD (Min 0.01 lot)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("micro")}
            className="min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 hover:border-amber-400/50 px-3.5 py-2 text-xs font-medium text-zinc-200 transition-colors"
          >
            Lot Mikro / &lt; 0.01 (Min 0.001 lot)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("cent")}
            className="min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 hover:border-amber-400/50 px-3.5 py-2 text-xs font-medium text-zinc-200 transition-colors"
          >
            Akun Cent USC (Min 0.001 lot)
          </button>
        </div>
      </section>

      <form
        onSubmit={handleSaveRisk}
        className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="accountBalance" className="block text-xs font-medium text-zinc-300">
              Saldo Akun ({form.accountCurrencyLabel || "USD"})
            </label>
            <input
              id="accountBalance"
              type="number"
              step="any"
              min="1"
              required
              value={form.accountBalance}
              onChange={(e) =>
                updateForm((p) => ({ ...p, accountBalance: Number(e.target.value) }))
              }
              className="w-full min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="accountCurrencyLabel" className="block text-xs font-medium text-zinc-300">
              Satuan Saldo (USD / USC)
            </label>
            <input
              id="accountCurrencyLabel"
              type="text"
              maxLength={10}
              value={form.accountCurrencyLabel}
              onChange={(e) =>
                updateForm((p) => ({ ...p, accountCurrencyLabel: e.target.value }))
              }
              className="w-full min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="riskPercent" className="block text-xs font-medium text-zinc-300">
              Persentase Risiko Maksimal per Trade (%)
            </label>
            <input
              id="riskPercent"
              type="number"
              step="0.1"
              min="0.1"
              max="25"
              required
              value={form.riskPercent}
              onChange={(e) =>
                updateForm((p) => ({ ...p, riskPercent: Number(e.target.value) }))
              }
              className="w-full min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">Default playbook: 1% per posisi.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pointValuePerLot" className="block text-xs font-medium text-zinc-300">
              Nilai per 1.00 Poin XAUUSD (per 1.00 Lot)
            </label>
            <input
              id="pointValuePerLot"
              type="number"
              step="any"
              min="0.01"
              required
              value={form.pointValuePerLot}
              onChange={(e) =>
                updateForm((p) => ({ ...p, pointValuePerLot: Number(e.target.value) }))
              }
              className="w-full min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">
              Kontrak standar 100 oz: gerak $1.00 emas (mis. 2650 → 2651) = 100 USD per 1.00 lot (1 USD per 0.01 lot).
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="minLot" className="block text-xs font-medium text-zinc-300">
              Ukuran Lot Minimum Broker (Mendukung &lt; 0.01)
            </label>
            <input
              id="minLot"
              type="number"
              step="0.001"
              min="0.0001"
              required
              value={form.minLot}
              onChange={(e) =>
                updateForm((p) => ({ ...p, minLot: Number(e.target.value) }))
              }
              className="w-full min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">
              Contoh: 0.01 untuk akun standar, atau 0.001 untuk akun cent/mikro.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lotStep" className="block text-xs font-medium text-zinc-300">
              Step Kenaikan Lot Broker
            </label>
            <input
              id="lotStep"
              type="number"
              step="0.001"
              min="0.0001"
              required
              value={form.lotStep}
              onChange={(e) =>
                updateForm((p) => ({ ...p, lotStep: Number(e.target.value) }))
              }
              className="w-full min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">
              Biasanya sama dengan lot minimum (0.01 atau 0.001).
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={handleResetRisk}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 hover:bg-zinc-800 px-3.5 py-2 text-xs sm:text-sm text-zinc-300 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Default
          </button>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Tersimpan di localStorage
              </span>
            )}
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold px-5 py-2.5 text-sm transition-colors"
            >
              <Save className="h-4 w-4" />
              Simpan Pengaturan Risiko
            </button>
          </div>
        </div>
      </form>

      {/* Simulasi Kalkulator Deterministik */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-amber-400" />
            Pratinjau Kalkulator Lot Deterministik
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="simSl" className="text-zinc-400">
              Simulasi Jarak SL (poin):
            </label>
            <input
              id="simSl"
              type="number"
              step="0.5"
              min="0.5"
              value={simulatedSlPoints}
              onChange={(e) => setSimulatedSlPoints(Number(e.target.value))}
              className="w-20 min-h-[38px] rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 font-mono text-zinc-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="text-zinc-400">Target Risiko</div>
            <div className="font-mono text-base font-semibold text-zinc-100 mt-1">
              {simulation.targetRiskAmount.toFixed(2)} {sanitized.accountCurrencyLabel}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="text-zinc-400">Lot Ideal (Matematis)</div>
            <div className="font-mono text-base font-semibold text-zinc-100 mt-1">
              {simulation.rawCalculatedLot ?? "—"} lot
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="text-zinc-400">Lot Rekomendasi</div>
            <div className="font-mono text-base font-bold text-amber-300 mt-1">
              {simulation.recommendedLot ?? "—"} lot
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="text-zinc-400">Risiko Aktual</div>
            <div
              className={`font-mono text-base font-semibold mt-1 ${
                simulation.exceedsRiskByMinLot ? "text-amber-300" : "text-emerald-400"
              }`}
            >
              {simulation.actualRiskPercent?.toFixed(2) ?? "—"}%
            </div>
          </div>
        </div>

        {simulation.minLotWarning && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{simulation.minLotWarning}</span>
          </div>
        )}
      </section>
    </div>
  );
}
