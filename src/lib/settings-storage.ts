"use client";

import { useSyncExternalStore } from "react";
import { Preferences } from "@capacitor/preferences";
import { DEFAULT_RISK_SETTINGS, UserRiskSettings } from "./schema";
import { sanitizeRiskSettings } from "./risk-calculator";

const SETTINGS_STORAGE_KEY = "gold-chart-analyzer:risk-settings:v1";
const APP_PASSWORD_STORAGE_KEY = "gold-chart-analyzer:app-password:v1";
const SETTINGS_EVENT = "gold-chart-analyzer:settings-updated";
const PASSWORD_EVENT = "gold-chart-analyzer:password-updated";

let cachedRawSettings: string | null = null;
let cachedParsedSettings: UserRiskSettings = DEFAULT_RISK_SETTINGS;

export function loadRiskSettings(): UserRiskSettings {
  if (typeof window === "undefined") return DEFAULT_RISK_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      cachedRawSettings = null;
      cachedParsedSettings = DEFAULT_RISK_SETTINGS;
      return DEFAULT_RISK_SETTINGS;
    }
    if (raw === cachedRawSettings) {
      return cachedParsedSettings;
    }
    const parsed = JSON.parse(raw) as Partial<UserRiskSettings>;
    cachedRawSettings = raw;
    cachedParsedSettings = sanitizeRiskSettings(parsed);
    return cachedParsedSettings;
  } catch {
    return DEFAULT_RISK_SETTINGS;
  }
}

export function saveRiskSettings(settings: UserRiskSettings): UserRiskSettings {
  const sanitized = sanitizeRiskSettings(settings);
  if (typeof window !== "undefined") {
    try {
      const serialized = JSON.stringify(sanitized);
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
      cachedRawSettings = serialized;
      cachedParsedSettings = sanitized;
      window.dispatchEvent(new Event(SETTINGS_EVENT));
    } catch {
      // Abaikan jika storage penuh / private browsing memblokir write
    }
  }
  return sanitized;
}

export function resetRiskSettings(): UserRiskSettings {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
      cachedRawSettings = null;
      cachedParsedSettings = DEFAULT_RISK_SETTINGS;
      window.dispatchEvent(new Event(SETTINGS_EVENT));
    } catch {
      // Abaikan
    }
  }
  return DEFAULT_RISK_SETTINGS;
}

function subscribeRiskSettings(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener("focus", handler);
  window.addEventListener(SETTINGS_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("focus", handler);
    window.removeEventListener(SETTINGS_EVENT, handler);
  };
}

export function useRiskSettings(): UserRiskSettings {
  return useSyncExternalStore(
    subscribeRiskSettings,
    loadRiskSettings,
    () => DEFAULT_RISK_SETTINGS
  );
}

export async function loadAppPasswordAsync(): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const { value } = await Preferences.get({ key: APP_PASSWORD_STORAGE_KEY });
    if (value) return value;
  } catch {
    // Fallback ke sessionStorage di browser jika Preferences tidak tersedia
  }
  try {
    return window.sessionStorage.getItem(APP_PASSWORD_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export async function saveAppPasswordAsync(password: string): Promise<void> {
  if (typeof window === "undefined") return;
  const trimmed = password.trim();

  try {
    if (trimmed) {
      await Preferences.set({ key: APP_PASSWORD_STORAGE_KEY, value: trimmed });
    } else {
      await Preferences.remove({ key: APP_PASSWORD_STORAGE_KEY });
    }
  } catch {
    // Abaikan
  }

  try {
    if (trimmed) {
      window.sessionStorage.setItem(APP_PASSWORD_STORAGE_KEY, trimmed);
    } else {
      window.sessionStorage.removeItem(APP_PASSWORD_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(PASSWORD_EVENT));
  } catch {
    // Abaikan
  }
}

export function loadStoredAppPassword(): string {
  if (typeof window === "undefined") return "";
  try {
    return (
      window.sessionStorage.getItem(APP_PASSWORD_STORAGE_KEY) ??
      window.localStorage.getItem(`CapacitorStorage.${APP_PASSWORD_STORAGE_KEY}`) ??
      ""
    );
  } catch {
    return "";
  }
}

function subscribeStoredAppPassword(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(PASSWORD_EVENT, handler);
  return () => {
    window.removeEventListener(PASSWORD_EVENT, handler);
  };
}

export function useStoredAppPassword(): string {
  return useSyncExternalStore(
    subscribeStoredAppPassword,
    loadStoredAppPassword,
    () => ""
  );
}
