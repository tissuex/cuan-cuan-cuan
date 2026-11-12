export const MAX_LONGEST_EDGE_PX = 1280;
export const COMPRESSION_QUALITY = 0.8;
// Batas aman di bawah limit body request Vercel Functions (4,5 MB)
export const MAX_TOTAL_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_SINGLE_INPUT_BYTES = 20 * 1024 * 1024;

export interface CompressedChartImage {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  mimeType: "image/webp" | "image/jpeg";
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/webp" | "image/jpeg",
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal membaca file gambar. Pastikan file berupa gambar yang valid."));
    };
    img.src = objectUrl;
  });
}

export async function compressChartImage(
  inputFile: File,
  label: string
): Promise<CompressedChartImage> {
  if (!inputFile.type.startsWith("image/")) {
    throw new Error(`File pada slot ${label} bukan gambar yang valid.`);
  }

  if (inputFile.size > MAX_SINGLE_INPUT_BYTES) {
    throw new Error(
      `Ukuran file asli ${label} terlalu besar (> 20 MB). Gunakan screenshot grafik standar.`
    );
  }

  let width = 0;
  let height = 0;
  let bitmap: ImageBitmap | null = null;
  let htmlImg: HTMLImageElement | null = null;

  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await createImageBitmap(inputFile);
      width = bitmap.width;
      height = bitmap.height;
    } catch {
      bitmap = null;
    }
  }

  if (!bitmap) {
    htmlImg = await loadHtmlImage(inputFile);
    width = htmlImg.naturalWidth || htmlImg.width;
    height = htmlImg.naturalHeight || htmlImg.height;
  }

  if (!width || !height) {
    bitmap?.close();
    throw new Error(`Dimensi gambar ${label} tidak terbaca.`);
  }

  const longest = Math.max(width, height);
  const scale = longest > MAX_LONGEST_EDGE_PX ? MAX_LONGEST_EDGE_PX / longest : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap?.close();
    throw new Error("Browser tidak mendukung Canvas 2D untuk kompresi gambar.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();
  } else if (htmlImg) {
    ctx.drawImage(htmlImg, 0, 0, targetWidth, targetHeight);
  }

  let mimeType: "image/webp" | "image/jpeg" = "image/webp";
  let blob = await canvasToBlob(canvas, "image/webp", COMPRESSION_QUALITY);

  // Fallback otomatis ke JPEG 0.8 jika browser tidak mendukung export WebP
  if (!blob || blob.type !== "image/webp") {
    mimeType = "image/jpeg";
    blob = await canvasToBlob(canvas, "image/jpeg", COMPRESSION_QUALITY);
  }

  if (!blob) {
    throw new Error(`Gagal mengompres gambar ${label}.`);
  }

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const compressedFile = new File([blob], `xauusd-${label.toLowerCase()}.${ext}`, {
    type: mimeType,
    lastModified: Date.now(),
  });

  const previewUrl = URL.createObjectURL(compressedFile);

  return {
    file: compressedFile,
    previewUrl,
    width: targetWidth,
    height: targetHeight,
    originalBytes: inputFile.size,
    compressedBytes: compressedFile.size,
    mimeType,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

