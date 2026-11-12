import { connection, NextResponse, type NextRequest } from "next/server";
import { isAppPasswordRequired } from "@/lib/auth";
import { getPublicProviderInfo } from "@/lib/ai-provider";
import {
  buildCorsHeaders,
  corsForbiddenResponse,
  handleCorsPreflight,
  isOriginAllowed,
} from "@/lib/cors";
import { getPlaybookStats } from "@/lib/playbook";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  await connection();

  if (!isOriginAllowed(request)) {
    return corsForbiddenResponse();
  }

  const providerInfo = getPublicProviderInfo();
  const playbookStats = getPlaybookStats();

  return NextResponse.json(
    {
      passwordRequired: isAppPasswordRequired(),
      provider: providerInfo.provider,
      modelName: providerInfo.modelName,
      apiKeyConfigured: providerInfo.apiKeyConfigured,
      playbookTokensEstimate: playbookStats.estimatedTokens,
      maxUploadBytes: 4 * 1024 * 1024,
    },
    {
      headers: {
        ...buildCorsHeaders(request),
        "Cache-Control": "no-store",
      },
    }
  );
}
