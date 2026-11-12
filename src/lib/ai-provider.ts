import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export type SupportedProvider = "google" | "anthropic";

export interface ResolvedModelConfig {
  provider: SupportedProvider;
  modelName: string;
  model: LanguageModel;
}

export class AiConfigurationError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AiConfigurationError";
    this.code = code;
  }
}

export function detectConfiguredProvider(): SupportedProvider {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "anthropic") return "anthropic";
  if (explicit === "google") return "google";

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    return "google";
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return "anthropic";
  }
  return "google";
}

export function getPublicProviderInfo(): {
  provider: SupportedProvider;
  modelName: string;
  apiKeyConfigured: boolean;
} {
  const provider = detectConfiguredProvider();
  const defaultModel =
    provider === "google" ? "gemini-3-flash-preview" : "claude-sonnet-4-5";
  const modelName = process.env.MODEL_NAME?.trim() || defaultModel;

  const apiKeyConfigured =
    provider === "google"
      ? Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
      : Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  return {
    provider,
    modelName,
    apiKeyConfigured,
  };
}

export function resolveVisionModel(): ResolvedModelConfig {
  const provider = detectConfiguredProvider();

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new AiConfigurationError(
        "MISSING_API_KEY",
        "ANTHROPIC_API_KEY belum dikonfigurasi di server. Tambahkan environment variable ANTHROPIC_API_KEY atau ubah AI_PROVIDER=google."
      );
    }
    const modelName = process.env.MODEL_NAME?.trim() || "claude-sonnet-4-5";
    const anthropic = createAnthropic({ apiKey });
    return {
      provider: "anthropic",
      modelName,
      model: anthropic(modelName),
    };
  }

  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!googleApiKey) {
    throw new AiConfigurationError(
      "MISSING_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY belum dikonfigurasi di server. Tambahkan API key Google AI Studio pada environment variable."
    );
  }
  const modelName = process.env.MODEL_NAME?.trim() || "gemini-3-flash-preview";
  const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
  return {
    provider: "google",
    modelName,
    model: google(modelName),
  };
}
