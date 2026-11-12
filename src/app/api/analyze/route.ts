import { generateText, Output, type FilePart, type TextPart, type UserModelMessage } from "ai";
import type { NextRequest } from "next/server";
import { verifyAppPassword } from "@/lib/auth";
import { AiConfigurationError, resolveVisionModel } from "@/lib/ai-provider";
import {
  buildCorsHeaders,
  corsForbiddenResponse,
  handleCorsPreflight,
  isOriginAllowed,
} from "@/lib/cors";
import { getFundamentalContext, type FundamentalResearchResult } from "@/lib/fundamental";
import { buildCachedSystemMessages } from "@/lib/playbook";
import { checkRateLimit } from "@/lib/rate-limit";
import { calculateDeterministicRisk, sanitizeRiskSettings } from "@/lib/risk-calculator";
import {
  AiAnalysisSchema,
  DEFAULT_RISK_SETTINGS,
  type AiAnalysis,
  type AnalyzeResponsePayload,
  type CompactPreviousAnalysis,
  type TimeframeKey,
  type UserRiskSettings,
} from "@/lib/schema";

export const maxDuration = 60;

const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // < 4.5 MB batas body request Vercel Functions
const ALLOWED_MIME_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);
const TIMEFRAME_ORDER: TimeframeKey[] = ["H1", "M15", "M5"];

interface ValidatedImageInput {
  timeframe: TimeframeKey;
  mediaType: "image/webp" | "image/jpeg" | "image/png";
  bytes: Uint8Array;
}

function detectImageMagicBytes(bytes: Uint8Array): "image/webp" | "image/jpeg" | "image/png" | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function jsonError(
  request: NextRequest,
  status: number,
  code: string,
  message: string,
  extraHeaders?: HeadersInit
) {
  return Response.json(
    { code, message },
    {
      status,
      headers: {
        ...buildCorsHeaders(request),
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    }
  );
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

function mapProviderError(err: unknown): { code: string; message: string } {
  if (err instanceof AiConfigurationError) {
    return { code: err.code, message: err.message };
  }

  if (err instanceof Error) {
    const msg = err.message || "";
    const lower = msg.toLowerCase();

    if (err.name === "TimeoutError" || err.name === "AbortError" || lower.includes("timeout") || lower.includes("aborted")) {
      return {
        code: "TIMEOUT",
        message:
          "Permintaan ke penyedia AI melebihi batas waktu (timeout). Coba kurangi jumlah chart atau nonaktifkan riset fundamental sementara.",
      };
    }

    if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota") || lower.includes("resource_exhausted")) {
      return {
        code: "PROVIDER_RATE_LIMIT",
        message:
          "Batas kuota atau rate limit dari penyedia AI tercapai. Tunggu beberapa saat lalu coba lagi.",
      };
    }

    if (lower.includes("401") || lower.includes("403") || lower.includes("api key") || lower.includes("unauthorized") || lower.includes("permission")) {
      return {
        code: "INVALID_API_KEY",
        message:
          "API key AI ditolak atau tidak valid. Periksa GOOGLE_GENERATIVE_AI_API_KEY / ANTHROPIC_API_KEY di environment variable server.",
      };
    }

    if (lower.includes("404") || lower.includes("not found") || lower.includes("no longer available")) {
      return {
        code: "INVALID_MODEL",
        message: `Model AI yang dikonfigurasi tidak ditemukan atau tidak tersedia (${msg}). Periksa environment variable MODEL_NAME.`,
      };
    }

    return {
      code: "AI_PROVIDER_ERROR",
      message: `Gagal memproses analisis AI: ${msg}`,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Terjadi kesalahan tak terduga saat memproses analisis.",
  };
}

function parseOptionalJson<T>(raw: FormDataEntryValue | null): T | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function sanitizeAnalysisPostGeneration(
  analysis: AiAnalysis,
  fundamental: FundamentalResearchResult | null
): AiAnalysis {
  const normalized: AiAnalysis = {
    ...analysis,
    alasanUtama: analysis.alasanUtama.slice(0, 5),
  };

  if (normalized.bias === "NO_TRADE" && normalized.syaratSebelumEntry.length === 0) {
    normalized.syaratSebelumEntry = [
      "Tunggu harga mencapai zona POI H1/M15 dan muncul konfirmasi struktur (BOS/CHoCH/sweep) di M5 dengan RR minimal 1:2.",
    ];
  }

  if (!fundamental || !fundamental.available) {
    normalized.catatanFundamental = {
      digunakan: false,
      ringkasan:
        fundamental?.summary ??
        "Riset fundamental tidak diaktifkan; keputusan didasarkan sepenuhnya pada analisis teknikal chart.",
      sumber: [],
    };
  } else {
    // Batasi URL hanya ke URL yang benar-benar berasal dari hasil grounding server
    const allowedUrls = new Set(fundamental.sources.map((s) => s.url));
    const filteredSources = normalized.catatanFundamental.sumber.filter((s) =>
      allowedUrls.has(s.url)
    );
    normalized.catatanFundamental = {
      digunakan: true,
      ringkasan: normalized.catatanFundamental.ringkasan,
      sumber: filteredSources.length > 0 ? filteredSources : fundamental.sources,
    };
  }

  return normalized;
}

export async function POST(request: NextRequest) {
  if (!isOriginAllowed(request)) {
    return corsForbiddenResponse();
  }

  if (!verifyAppPassword(request)) {
    return jsonError(
      request,
      401,
      "UNAUTHORIZED",
      "Akses ditolak. Masukkan APP_PASSWORD yang benar untuk menggunakan analyzer."
    );
  }

  const rate = await checkRateLimit(request);
  if (!rate.success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));
    return jsonError(
      request,
      429,
      "RATE_LIMIT",
      `Batas permintaan per IP tercapai (${rate.limit} permintaan/menit). Silakan coba lagi dalam ${retryAfterSeconds} detik.`,
      {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(rate.limit),
        "X-RateLimit-Remaining": "0",
      }
    );
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_TOTAL_BYTES + 256 * 1024) {
      return jsonError(
        request,
        413,
        "PAYLOAD_TOO_LARGE",
        "Total ukuran request melebihi batas aman 4 MB (batas Vercel Functions 4,5 MB)."
      );
    }
  }

  let modelConfig: ReturnType<typeof resolveVisionModel>;
  try {
    modelConfig = resolveVisionModel();
  } catch (err) {
    const mapped = mapProviderError(err);
    return jsonError(request, 500, mapped.code, mapped.message);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(request, 400, "INVALID_FORM_DATA", "Format request harus berupa multipart/form-data.");
  }

  const images: ValidatedImageInput[] = [];
  let totalImageBytes = 0;

  for (const tf of TIMEFRAME_ORDER) {
    const fieldName = tf.toLowerCase();
    const entry = formData.get(fieldName);
    if (!entry) continue;

    if (!(entry instanceof File)) {
      return jsonError(request, 400, "INVALID_FILE", `Field ${fieldName} harus berupa file gambar.`);
    }

    if (entry.size === 0) {
      return jsonError(request, 400, "EMPTY_FILE", `File chart ${tf} kosong.`);
    }

    totalImageBytes += entry.size;
    if (totalImageBytes > MAX_TOTAL_BYTES) {
      return jsonError(
        request,
        413,
        "PAYLOAD_TOO_LARGE",
        "Total ukuran seluruh screenshot melebihi 4 MB. Aktifkan kompresi otomatis atau kurangi ukuran gambar."
      );
    }

    if (entry.type && !ALLOWED_MIME_TYPES.has(entry.type)) {
      return jsonError(
        request,
        400,
        "UNSUPPORTED_MEDIA_TYPE",
        `Tipe file ${tf} (${entry.type}) tidak didukung. Gunakan WebP, JPEG, atau PNG.`
      );
    }

    const buffer = new Uint8Array(await entry.arrayBuffer());
    const detectedMime = detectImageMagicBytes(buffer);
    if (!detectedMime) {
      return jsonError(
        request,
        400,
        "INVALID_IMAGE_BYTES",
        `Isi file ${tf} bukan gambar WebP, JPEG, atau PNG yang valid.`
      );
    }

    images.push({
      timeframe: tf,
      mediaType: detectedMime,
      bytes: buffer,
    });
  }

  if (images.length === 0) {
    return jsonError(
      request,
      400,
      "NO_IMAGES",
      "Unggah minimal 1 screenshot chart TradingView (M5, M15, atau H1) untuk dianalisis."
    );
  }

  const uploadedTimeframes = images.map((img) => img.timeframe);
  const missingTimeframes = TIMEFRAME_ORDER.filter(
    (tf) => !uploadedTimeframes.includes(tf)
  );

  const includeFundamental = formData.get("includeFundamental") === "true";
  const parsedSettings = parseOptionalJson<Partial<UserRiskSettings>>(formData.get("settings"));
  const riskSettings = sanitizeRiskSettings(parsedSettings ?? DEFAULT_RISK_SETTINGS);

  const previousAnalysis = parseOptionalJson<CompactPreviousAnalysis>(
    formData.get("previousAnalysis")
  );
  const rawFollowUpNote = formData.get("followUpNote");
  const followUpNote =
    typeof rawFollowUpNote === "string" ? rawFollowUpNote.trim().slice(0, 500) : "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        sendEvent({
          type: "status",
          step: "validate",
          message: `Gambar tervalidasi (${uploadedTimeframes.join(", ")}, ${(
            totalImageBytes / 1024
          ).toFixed(0)} KB). Menyiapkan analisis...`,
        });

        let fundamentalResult: FundamentalResearchResult | null = null;

        if (includeFundamental) {
          sendEvent({
            type: "status",
            step: "fundamental",
            message: "Memeriksa data fundamental XAUUSD (DXY, US10Y, Fed, CPI/NFP, geopolitik)...",
          });
          fundamentalResult = await getFundamentalContext(modelConfig.modelName);
          sendEvent({
            type: "status",
            step: "fundamental_done",
            message: fundamentalResult.statusMessage,
          });
        } else {
          sendEvent({
            type: "status",
            step: "fundamental_skipped",
            message: "Riset fundamental dinonaktifkan — fokus analisis teknikal murni.",
          });
        }

        sendEvent({
          type: "status",
          step: "vision",
          message: `Menganalisis chart XAUUSD dengan ${modelConfig.modelName} (${modelConfig.provider})...`,
        });

        const contextParts: string[] = [
          `Timeframe chart yang tersedia pada permintaan ini: ${uploadedTimeframes.join(", ")}.`,
          missingTimeframes.length > 0
            ? `PERHATIAN TIMEFRAME HILANG: ${missingTimeframes.join(
                ", "
              )} TIDAK DIUNGGAH. Anda wajib menyebutkan ketidakhadiran timeframe tersebut di ringkasanTimeframe dan menurunkan tingkatKeyakinan secara objektif.`
            : "Ketiga timeframe utama (H1, M15, M5) tersedia lengkap.",
          `Pengaturan risiko pengguna (hanya sebagai konteks batas risiko; JANGAN hitung lot sendiri): Risiko maks ${riskSettings.riskPercent}% per trade.`,
        ];

        if (previousAnalysis) {
          contextParts.push(
            `MODE ANALISIS LANJUTAN (gunakan ringkasan JSON sebelumnya di bawah sebagai konteks historis ringkas tanpa mengulang narasi panjang, lalu evaluasi ulang berdasarkan screenshot BARU yang dilampirkan):\n${JSON.stringify(
              previousAnalysis
            )}`
          );
          if (followUpNote) {
            contextParts.push(`Catatan tambahan trader untuk analisis lanjutan: "${followUpNote}"`);
          }
        }

        if (includeFundamental && fundamentalResult) {
          contextParts.push(
            `KONTEKS FUNDAMENTAL SERVER (diambil ${fundamentalResult.fetchedAt}, tersedia=${fundamentalResult.available}):\n${fundamentalResult.summary}\nSumber terverifikasi:\n${
              fundamentalResult.sources.length > 0
                ? fundamentalResult.sources
                    .map((s) => `- [${s.tanggal}] ${s.judul}: ${s.url}`)
                    .join("\n")
                : "- Tidak ada tautan sumber web terverifikasi."
            }`
          );
        } else {
          contextParts.push(
            "KONTEKS FUNDAMENTAL: Tidak diaktifkan oleh pengguna. Set catatanFundamental.digunakan = false dan sumber = []."
          );
        }

        const userContent: Array<TextPart | FilePart> = [
          {
            type: "text",
            text: contextParts.join("\n\n"),
          },
        ];

        for (const img of images) {
          userContent.push({
            type: "text",
            text: `[SCREENSHOT CHART TRADINGVIEW XAUUSD — TIMEFRAME ${img.timeframe}]`,
          });
          userContent.push({
            type: "file",
            data: img.bytes,
            mediaType: img.mediaType,
          });
        }

        const userMessage: UserModelMessage = {
          role: "user",
          content: userContent,
        };

        const instructions = buildCachedSystemMessages(modelConfig.provider);

        const generation = await generateText({
          model: modelConfig.model,
          instructions,
          messages: [userMessage],
          output: Output.object({
            schema: AiAnalysisSchema,
            name: "XauusdChartAnalysis",
            description:
              "Keputusan trading XAUUSD terstruktur berdasarkan playbook multi-timeframe dan filter risiko objektif.",
          }),
          temperature: 0.1,
          maxRetries: 1,
          abortSignal: AbortSignal.timeout(48_000),
        });

        sendEvent({
          type: "status",
          step: "risk",
          message: "Menghitung ukuran lot, Risk-to-Reward, dan validasi batas risiko secara deterministik...",
        });

        const cleanAnalysis = sanitizeAnalysisPostGeneration(
          generation.output,
          fundamentalResult
        );
        const riskCalculation = calculateDeterministicRisk(cleanAnalysis, riskSettings);

        const payload: AnalyzeResponsePayload = {
          analysis: cleanAnalysis,
          riskCalculation,
          meta: {
            analyzedAt: new Date().toISOString(),
            provider: modelConfig.provider,
            modelName: modelConfig.modelName,
            uploadedTimeframes,
            missingTimeframes,
            isFollowUp: Boolean(previousAnalysis),
            fundamentalRequested: includeFundamental,
            fundamentalFromCache: fundamentalResult?.fromCache ?? false,
            fundamentalStatus: includeFundamental
              ? fundamentalResult?.statusMessage ?? "Data fundamental tidak tersedia."
              : "Riset fundamental dinonaktifkan.",
            tokenUsage: {
              inputTokens: generation.usage?.inputTokens,
              outputTokens: generation.usage?.outputTokens,
              cachedInputTokens: generation.usage?.inputTokenDetails?.cacheReadTokens,
              totalTokens: generation.usage?.totalTokens,
            },
          },
        };

        sendEvent({
          type: "result",
          data: payload,
        });
      } catch (err) {
        const mapped = mapProviderError(err);
        sendEvent({
          type: "error",
          code: mapped.code,
          message: mapped.message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...buildCorsHeaders(request),
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-RateLimit-Limit": String(rate.limit),
      "X-RateLimit-Remaining": String(rate.remaining),
    },
  });
}
