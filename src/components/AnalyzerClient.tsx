"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AlertCircle,
  Check,
  Globe,
  History,
  KeyRound,
  Loader2,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { AnalysisResultView } from "./AnalysisResultView";
import { ChartUploader, type ChartSlotMap } from "./ChartUploader";
import {
  ApiNetworkError,
  apiFetch,
  isNativeMobileApp,
  resolveEffectiveApiBaseUrl,
} from "@/lib/api";
import { MAX_TOTAL_UPLOAD_BYTES, type CompressedChartImage } from "@/lib/image-compress";
import { calculateDeterministicRisk } from "@/lib/risk-calculator";
import {
  type AnalyzeResponsePayload,
  type CompactPreviousAnalysis,
  type TimeframeKey,
} from "@/lib/schema";
import {
  loadAppPasswordAsync,
  loadRiskSettings,
  saveAppPasswordAsync,
  useRiskSettings,
  useStoredAppPassword,
} from "@/lib/settings-storage";

interface PublicConfigResponse {
  passwordRequired: boolean;
  provider: "google" | "anthropic";
  modelName: string;
  apiKeyConfigured: boolean;
  playbookTokensEstimate: number;
  maxUploadBytes: number;
}

interface StreamStatusItem {
  step: string;
  message: string;
}

function toCompactPreviousAnalysis(
  payload: AnalyzeResponsePayload
): CompactPreviousAnalysis {
  return {
    timestamp: payload.meta.analyzedAt,
    bias: payload.analysis.bias,
    statusPasar: payload.analysis.statusPasar,
    timeframeTersedia: payload.meta.uploadedTimeframes,
    zonaEntry: payload.analysis.zonaEntry,
    stopLoss: payload.analysis.stopLoss,
    takeProfit1: payload.analysis.takeProfit1,
    takeProfit2: payload.analysis.takeProfit2,
    tingkatKeyakinan: payload.analysis.tingkatKeyakinan,
    alasanUtama: payload.analysis.alasanUtama,
    syaratSebelumEntry: payload.analysis.syaratSebelumEntry,
  };
}

function subscribeOnlineStatus(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

function getOnlineServerSnapshot() {
  return true;
}

async function fetchPublicConfigSnapshot(): Promise<{
  effectiveUrl: string;
  data: PublicConfigResponse | null;
  error: string | null;
}> {
  const effectiveUrl = await resolveEffectiveApiBaseUrl();
  try {
    const res = await apiFetch("/api/config", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as PublicConfigResponse;
    return { effectiveUrl, data, error: null };
  } catch (err) {
    if (err instanceof ApiNetworkError) {
      return { effectiveUrl, data: null, error: err.message };
    }
    if (isNativeMobileApp()) {
      return {
        effectiveUrl,
        data: null,
        error:
          "Gagal menghubungi server analisis. Periksa koneksi internet atau URL Vercel di Pengaturan.",
      };
    }
    return { effectiveUrl, data: null, error: null };
  }
}

export function AnalyzerClient() {
  const [slots, setSlots] = useState<ChartSlotMap>({});
  const settings = useRiskSettings();
  const storedPassword = useStoredAppPassword();
  const [nativeStoredPassword, setNativeStoredPassword] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfigResponse | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [activeServerUrl, setActiveServerUrl] = useState<string>("");
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
  const [appPasswordDraft, setAppPasswordDraft] = useState<string | null>(null);
  const appPassword = appPasswordDraft ?? nativeStoredPassword ?? storedPassword;

  const [includeFundamental, setIncludeFundamental] = useState(false);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const [followUpNote, setFollowUpNote] = useState("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusLogs, setStatusLogs] = useState<StreamStatusItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponsePayload | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadConfig = useCallback(async () => {
    const snapshot = await fetchPublicConfigSnapshot();
    setActiveServerUrl(snapshot.effectiveUrl);
    if (snapshot.data) {
      setConfig(snapshot.data);
    }
    setConfigError(snapshot.error);
  }, []);

  useEffect(() => {
    let active = true;

    loadAppPasswordAsync().then((pwd) => {
      if (active && pwd) {
        setNativeStoredPassword(pwd);
      }
    });

    fetchPublicConfigSnapshot().then((snapshot) => {
      if (!active) return;
      setActiveServerUrl(snapshot.effectiveUrl);
      if (snapshot.data) {
        setConfig(snapshot.data);
      }
      setConfigError(snapshot.error);
    });

    const handleFocus = () => {
      void loadConfig();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadConfig]);

  // Bersihkan ObjectURL saat unmount
  useEffect(() => {
    return () => {
      for (const item of Object.values(slots) as Array<CompressedChartImage | undefined>) {
        if (item?.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCompressedBytes = useMemo(
    () =>
      (Object.values(slots) as Array<CompressedChartImage | undefined>).reduce(
        (sum, item) => sum + (item?.compressedBytes ?? 0),
        0
      ),
    [slots]
  );

  const uploadedCount = useMemo(
    () => Object.values(slots).filter(Boolean).length,
    [slots]
  );

  // Hitung ulang risiko secara deterministik di UI setiap kali pengaturan berubah
  const liveRisk = useMemo(() => {
    if (!result) return null;
    return calculateDeterministicRisk(result.analysis, settings);
  }, [result, settings]);

  const handleResetCharts = () => {
    for (const item of Object.values(slots) as Array<CompressedChartImage | undefined>) {
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
    setSlots({});
    setErrorMessage(null);
  };

  const handleAnalyze = async () => {
    setErrorMessage(null);

    if (!isOnline || (typeof navigator !== "undefined" && navigator.onLine === false)) {
      setErrorMessage(
        "Perangkat tidak terhubung ke internet. Aktifkan Wi-Fi atau data seluler untuk menganalisis chart."
      );
      return;
    }

    if (uploadedCount === 0) {
      setErrorMessage("Unggah minimal 1 screenshot chart XAUUSD (M5, M15, atau H1) terlebih dahulu.");
      return;
    }

    if (totalCompressedBytes > MAX_TOTAL_UPLOAD_BYTES) {
      setErrorMessage(
        "Total ukuran seluruh gambar melebihi batas 4,00 MB (batas Vercel Functions 4,5 MB). Hapus atau ganti gambar dengan resolusi lebih kecil."
      );
      return;
    }

    if (config?.passwordRequired && !appPassword.trim()) {
      setErrorMessage("Aplikasi ini dikunci dengan password akses. Masukkan APP_PASSWORD terlebih dahulu.");
      return;
    }

    const latestSettings = loadRiskSettings();
    await saveAppPasswordAsync(appPassword);

    const formData = new FormData();
    (["H1", "M15", "M5"] as TimeframeKey[]).forEach((tf) => {
      const item = slots[tf];
      if (item) {
        formData.append(tf.toLowerCase(), item.file, item.file.name);
      }
    });

    formData.append("includeFundamental", includeFundamental ? "true" : "false");
    formData.append("settings", JSON.stringify(latestSettings));

    if (isFollowUpMode && result) {
      formData.append(
        "previousAnalysis",
        JSON.stringify(toCompactPreviousAnalysis(result))
      );
      if (followUpNote.trim()) {
        formData.append("followUpNote", followUpNote.trim());
      }
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsAnalyzing(true);
    setStatusLogs([{ step: "init", message: "Mengirim screenshot terkompresi ke server..." }]);

    try {
      const response = await apiFetch("/api/analyze", {
        method: "POST",
        appPassword: appPassword.trim(),
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errText = `Permintaan gagal (HTTP ${response.status}).`;
        try {
          const errJson = (await response.json()) as { message?: string };
          if (errJson?.message) errText = errJson.message;
        } catch {
          if (response.status === 413) {
            errText = "Ukuran request melebihi batas server (4,5 MB).";
          } else if (response.status === 504) {
            errText = "Server timeout saat memproses analisis. Coba lagi atau matikan riset fundamental.";
          }
        }
        throw new Error(errText);
      }

      if (!response.body) {
        throw new Error("Stream respons dari server tidak tersedia.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedResult: AnalyzeResponsePayload | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          const event = JSON.parse(line) as
            | { type: "status"; step: string; message: string }
            | { type: "result"; data: AnalyzeResponsePayload }
            | { type: "error"; code?: string; message: string };

          if (event.type === "status") {
            setStatusLogs((prev) => [...prev, { step: event.step, message: event.message }]);
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "result") {
            receivedResult = event.data;
          }
        }
      }

      if (buffer.trim()) {
        const tail = JSON.parse(buffer.trim()) as
          | { type: "result"; data: AnalyzeResponsePayload }
          | { type: "error"; message: string };
        if (tail.type === "error") throw new Error(tail.message);
        if (tail.type === "result") receivedResult = tail.data;
      }

      if (!receivedResult) {
        throw new Error("Analisis selesai tanpa hasil terstruktur. Silakan coba lagi.");
      }

      setResult(receivedResult);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setErrorMessage("Analisis dibatalkan oleh pengguna.");
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Terjadi kesalahan saat menganalisis chart."
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Peringatan Offline / Server Tidak Terjangkau */}
      {(!isOnline || configError) && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-200"
        >
          <div className="flex items-start gap-2.5">
            <WifiOff className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">
                {!isOnline ? "Perangkat Sedang Offline" : "Koneksi ke Server Bermasalah"}
              </p>
              <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                {!isOnline
                  ? "Aktifkan koneksi internet (Wi-Fi / data seluler) agar aplikasi dapat mengirim chart ke server AI."
                  : configError}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadConfig()}
              className="min-h-[40px] rounded-xl border border-amber-400/40 bg-zinc-950/70 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-zinc-900"
            >
              Coba Lagi
            </button>
            <Link
              href="/settings"
              className="min-h-[40px] inline-flex items-center rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-semibold text-zinc-950"
            >
              Atur URL Server
            </Link>
          </div>
        </div>
      )}

      {/* Bar Info Konfigurasi & Pengaturan Risiko Aktif */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/40 px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1 text-zinc-200 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            {config
              ? `${config.provider === "google" ? "Google AI Studio" : "Anthropic"} · ${config.modelName}`
              : configError
                ? "Server belum terhubung"
                : "Memuat konfigurasi model..."}
          </span>
          {config && !config.apiKeyConfigured && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-rose-300 font-medium">
              API Key Server Belum Diisi
            </span>
          )}
          {config && (
            <span className="text-zinc-400">
              Playbook ter-cache: ~{config.playbookTokensEstimate} token
            </span>
          )}
          {activeServerUrl && (
            <span className="text-zinc-500 font-mono truncate max-w-[230px]">
              Server: {activeServerUrl}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
          <span className="text-zinc-300 font-mono">
            Saldo: <strong>{settings.accountBalance.toLocaleString("id-ID")} {settings.accountCurrencyLabel}</strong> · Risk: <strong>{settings.riskPercent}%</strong> · Min Lot: <strong>{settings.minLot}</strong>
          </span>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-medium min-h-[36px]"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Ubah Pengaturan
          </Link>
        </div>
      </div>

      {/* Input Password Opsional jika APP_PASSWORD aktif di server */}
      {config?.passwordRequired && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <KeyRound className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-zinc-100">Akses Dilindungi Password</p>
              <p className="text-xs text-zinc-400">
                Server mengaktifkan `APP_PASSWORD`. Password dikirim lewat header Authorization dan disimpan aman di perangkat Anda.
              </p>
            </div>
          </div>
          <input
            type="password"
            value={appPassword}
            onChange={(e) => setAppPasswordDraft(e.target.value)}
            placeholder="Masukkan password akses..."
            className="w-full sm:w-64 min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          />
        </div>
      )}

      {/* Komponen Unggah & Kompresi Chart */}
      <ChartUploader
        slots={slots}
        onChange={setSlots}
        disabled={isAnalyzing}
        onLocalError={setErrorMessage}
      />

      {/* Opsi Analisis & Tombol Eksekusi */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Toggle Riset Fundamental */}
          <label
            className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors min-h-[44px] ${
              includeFundamental
                ? "border-sky-500/50 bg-sky-500/10"
                : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
            }`}
          >
            <input
              type="checkbox"
              checked={includeFundamental}
              disabled={isAnalyzing}
              onChange={(e) => setIncludeFundamental(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-zinc-600 bg-zinc-900 text-sky-500 focus:ring-sky-500 shrink-0"
            />
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-100 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-sky-400" />
                Sertakan Riset Fundamental (Opsional)
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Mencari sentimen DXY, yield US10Y, Fed, CPI/NFP, &amp; geopolitik lewat web search (cache server 20 menit). Jika gagal, otomatis lanjut teknikal saja.
              </p>
            </div>
          </label>

          {/* Toggle Analisis Lanjutan */}
          <label
            className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors min-h-[44px] ${
              !result
                ? "border-zinc-800/60 bg-zinc-950/30 opacity-60 cursor-not-allowed"
                : isFollowUpMode
                  ? "border-amber-500/50 bg-amber-500/10 cursor-pointer"
                  : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              checked={isFollowUpMode && Boolean(result)}
              disabled={isAnalyzing || !result}
              onChange={(e) => setIsFollowUpMode(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500 shrink-0"
            />
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-100 flex items-center gap-1.5">
                <History className="h-4 w-4 text-amber-400" />
                Mode Analisis Lanjutan
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {result
                  ? `Hanya mengirim gambar baru + ringkasan JSON hasil sebelumnya (${result.analysis.bias} @ ${result.riskCalculation.entryPrice ?? "NO_TRADE"}) agar hemat token.`
                  : "Tersedia setelah minimal 1 kali analisis selesai."}
              </p>
            </div>
          </label>
        </div>

        {isFollowUpMode && result && (
          <div className="space-y-1.5">
            <label
              htmlFor="followUpNote"
              className="block text-xs font-medium text-zinc-300"
            >
              Catatan Singkat Perubahan Chart (Opsional, maks. 500 karakter)
            </label>
            <input
              id="followUpNote"
              type="text"
              maxLength={500}
              disabled={isAnalyzing}
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              placeholder="Contoh: Harga baru saja menyapu low M15 dan muncul candle rejection M5, evaluasi ulang trigger..."
              className="w-full min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleResetCharts}
            disabled={isAnalyzing || uploadedCount === 0}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-2.5 text-xs sm:text-sm font-medium text-zinc-300 transition-colors disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            Bersihkan Chart
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {isAnalyzing && (
              <button
                type="button"
                onClick={() => abortControllerRef.current?.abort()}
                className="min-h-[44px] rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2.5 text-sm font-medium text-rose-300 transition-colors"
              >
                Batalkan
              </button>
            )}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={
                isAnalyzing ||
                uploadedCount === 0 ||
                totalCompressedBytes > MAX_TOTAL_UPLOAD_BYTES
              }
              className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold px-6 py-3 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menganalisis Chart...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  {isFollowUpMode && result ? "Jalankan Analisis Lanjutan" : "Analisis Chart XAUUSD"}
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Indikator Loading dengan Streaming Status */}
      {isAnalyzing && statusLogs.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-zinc-900/80 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Progres Analisis Real-Time
          </div>
          <ul className="space-y-1.5">
            {statusLogs.map((item, idx) => {
              const isLatest = idx === statusLogs.length - 1;
              return (
                <li
                  key={`${item.step}-${idx}`}
                  className={`flex items-center gap-2 text-xs sm:text-sm ${
                    isLatest ? "text-zinc-100 font-medium" : "text-zinc-400"
                  }`}
                >
                  {isLatest ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400 shrink-0" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span>{item.message}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Banner Error */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200"
        >
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-300">Analisis Tidak Dapat Dilanjutkan</p>
            <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Hasil Analisis Terstruktur */}
      {result && liveRisk && (
        <AnalysisResultView result={result} liveRisk={liveRisk} settings={settings} />
      )}
    </div>
  );
}
