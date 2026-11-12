import type { NextRequest } from "next/server";

const CAPACITOR_ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost",
]);

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "").toLowerCase();
}

function getAllowedOriginsSet(request: NextRequest): Set<string> {
  const allowed = new Set<string>(CAPACITOR_ALLOWED_ORIGINS);

  // Origin server sendiri (same-origin request)
  if (request.nextUrl?.origin) {
    allowed.add(normalizeOrigin(request.nextUrl.origin));
  }

  // Domain deployment Vercel otomatis
  if (process.env.VERCEL_URL) {
    allowed.add(normalizeOrigin(`https://${process.env.VERCEL_URL}`));
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    allowed.add(normalizeOrigin(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`));
  }

  // Domain kustom dari env ALLOWED_ORIGINS (dipisahkan koma)
  const rawAllowed = process.env.ALLOWED_ORIGINS;
  if (rawAllowed) {
    for (const item of rawAllowed.split(",")) {
      const cleaned = normalizeOrigin(item);
      if (cleaned) {
        allowed.add(cleaned);
      }
    }
  }

  // Izinkan dev localhost hanya saat non-production
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
    allowed.add("http://localhost");
  }

  return allowed;
}

export function isOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return getAllowedOriginsSet(request).has(normalized);
}

export function buildCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    Vary: "Origin",
  };

  if (!origin) {
    return headers;
  }

  if (isOriginAllowed(request)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] =
      "Content-Type, Authorization, X-App-Password";
    headers["Access-Control-Max-Age"] = "86400";
  }

  return headers;
}

export function handleCorsPreflight(request: NextRequest): Response {
  if (!isOriginAllowed(request)) {
    return Response.json(
      {
        code: "CORS_FORBIDDEN",
        message: "Origin tidak diizinkan mengakses endpoint ini.",
      },
      {
        status: 403,
        headers: {
          Vary: "Origin",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...buildCorsHeaders(request),
      "Cache-Control": "no-store",
    },
  });
}

export function corsForbiddenResponse(): Response {
  return Response.json(
    {
      code: "CORS_FORBIDDEN",
      message:
        "Origin tidak diizinkan. Tambahkan domain Anda ke environment variable ALLOWED_ORIGINS di Vercel.",
    },
    {
      status: 403,
      headers: {
        Vary: "Origin",
        "Cache-Control": "no-store",
      },
    }
  );
}

