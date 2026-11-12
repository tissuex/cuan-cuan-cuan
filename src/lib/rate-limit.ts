import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  backend: "upstash" | "memory";
}

const WINDOW_MS = 60_000; // 1 menit
const MAX_REQUESTS_PER_WINDOW = 10;

interface MemoryWindowEntry {
  timestamps: number[];
}

const memoryStore = new Map<string, MemoryWindowEntry>();

let upstashLimiter: Ratelimit | null | undefined;

function getUpstashLimiter(): Ratelimit | null {
  if (upstashLimiter !== undefined) return upstashLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    upstashLimiter = null;
    return null;
  }

  const redis = new Redis({ url, token });
  upstashLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_WINDOW, "60 s"),
    prefix: "gold-chart-analyzer:rl",
  });
  return upstashLimiter;
}

export function extractClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "127.0.0.1";
}

function checkInMemoryRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  // Pembersihan ringan agar Map tidak tumbuh tanpa batas di long-lived dev server
  if (memoryStore.size > 500) {
    for (const [key, entry] of memoryStore.entries()) {
      const fresh = entry.timestamps.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        memoryStore.delete(key);
      } else {
        entry.timestamps = fresh;
      }
    }
  }

  const existing = memoryStore.get(identifier) ?? { timestamps: [] };
  const recent = existing.timestamps.filter((ts) => ts > cutoff);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[0] ?? now;
    memoryStore.set(identifier, { timestamps: recent });
    return {
      success: false,
      limit: MAX_REQUESTS_PER_WINDOW,
      remaining: 0,
      resetAt: oldest + WINDOW_MS,
      backend: "memory",
    };
  }

  recent.push(now);
  memoryStore.set(identifier, { timestamps: recent });

  return {
    success: true,
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - recent.length),
    resetAt: now + WINDOW_MS,
    backend: "memory",
  };
}

export async function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const ip = extractClientIp(request);
  const limiter = getUpstashLimiter();

  if (!limiter) {
    return checkInMemoryRateLimit(ip);
  }

  try {
    const res = await limiter.limit(ip);
    return {
      success: res.success,
      limit: res.limit,
      remaining: res.remaining,
      resetAt: res.reset,
      backend: "upstash",
    };
  } catch {
    // Fallback aman jika koneksi Redis Upstash bermasalah sesaat
    return checkInMemoryRateLimit(ip);
  }
}

