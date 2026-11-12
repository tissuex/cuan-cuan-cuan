import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export function isAppPasswordRequired(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.APP_PASSWORD.trim().length > 0);
}

function extractPasswordFromHeaders(request: NextRequest): string {
  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    return (bearerMatch ? bearerMatch[1] : authHeader).trim();
  }

  return request.headers.get("x-app-password")?.trim() ?? "";
}

export function verifyAppPassword(request: NextRequest): boolean {
  const expected = process.env.APP_PASSWORD?.trim();
  if (!expected) return true;

  const provided = extractPasswordFromHeaders(request);
  if (!provided) return false;

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
