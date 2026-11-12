"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

export function CapacitorBoot() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!Capacitor.isNativePlatform()) return;

    SplashScreen.hide().catch(() => {
      // Abaikan jika splash sudah tertutup otomatis
    });
  }, []);

  return null;
}

