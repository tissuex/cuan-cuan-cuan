import { z } from "zod";

export const TimeframeKeySchema = z.enum(["M5", "M15", "H1"]);
export type TimeframeKey = z.infer<typeof TimeframeKeySchema>;

export const TradeBiasSchema = z.enum(["BUY", "SELL", "NO_TRADE"]);
export type TradeBias = z.infer<typeof TradeBiasSchema>;

export const FundamentalSourceSchema = z.object({
  judul: z.string().describe("Judul berita atau laporan makro"),
  url: z.string().describe("URL sumber valid hasil pencarian"),
  tanggal: z.string().describe("Tanggal publikasi atau tanggal data (YYYY-MM-DD atau deskripsi tanggal jelas)"),
});

export type FundamentalSource = z.infer<typeof FundamentalSourceSchema>;

export const AiAnalysisSchema = z.object({
  statusPasar: z
    .string()
    .describe("Ringkasan kondisi pasar XAUUSD saat ini (mis. Bullish Impulsif, Bearish Korektif, Konsolidasi di Range H1). Maksimal 2 kalimat."),
  bias: TradeBiasSchema.describe(
    "Keputusan trading objektif: BUY, SELL, atau NO_TRADE jika konfirmasi belum cukup / RR < 1:2 / fundamental bertentangan."
  ),
  ringkasanTimeframe: z.object({
    H1: z
      .string()
      .describe("Analisis tren & area Supply/Demand H1, maksimal 2 kalimat. Jika gambar H1 tidak diunggah, nyatakan eksplisit bahwa chart H1 tidak tersedia."),
    M15: z
      .string()
      .describe("Analisis struktur BOS/CHoCH/FVG/OB/liquidity sweep M15, maksimal 2 kalimat. Jika gambar M15 tidak diunggah, nyatakan eksplisit bahwa chart M15 tidak tersedia."),
    M5: z
      .string()
      .describe("Analisis trigger & timing entry M5, maksimal 2 kalimat. Jika gambar M5 tidak diunggah, nyatakan eksplisit bahwa chart M5 tidak tersedia."),
  }),
  zonaEntry: z.object({
    min: z
      .number()
      .nullable()
      .describe("Batas bawah zona entry XAUUSD (angka harga, atau null jika NO_TRADE / tidak terbaca)."),
    max: z
      .number()
      .nullable()
      .describe("Batas atas zona entry XAUUSD (angka harga, atau null jika NO_TRADE / tidak terbaca)."),
    hargaIdeal: z
      .number()
      .nullable()
      .describe("Harga entry ideal tunggal untuk acuan kalkulasi SL/TP/lot (null jika NO_TRADE)."),
    keterangan: z
      .string()
      .describe("Penjelasan singkat zona entry (mis. Golden Pocket 0.618 + M15 OB, atau 'Menunggu konfirmasi' saat NO_TRADE)."),
  }),
  stopLoss: z
    .number()
    .nullable()
    .describe("Harga Stop Loss di balik struktur HL (BUY) atau LH (SELL). Wajib null jika NO_TRADE atau tidak dapat ditentukan."),
  takeProfit1: z
    .number()
    .nullable()
    .describe("Target Take Profit 1 (minimal RR 1:2). Null jika NO_TRADE."),
  takeProfit2: z
    .number()
    .nullable()
    .describe("Target Take Profit 2 (likuiditas lanjutan). Null jika NO_TRADE."),
  estimasiHold: z
    .string()
    .describe("Perkiraan durasi hold posisi (mis. '2–6 jam (intraday)', '1–2 hari (swing)', atau 'Tidak ada posisi (NO_TRADE)')."),
  kondisiExit: z
    .string()
    .describe("Kriteria exit awal / invalidasi / manajemen posisi (mis. cut loss jika M15 close di bawah HL, amankan BE setelah TP1)."),
  tingkatKeyakinan: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Skor keyakinan objektif 0–100. Turunkan secara signifikan bila ada timeframe yang tidak diunggah atau konfirmasi lemah."),
  alasanUtama: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Maksimal 5 poin pendek alasan keputusan berdasarkan kerangka Trend -> Area -> Pattern -> Trigger -> Entry/Exit."),
  syaratSebelumEntry: z
    .array(z.string())
    .max(5)
    .describe("Daftar syarat spesifik yang wajib terpenuhi sebelum entry jika bias = NO_TRADE (kosongkan atau isi catatan pengawasan jika BUY/SELL)."),
  catatanFundamental: z.object({
    digunakan: z
      .boolean()
      .describe("True hanya jika data fundamental valid tersedia dan ikut dipertimbangkan; false jika fitur dimatikan atau data tidak tersedia."),
    ringkasan: z
      .string()
      .describe("Ringkasan dampak DXY/US10Y/Fed/CPI/NFP/geopolitik beserta tanggal data. Jika tidak tersedia, nyatakan bahwa analisis murni teknikal."),
    sumber: z
      .array(FundamentalSourceSchema)
      .max(6)
      .describe("Daftar sumber beserta tanggal yang benar-benar ada di konteks fundamental. Jangan pernah mengarang URL."),
  }),
});

export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

export interface UserRiskSettings {
  accountBalance: number;
  riskPercent: number;
  pointValuePerLot: number;
  minLot: number;
  lotStep: number;
  accountCurrencyLabel: string;
}

export const DEFAULT_RISK_SETTINGS: UserRiskSettings = {
  accountBalance: 1000,
  riskPercent: 1,
  pointValuePerLot: 100, // Standar XAUUSD: 1.00 lot = 100 oz ($100 per pergerakan $1.00 harga emas)
  minLot: 0.01,
  lotStep: 0.01,
  accountCurrencyLabel: "USD",
};

export interface RiskCalculationResult {
  isCalculable: boolean;
  reasonIfNotCalculable: string | null;
  geometryValid: boolean;
  geometryWarning: string | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  slDistancePoints: number | null;
  tp1DistancePoints: number | null;
  tp2DistancePoints: number | null;
  rr1: number | null;
  rr2: number | null;
  rrBelowMinimum: boolean;
  targetRiskAmount: number;
  rawCalculatedLot: number | null;
  recommendedLot: number | null;
  actualRiskAmount: number | null;
  actualRiskPercent: number | null;
  exceedsRiskByMinLot: boolean;
  minLotWarning: string | null;
  potentialProfitTp1: number | null;
  potentialProfitTp2: number | null;
}

export interface CompactPreviousAnalysis {
  timestamp: string;
  bias: TradeBias;
  statusPasar: string;
  timeframeTersedia: TimeframeKey[];
  zonaEntry: AiAnalysis["zonaEntry"];
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  tingkatKeyakinan: number;
  alasanUtama: string[];
  syaratSebelumEntry: string[];
}

export interface AnalyzeResponsePayload {
  analysis: AiAnalysis;
  riskCalculation: RiskCalculationResult;
  meta: {
    analyzedAt: string;
    provider: "google" | "anthropic";
    modelName: string;
    uploadedTimeframes: TimeframeKey[];
    missingTimeframes: TimeframeKey[];
    isFollowUp: boolean;
    fundamentalRequested: boolean;
    fundamentalFromCache: boolean;
    fundamentalStatus: string;
    tokenUsage?: {
      inputTokens?: number;
      outputTokens?: number;
      cachedInputTokens?: number;
      totalTokens?: number;
    };
  };
}

