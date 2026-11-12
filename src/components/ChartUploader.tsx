"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardPaste,
  ImagePlus,
  Info,
  Trash2,
  Upload,
} from "lucide-react";
import {
  compressChartImage,
  formatBytes,
  MAX_TOTAL_UPLOAD_BYTES,
  type CompressedChartImage,
} from "@/lib/image-compress";
import type { TimeframeKey } from "@/lib/schema";

export type ChartSlotMap = Partial<Record<TimeframeKey, CompressedChartImage>>;

interface SlotMeta {
  key: TimeframeKey;
  title: string;
  role: string;
  badgeColor: string;
}

const SLOTS: SlotMeta[] = [
  {
    key: "H1",
    title: "Timeframe H1",
    role: "Tren utama & zona Supply / Demand",
    badgeColor: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  },
  {
    key: "M15",
    title: "Timeframe M15",
    role: "BOS / CHoCH, OB, FVG & Liquidity Sweep",
    badgeColor: "text-sky-300 bg-sky-500/15 border-sky-500/30",
  },
  {
    key: "M5",
    title: "Timeframe M5",
    role: "Trigger konfirmasi & timing entry",
    badgeColor: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  },
];

interface ChartUploaderProps {
  slots: ChartSlotMap;
  onChange: (updater: (prev: ChartSlotMap) => ChartSlotMap) => void;
  disabled?: boolean;
  onLocalError?: (msg: string | null) => void;
}

export function ChartUploader({
  slots,
  onChange,
  disabled = false,
  onLocalError,
}: ChartUploaderProps) {
  const [activePasteTarget, setActivePasteTarget] = useState<TimeframeKey>("H1");
  const [draggingSlot, setDraggingSlot] = useState<TimeframeKey | null>(null);
  const [processingSlot, setProcessingSlot] = useState<TimeframeKey | null>(null);
  const fileInputRefs = useRef<Partial<Record<TimeframeKey, HTMLInputElement | null>>>({});

  const totalCompressedBytes = (Object.values(slots) as Array<CompressedChartImage | undefined>).reduce(
    (sum, item) => sum + (item?.compressedBytes ?? 0),
    0
  );
  const uploadedCount = Object.values(slots).filter(Boolean).length;
  const exceedsTotalLimit = totalCompressedBytes > MAX_TOTAL_UPLOAD_BYTES;

  const handleProcessFile = useCallback(
    async (timeframe: TimeframeKey, file: File) => {
      if (disabled) return;
      onLocalError?.(null);
      setProcessingSlot(timeframe);

      try {
        const compressed = await compressChartImage(file, timeframe);
        onChange((prev) => {
          const old = prev[timeframe];
          if (old?.previewUrl) {
            URL.revokeObjectURL(old.previewUrl);
          }
          return {
            ...prev,
            [timeframe]: compressed,
          };
        });

        // Pindahkan target paste otomatis ke slot kosong berikutnya agar praktis
        if (timeframe === "H1" && !slots.M15) {
          setActivePasteTarget("M15");
        } else if (timeframe === "M15" && !slots.M5) {
          setActivePasteTarget("M5");
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : `Gagal memproses gambar ${timeframe}.`;
        onLocalError?.(msg);
      } finally {
        setProcessingSlot(null);
      }
    },
    [disabled, onChange, onLocalError, slots.M15, slots.M5]
  );

  const handleRemoveSlot = useCallback(
    (timeframe: TimeframeKey) => {
      onLocalError?.(null);
      onChange((prev) => {
        const next = { ...prev };
        if (next[timeframe]?.previewUrl) {
          URL.revokeObjectURL(next[timeframe]!.previewUrl);
        }
        delete next[timeframe];
        return next;
      });
      setActivePasteTarget(timeframe);
    },
    [onChange, onLocalError]
  );

  // Dukungan Paste Clipboard global (Ctrl+V screenshot TradingView)
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled) return;
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (!blob) continue;

          event.preventDefault();
          const targetSlot: TimeframeKey =
            !slots[activePasteTarget]
              ? activePasteTarget
              : !slots.H1
                ? "H1"
                : !slots.M15
                  ? "M15"
                  : !slots.M5
                    ? "M5"
                    : activePasteTarget;

          void handleProcessFile(targetSlot, blob);
          break;
        }
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [activePasteTarget, disabled, handleProcessFile, slots]);

  const usagePct = Math.min(100, Math.round((totalCompressedBytes / MAX_TOTAL_UPLOAD_BYTES) * 100));

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-amber-400" />
            Unggah Screenshot Chart TradingView (XAUUSD)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Drag &amp; drop, pilih file, atau tekan <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-[11px]">Ctrl+V</kbd> langsung untuk menempel ke slot aktif (otomatis dikompres ke ≤ 1280px WebP).
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/80 px-2.5 py-1 text-zinc-300">
            <ClipboardPaste className="h-3.5 w-3.5 text-amber-400" />
            Target Paste: <strong className="text-amber-300">{activePasteTarget}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {SLOTS.map((slot) => {
          const item = slots[slot.key];
          const isTarget = activePasteTarget === slot.key;
          const isDragging = draggingSlot === slot.key;
          const isBusy = processingSlot === slot.key;

          return (
            <div
              key={slot.key}
              onClick={() => setActivePasteTarget(slot.key)}
              onDragOver={(e) => {
                e.preventDefault();
                if (!disabled) setDraggingSlot(slot.key);
              }}
              onDragLeave={() => setDraggingSlot((prev) => (prev === slot.key ? null : prev))}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingSlot(null);
                if (disabled) return;
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setActivePasteTarget(slot.key);
                  void handleProcessFile(slot.key, file);
                }
              }}
              className={`relative rounded-xl border transition-all p-3 flex flex-col justify-between min-h-[210px] cursor-pointer ${
                isDragging
                  ? "border-amber-400 bg-amber-500/10"
                  : isTarget
                    ? "border-amber-500/60 bg-zinc-900/90 ring-1 ring-amber-500/20"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${slot.badgeColor}`}
                    >
                      {slot.key}
                    </span>
                    {item && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                    {slot.role}
                  </p>
                </div>

                {item && !disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSlot(slot.key);
                    }}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title={`Hapus chart ${slot.key}`}
                    aria-label={`Hapus chart ${slot.key}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {item ? (
                <div className="space-y-2">
                  <div className="relative w-full h-36 sm:h-32 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={`Preview chart ${slot.key}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>
                      {item.width}×{item.height} ({item.mimeType === "image/webp" ? "WebP" : "JPEG"})
                    </span>
                    <span className="text-emerald-400">
                      {formatBytes(item.originalBytes)} → {formatBytes(item.compressedBytes)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRefs.current[slot.key]?.click();
                    }}
                    className="w-full min-h-[44px] py-2 rounded-lg border border-zinc-700/80 bg-zinc-800/70 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
                  >
                    Ganti Gambar {slot.key}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={disabled || isBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePasteTarget(slot.key);
                    fileInputRefs.current[slot.key]?.click();
                  }}
                  className="flex-1 min-h-[128px] flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/40 px-3 py-5 text-center transition-colors disabled:opacity-50"
                >
                  <Upload className="h-5 w-5 text-zinc-400 mb-2" />
                  <span className="text-xs font-medium text-zinc-200">
                    {isBusy ? "Mengompres..." : `Pilih Galeri / Drop ${slot.key}`}
                  </span>
                  <span className="text-[11px] text-zinc-500 mt-1">
                    {isTarget ? "Aktif untuk Ctrl+V paste / sentuh pilih" : "Ketuk untuk pilih gambar atau target paste"}
                  </span>
                </button>
              )}

              <input
                ref={(el) => {
                  fileInputRefs.current[slot.key] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={disabled}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleProcessFile(slot.key, file);
                  }
                  e.target.value = "";
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Payload size bar & partial timeframe info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          <Info className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <span>
            {uploadedCount === 0
              ? "Minimal unggah 1 gambar. Lengkap 3 timeframe (H1, M15, M5) disarankan."
              : uploadedCount < 3
                ? `Mode parsial (${uploadedCount}/3 gambar): AI akan menyebut timeframe yang tidak tersedia dan menurunkan keyakinan.`
                : "3/3 timeframe lengkap siap dianalisis."}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-28 h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full transition-all ${
                exceedsTotalLimit ? "bg-rose-500" : "bg-amber-400"
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <span
            className={`font-mono ${
              exceedsTotalLimit ? "text-rose-400 font-semibold" : "text-zinc-300"
            }`}
          >
            {formatBytes(totalCompressedBytes)} / 4.00 MB
          </span>
        </div>
      </div>
    </section>
  );
}

