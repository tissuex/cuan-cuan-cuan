import {
  AiAnalysis,
  RiskCalculationResult,
  UserRiskSettings,
} from "./schema";

function getDecimalPrecision(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 2;
  const text = step.toString();
  if (text.includes("e-")) {
    const exp = Number(text.split("e-")[1]);
    return Number.isFinite(exp) ? Math.min(4, Math.max(2, exp)) : 2;
  }
  const decimals = text.split(".")[1]?.length ?? 0;
  return Math.min(4, Math.max(2, decimals));
}

function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function floorToLotStep(rawLot: number, lotStep: number, precision: number): number {
  if (lotStep <= 0) return roundToPrecision(rawLot, precision);
  const steps = Math.floor((rawLot + 1e-10) / lotStep);
  return roundToPrecision(steps * lotStep, precision);
}

export function sanitizeRiskSettings(input: Partial<UserRiskSettings>): UserRiskSettings {
  const accountBalance =
    typeof input.accountBalance === "number" && Number.isFinite(input.accountBalance) && input.accountBalance > 0
      ? input.accountBalance
      : 1000;

  const riskPercent =
    typeof input.riskPercent === "number" && Number.isFinite(input.riskPercent) && input.riskPercent > 0 && input.riskPercent <= 100
      ? input.riskPercent
      : 1;

  const pointValuePerLot =
    typeof input.pointValuePerLot === "number" && Number.isFinite(input.pointValuePerLot) && input.pointValuePerLot > 0
      ? input.pointValuePerLot
      : 100;

  const minLot =
    typeof input.minLot === "number" && Number.isFinite(input.minLot) && input.minLot > 0
      ? input.minLot
      : 0.01;

  const lotStep =
    typeof input.lotStep === "number" && Number.isFinite(input.lotStep) && input.lotStep > 0
      ? input.lotStep
      : minLot < 0.01
        ? 0.001
        : 0.01;

  const accountCurrencyLabel =
    typeof input.accountCurrencyLabel === "string" && input.accountCurrencyLabel.trim().length > 0
      ? input.accountCurrencyLabel.trim().slice(0, 12)
      : "USD";

  return {
    accountBalance,
    riskPercent,
    pointValuePerLot,
    minLot,
    lotStep,
    accountCurrencyLabel,
  };
}

export function calculateDeterministicRisk(
  analysis: AiAnalysis,
  rawSettings: UserRiskSettings
): RiskCalculationResult {
  const settings = sanitizeRiskSettings(rawSettings);
  const targetRiskAmount = roundToPrecision(
    settings.accountBalance * (settings.riskPercent / 100),
    2
  );

  const entryFromRange =
    analysis.zonaEntry.min !== null && analysis.zonaEntry.max !== null
      ? (analysis.zonaEntry.min + analysis.zonaEntry.max) / 2
      : analysis.zonaEntry.min ?? analysis.zonaEntry.max ?? null;

  const entryPrice = analysis.zonaEntry.hargaIdeal ?? entryFromRange;
  const { stopLoss, takeProfit1, takeProfit2, bias } = analysis;

  if (bias === "NO_TRADE") {
    return {
      isCalculable: false,
      reasonIfNotCalculable:
        "Keputusan NO_TRADE: tidak ada eksekusi posisi sehingga ukuran lot tidak dihitung.",
      geometryValid: true,
      geometryWarning: null,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      slDistancePoints: null,
      tp1DistancePoints: null,
      tp2DistancePoints: null,
      rr1: null,
      rr2: null,
      rrBelowMinimum: false,
      targetRiskAmount,
      rawCalculatedLot: null,
      recommendedLot: null,
      actualRiskAmount: null,
      actualRiskPercent: null,
      exceedsRiskByMinLot: false,
      minLotWarning: null,
      potentialProfitTp1: null,
      potentialProfitTp2: null,
    };
  }

  if (entryPrice === null || stopLoss === null) {
    return {
      isCalculable: false,
      reasonIfNotCalculable:
        "Harga entry ideal atau Stop Loss belum tersedia untuk menghitung ukuran lot secara deterministik.",
      geometryValid: false,
      geometryWarning: "Level entry atau Stop Loss tidak lengkap.",
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      slDistancePoints: null,
      tp1DistancePoints: null,
      tp2DistancePoints: null,
      rr1: null,
      rr2: null,
      rrBelowMinimum: false,
      targetRiskAmount,
      rawCalculatedLot: null,
      recommendedLot: null,
      actualRiskAmount: null,
      actualRiskPercent: null,
      exceedsRiskByMinLot: false,
      minLotWarning: null,
      potentialProfitTp1: null,
      potentialProfitTp2: null,
    };
  }

  let geometryValid = true;
  let geometryWarning: string | null = null;

  if (bias === "BUY") {
    if (stopLoss >= entryPrice) {
      geometryValid = false;
      geometryWarning =
        "Geometri tidak valid: untuk posisi BUY, Stop Loss harus lebih rendah dari harga entry.";
    } else if (takeProfit1 !== null && takeProfit1 <= entryPrice) {
      geometryValid = false;
      geometryWarning =
        "Geometri tidak valid: untuk posisi BUY, Take Profit 1 harus lebih tinggi dari harga entry.";
    }
  } else if (bias === "SELL") {
    if (stopLoss <= entryPrice) {
      geometryValid = false;
      geometryWarning =
        "Geometri tidak valid: untuk posisi SELL, Stop Loss harus lebih tinggi dari harga entry.";
    } else if (takeProfit1 !== null && takeProfit1 >= entryPrice) {
      geometryValid = false;
      geometryWarning =
        "Geometri tidak valid: untuk posisi SELL, Take Profit 1 harus lebih rendah dari harga entry.";
    }
  }

  const slDistancePoints = roundToPrecision(Math.abs(entryPrice - stopLoss), 2);
  if (slDistancePoints <= 0) {
    return {
      isCalculable: false,
      reasonIfNotCalculable: "Jarak Stop Loss bernilai 0 sehingga lot tidak dapat dihitung.",
      geometryValid: false,
      geometryWarning: geometryWarning ?? "Jarak Stop Loss tidak boleh 0.",
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      slDistancePoints: 0,
      tp1DistancePoints: null,
      tp2DistancePoints: null,
      rr1: null,
      rr2: null,
      rrBelowMinimum: false,
      targetRiskAmount,
      rawCalculatedLot: null,
      recommendedLot: null,
      actualRiskAmount: null,
      actualRiskPercent: null,
      exceedsRiskByMinLot: false,
      minLotWarning: null,
      potentialProfitTp1: null,
      potentialProfitTp2: null,
    };
  }

  const tp1DistancePoints =
    takeProfit1 !== null ? roundToPrecision(Math.abs(takeProfit1 - entryPrice), 2) : null;
  const tp2DistancePoints =
    takeProfit2 !== null ? roundToPrecision(Math.abs(takeProfit2 - entryPrice), 2) : null;

  const rr1 =
    tp1DistancePoints !== null ? roundToPrecision(tp1DistancePoints / slDistancePoints, 2) : null;
  const rr2 =
    tp2DistancePoints !== null ? roundToPrecision(tp2DistancePoints / slDistancePoints, 2) : null;
  const rrBelowMinimum = rr1 !== null && rr1 < 2;

  const precision = Math.max(
    getDecimalPrecision(settings.minLot),
    getDecimalPrecision(settings.lotStep)
  );

  const riskPerOneLot = slDistancePoints * settings.pointValuePerLot;
  const rawCalculatedLot = roundToPrecision(targetRiskAmount / riskPerOneLot, precision + 1);
  const flooredLot = floorToLotStep(rawCalculatedLot, settings.lotStep, precision);

  let recommendedLot = flooredLot;
  if (flooredLot < settings.minLot) {
    recommendedLot = roundToPrecision(settings.minLot, precision);
  }

  const actualRiskAmount = roundToPrecision(recommendedLot * riskPerOneLot, 2);
  const actualRiskPercent = roundToPrecision(
    (actualRiskAmount / settings.accountBalance) * 100,
    2
  );

  const exceedsRiskByMinLot =
    rawCalculatedLot < settings.minLot && actualRiskPercent > settings.riskPercent + 0.01;

  const minLotWarning = exceedsRiskByMinLot
    ? `Lot ideal (${rawCalculatedLot.toFixed(precision)}) di bawah lot minimum broker (${settings.minLot}). Menggunakan lot minimum ${recommendedLot.toFixed(precision)} membuat risiko aktual menjadi ${actualRiskPercent.toFixed(2)}% (${actualRiskAmount.toFixed(2)} ${settings.accountCurrencyLabel}), melebihi batas ${settings.riskPercent}%. Pertimbangkan untuk TIDAK ENTRY atau gunakan akun cent/lot lebih kecil.`
    : null;

  const potentialProfitTp1 =
    tp1DistancePoints !== null
      ? roundToPrecision(recommendedLot * tp1DistancePoints * settings.pointValuePerLot, 2)
      : null;
  const potentialProfitTp2 =
    tp2DistancePoints !== null
      ? roundToPrecision(recommendedLot * tp2DistancePoints * settings.pointValuePerLot, 2)
      : null;

  return {
    isCalculable: true,
    reasonIfNotCalculable: null,
    geometryValid,
    geometryWarning,
    entryPrice: roundToPrecision(entryPrice, 2),
    stopLoss: roundToPrecision(stopLoss, 2),
    takeProfit1: takeProfit1 !== null ? roundToPrecision(takeProfit1, 2) : null,
    takeProfit2: takeProfit2 !== null ? roundToPrecision(takeProfit2, 2) : null,
    slDistancePoints,
    tp1DistancePoints,
    tp2DistancePoints,
    rr1,
    rr2,
    rrBelowMinimum,
    targetRiskAmount,
    rawCalculatedLot,
    recommendedLot,
    actualRiskAmount,
    actualRiskPercent,
    exceedsRiskByMinLot,
    minLotWarning,
    potentialProfitTp1,
    potentialProfitTp2,
  };
}

