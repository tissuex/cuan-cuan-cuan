import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { unstable_cache } from "next/cache";
import { detectConfiguredProvider, type SupportedProvider } from "./ai-provider";
import type { FundamentalSource } from "./schema";

export const FUNDAMENTAL_CACHE_TTL_SECONDS = 20 * 60; // 20 menit (rentang 15-30 menit)

export interface FundamentalResearchResult {
  available: boolean;
  fromCache: boolean;
  fetchedAt: string;
  summary: string;
  sources: FundamentalSource[];
  statusMessage: string;
}

interface InternalCachedPayload {
  fetchedAt: string;
  summary: string;
  sources: FundamentalSource[];
}

// Track ringan di memori proses untuk mendeteksi hit cache secara akurat
const lastFetchTimestampByKey = new Map<string, number>();

async function runFundamentalWebSearch(
  provider: SupportedProvider,
  modelName: string
): Promise<InternalCachedPayload> {
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.slice(0, 10);

  const prompt = `Tanggal hari ini (UTC): ${todayDate}.
Lakukan pencarian web terkini (maksimal 3 kueri ringkas) untuk faktor fundamental penggerak XAUUSD (emas spot):
1. Indeks Dolar AS (DXY) & imbal hasil US Treasury 10 tahun (US10Y) terbaru.
2. Kebijakan suku bunga The Fed / komentar pejabat FOMC terbaru serta rilis/ekspektasi CPI atau NFP terbaru.
3. Sentimen geopolitik atau safe-haven terkini yang memengaruhi harga emas.

Aturan ketat:
- Ringkas maksimal 6 poin singkat dalam Bahasa Indonesia.
- Wajib cantumkan tanggal data/berita pada setiap poin.
- Jangan pernah mengarang angka, tanggal, atau tautan sumber jika tidak ditemukan di hasil pencarian.
- Jika data tertentu tidak ditemukan, tulis "tidak tersedia dari pencarian terkini".`;

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY tidak tersedia untuk riset fundamental.");
    }
    const anthropic = createAnthropic({ apiKey });
    const result = await generateText({
      model: anthropic(modelName),
      tools: {
        web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }),
      },
      prompt,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(18_000),
    });

    const sources = extractSourcesFromResult(result.sources, todayDate);
    if (!result.text.trim()) {
      throw new Error("Pencarian fundamental Anthropic mengembalikan teks kosong.");
    }

    lastFetchTimestampByKey.set(`${provider}:${modelName}`, Date.now());
    return {
      fetchedAt: nowIso,
      summary: result.text.trim(),
      sources,
    };
  }

  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!googleApiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY tidak tersedia untuk riset fundamental.");
  }

  const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
  const result = await generateText({
    model: google(modelName),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    prompt,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(18_000),
  });

  const groundingChunks =
    (
      result.providerMetadata?.google as
        | {
            groundingMetadata?: {
              groundingChunks?: Array<{
                web?: { uri?: string; title?: string | null } | null;
              }> | null;
            } | null;
          }
        | undefined
    )?.groundingMetadata?.groundingChunks ?? [];

  const fromGrounding: FundamentalSource[] = groundingChunks
    .filter((chunk) => Boolean(chunk?.web?.uri))
    .map((chunk) => ({
      judul: chunk.web?.title?.trim() || "Sumber Pasar Global",
      url: chunk.web!.uri!,
      tanggal: todayDate,
    }));

  const fromSdkSources = extractSourcesFromResult(result.sources, todayDate);
  const mergedSources = deduplicateSources([...fromSdkSources, ...fromGrounding]).slice(0, 6);

  if (!result.text.trim()) {
    throw new Error("Pencarian fundamental Google Search mengembalikan teks kosong.");
  }

  lastFetchTimestampByKey.set(`${provider}:${modelName}`, Date.now());
  return {
    fetchedAt: nowIso,
    summary: result.text.trim(),
    sources: mergedSources,
  };
}

function extractSourcesFromResult(
  sources: Array<{ sourceType?: string; url?: string; title?: string }> | undefined,
  fallbackDate: string
): FundamentalSource[] {
  if (!Array.isArray(sources)) return [];
  return deduplicateSources(
    sources
      .filter((item) => item?.sourceType === "url" && typeof item.url === "string" && item.url.startsWith("http"))
      .map((item) => ({
        judul: item.title?.trim() || "Sumber Web",
        url: item.url!,
        tanggal: fallbackDate,
      }))
  ).slice(0, 6);
}

function deduplicateSources(list: FundamentalSource[]): FundamentalSource[] {
  const seen = new Set<string>();
  const out: FundamentalSource[] = [];
  for (const item of list) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

const getCachedFundamentalInternal = unstable_cache(
  async (provider: SupportedProvider, modelName: string) => {
    return runFundamentalWebSearch(provider, modelName);
  },
  ["gold-chart-analyzer:fundamental:v1"],
  {
    revalidate: FUNDAMENTAL_CACHE_TTL_SECONDS,
    tags: ["xauusd-fundamental"],
  }
);

export async function getFundamentalContext(
  modelNameOverride?: string
): Promise<FundamentalResearchResult> {
  const provider = detectConfiguredProvider();
  const defaultModel =
    provider === "google" ? "gemini-3-flash-preview" : "claude-sonnet-4-5";
  const modelName = modelNameOverride?.trim() || process.env.MODEL_NAME?.trim() || defaultModel;
  const cacheKey = `${provider}:${modelName}`;
  const before = lastFetchTimestampByKey.get(cacheKey);

  try {
    const cached = await getCachedFundamentalInternal(provider, modelName);
    const after = lastFetchTimestampByKey.get(cacheKey);
    const fromCache = before !== undefined && after === before;

    return {
      available: true,
      fromCache,
      fetchedAt: cached.fetchedAt,
      summary: cached.summary,
      sources: cached.sources,
      statusMessage: fromCache
        ? "Menggunakan cache riset fundamental server (berlaku 20 menit)."
        : "Riset fundamental terbaru berhasil diambil dari web search dan disimpan ke cache 20 menit.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pencarian fundamental gagal atau timeout.";
    return {
      available: false,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
      summary:
        "Data fundamental terkini tidak tersedia (pencarian gagal atau timeout). Analisis harus mengandalkan struktur teknikal chart saja tanpa mengarang berita makro.",
      sources: [],
      statusMessage: `Riset fundamental tidak tersedia (${message}); lanjut analisis teknikal saja.`,
    };
  }
}
