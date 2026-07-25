import type { IntegrationStatus } from "./types";
import { getVideoProvider } from "./providers";
import { llmConfigured } from "./llm";
import { getStore } from "./store";
import { passwordConfigured } from "./security";

/** Reports only booleans and hints — never values of secrets. */
export function integrationStatuses(): IntegrationStatus[] {
  const provider = getVideoProvider();
  const llm = llmConfigured();
  const store = getStore();
  return [
    {
      key: "auth",
      label: "Studio access protection",
      configured: passwordConfigured(),
      detail: passwordConfigured() ? "Password gate active." : "Set APP_ACCESS_PASSWORD — generation stays locked until you do.",
      requiredEnv: ["APP_ACCESS_PASSWORD", "SESSION_SECRET"],
    },
    {
      key: "database",
      label: "Production database",
      configured: store.durable,
      detail: store.durable ? "Durable: jobs survive refresh and redeploys." : "Non-durable memory store. Add Upstash Redis for persistence.",
      requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    },
    {
      key: "llm",
      label: "Planning LLM",
      configured: Boolean(llm),
      detail: llm ? `Connected: ${llm}.` : "No LLM key — agents use a labeled template plan.",
      requiredEnv: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
    },
    {
      key: "video",
      label: `Video provider — ${provider.name}`,
      configured: provider.configured && !provider.isMock,
      detail: provider.isMock
        ? "MOCK provider active: testing only, produces no real video."
        : provider.configured
          ? "Ready to generate real shots."
          : provider.configurationHint,
      requiredEnv: ["VIDEO_PROVIDER", "FAL_KEY", "FAL_MODEL_ID", "WAN_VIDEO_ENDPOINT", "WAN_VIDEO_TOKEN"],
    },
    {
      key: "assembly",
      label: "Assembly (ffmpeg merge)",
      configured: Boolean(process.env.ASSEMBLY_WEBHOOK_URL || process.env.FAL_KEY),
      detail: process.env.ASSEMBLY_WEBHOOK_URL
        ? "External concat worker connected."
        : process.env.FAL_KEY
          ? "fal.ai ffmpeg merge active: shots are concatenated into one vertical MP4 automatically."
          : "Not set: clips download individually; single-MP4 concat needs FAL_KEY or a worker.",
      requiredEnv: ["FAL_KEY", "ASSEMBLY_WEBHOOK_URL"],
    },
    {
      key: "youtube",
      label: "YouTube Shorts publishing",
      configured: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN),
      detail: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN)
        ? "Connected: approved productions upload to YouTube as Shorts on publish (API-confirmed only)."
        : "Requires a Google Cloud OAuth client with youtube.upload scope and a refresh token. Publishing stays manual-approval only.",
      requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
    },
    {
      key: "tiktok",
      label: "TikTok publishing",
      configured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_ACCESS_TOKEN),
      detail: "Requires an approved TikTok developer app with the Content Posting API. Approval by TikTok is a manual review on their side.",
      requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN"],
    },
  ];
}
