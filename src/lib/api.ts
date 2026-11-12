"use client";

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const SERVER_BASE_URL_PREF_KEY = "gold-chart-analyzer:server-base-url:v1";

export class ApiNetworkError extends Error {
  public readonly kind: "OFFLINE" | "NO_BASE_URL" | "UNREACHABLE";

  constructor(kind: "OFFLINE" | "NO_BASE_URL" | "UNREACHABLE", message: string) {
    super(message);
    this.name = "ApiNetworkError";
    this.kind = kind;
  }
}

export function isNativeMobileApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      "Format URL server tidak valid. Gunakan URL lengkap misalnya https://proyek-anda.vercel.app"
    );
  }

  const isLocalHost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

  if (parsed.protocol !== "https:" && !isLocalHost) {
    throw new Error("URL server wajib menggunakan HTTPS demi keamanan API key dan password.");
  }

  return parsed.origin + parsed.pathname.replace(/\/+$/, "");
}

export function getEnvApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
  if (!raw) return "";
  try {
    return normalizeApiBaseUrl(raw);
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

export async function getApiBaseUrlOverride(): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const { value } = await Preferences.get({ key: SERVER_BASE_URL_PREF_KEY });
    return value?.trim() ?? "";
  } catch {
    try {
      return window.localStorage.getItem(SERVER_BASE_URL_PREF_KEY)?.trim() ?? "";
    } catch {
      return "";
    }
  }
}

export async function saveApiBaseUrlOverride(rawUrl: string): Promise<string> {
  const normalized = normalizeApiBaseUrl(rawUrl);
  if (typeof window === "undefined") return normalized;

  if (!normalized) {
    await resetApiBaseUrlOverride();
    return "";
  }

  try {
    await Preferences.set({ key: SERVER_BASE_URL_PREF_KEY, value: normalized });
  } catch {
    // Fallback web
  }

  try {
    window.localStorage.setItem(SERVER_BASE_URL_PREF_KEY, normalized);
  } catch {
    // Abaikan jika storage diblokir
  }

  return normalized;
}

export async function resetApiBaseUrlOverride(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await Preferences.remove({ key: SERVER_BASE_URL_PREF_KEY });
  } catch {
    // Abaikan
  }
  try {
    window.localStorage.removeItem(SERVER_BASE_URL_PREF_KEY);
  } catch {
    // Abaikan
  }
}

export async function resolveEffectiveApiBaseUrl(): Promise<string> {
  const override = await getApiBaseUrlOverride();
  if (override) {
    return override.replace(/\/+$/, "");
  }
  return getEnvApiBaseUrl();
}

export async function buildApiUrl(path: string): Promise<string> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = await resolveEffectiveApiBaseUrl();

  if (!baseUrl && isNativeMobileApp()) {
    throw new ApiNetworkError(
      "NO_BASE_URL",
      "URL server Vercel belum dikonfigurasi di aplikasi Android ini. Buka menu Pengaturan lalu isi URL deployment Vercel Anda."
    );
  }

  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
}

export interface ApiFetchOptions extends RequestInit {
  appPassword?: string;
}

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiNetworkError(
      "OFFLINE",
      "Perangkat sedang offline. Periksa koneksi Wi-Fi atau data seluler Anda lalu coba lagi."
    );
  }

  const targetUrl = await buildApiUrl(path);
  const headers = new Headers(options.headers);
  const password = options.appPassword?.trim();

  if (password) {
    headers.set("Authorization", `Bearer ${password}`);
  }

  const { appPassword: _ignored, ...fetchInit } = options;
  void _ignored;

  try {
    return await fetch(targetUrl, {
      ...fetchInit,
      headers,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new ApiNetworkError(
        "OFFLINE",
        "Koneksi internet terputus saat menghubungi server."
      );
    }

    throw new ApiNetworkError(
      "UNREACHABLE",
      `Server analisis tidak dapat dijangkau (${targetUrl}). Pastikan perangkat terhubung ke internet, URL Vercel di Pengaturan benar, dan origin diizinkan oleh CORS server.`
    );
  }
}

