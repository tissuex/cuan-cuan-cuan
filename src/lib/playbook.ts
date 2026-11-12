import fs from "node:fs";
import path from "node:path";
import type { SystemModelMessage } from "ai";
import type { SupportedProvider } from "./ai-provider";

const FALLBACK_PLAYBOOK = `# XAUUSD Intraday Execution Playbook
- Kerangka wajib: Trend -> Area -> Pattern -> Trigger -> Entry/Exit.
- Fokus Golden Pocket Fibonacci 0.5–0.618 + Liquidity Grab/Sweep lalu harga kembali masuk struktur.
- H1: Tren utama dan zona Supply/Demand.
- M15: BOS/CHoCH, Fair Value Gap (FVG), Order Block (OB), dan Liquidity Sweep.
- M5: Timing & konfirmasi trigger entry.
- Stop Loss (SL) wajib di balik struktur HL (BUY) atau LH (SELL).
- Risiko maksimal 1% per trade, RR minimal 1:2.
- Pilih NO_TRADE jika sinyal tidak jelas, timeframe bertentangan, fundamental berlawanan dengan teknikal, atau RR < 1:2.`;

function loadPlaybookMarkdownOnce(): string {
  try {
    const playbookPath = path.join(process.cwd(), "knowledge", "playbook.md");
    const raw = fs.readFileSync(playbookPath, "utf8").trim();
    return raw.length > 0 ? raw : FALLBACK_PLAYBOOK;
  } catch {
    return FALLBACK_PLAYBOOK;
  }
}

// Dimuat sekali saat startup/cold-start module dan di-cache di memori proses;
// tidak pernah membaca folder knowledge/source/ maupun file PDF mentah.
const CACHED_PLAYBOOK_MARKDOWN = loadPlaybookMarkdownOnce();

const SYSTEM_PREAMBLE = `Anda adalah analis teknikal & makro XAUUSD (Gold Spot) institusional yang sangat disiplin, objektif, dan netral.

ATURAN OPERASIONAL KETAT:
1. Jangan pernah bias ke BUY atau SELL. Jika data kurang lengkap, struktur ambigu, atau RR tidak mencapai 1:2, Anda WAJIB memilih NO_TRADE.
2. Evaluasi chart hanya berdasarkan fakta visual yang terlihat di screenshot TradingView (price action, struktur, label harga sumbu kanan, timeframe). Dilarang mengarang harga yang tidak terlihat.
3. Jika tidak semua timeframe (H1, M15, M5) diunggah, nyatakan eksplisit timeframe yang tidak tersedia pada ringkasanTimeframe dan turunkan tingkatKeyakinan.
4. Jangan menghitung ukuran lot atau persentase risiko—perhitungan lot dilakukan secara deterministik oleh aplikasi. Fokuskan angka pada zonaEntry, stopLoss, takeProfit1, dan takeProfit2 yang presisi secara teknikal (atau null bila NO_TRADE).
5. Untuk data fundamental: hanya gunakan konteks fundamental hasil riset server yang diberikan dalam prompt beserta tanggal dan URL sumbernya. Jangan pernah mengarang berita, angka CPI/NFP/yield, atau URL. Jika konteks fundamental tidak tersedia, nyatakan bahwa analisis murni teknikal.
6. Seluruh narasi output wajib menggunakan Bahasa Indonesia yang ringkas, padat, dan bebas basa-basi.`;

const FULL_SYSTEM_PROMPT = `${SYSTEM_PREAMBLE}\n\n--- PLAYBOOK STRATEGI ---\n${CACHED_PLAYBOOK_MARKDOWN}`;

export function getPlaybookSystemPrompt(): string {
  return FULL_SYSTEM_PROMPT;
}

export function getPlaybookStats(): { characters: number; estimatedTokens: number } {
  const characters = CACHED_PLAYBOOK_MARKDOWN.length;
  return {
    characters,
    estimatedTokens: Math.ceil(characters / 4),
  };
}

/**
 * Membangun system message dengan dukungan prompt caching per provider:
 * - Anthropic: explicit ephemeral cacheControl pada blok system prompt.
 * - Google Gemini: prefix system prompt deterministik agar implicit context caching aktif antar panggilan.
 */
export function buildCachedSystemMessages(
  provider: SupportedProvider
): SystemModelMessage[] {
  if (provider === "anthropic") {
    return [
      {
        role: "system",
        content: FULL_SYSTEM_PROMPT,
        providerOptions: {
          anthropic: {
            cacheControl: { type: "ephemeral" },
          },
        },
      },
    ];
  }

  return [
    {
      role: "system",
      content: FULL_SYSTEM_PROMPT,
    },
  ];
}

