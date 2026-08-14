import type { IntegrationStatus } from "./types";
import { getVideoProvider } from "./providers";
import { llmConfigured } from "./llm";
import { getStore } from "./store";
import { passwordConfigured } from "./security";
import { durableMediaConfigured } from "./media-storage";

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
      detail: passwordConfigured() ? "Password gate and signed sessions active." : "Set APP_ACCESS_PASSWORD and SESSION_SECRET — generation stays locked until both exist.",
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
      configured: Boolean(process.env.FAL_KEY),
      detail: process.env.FAL_KEY
        ? "fal.ai ffmpeg merge active: shots are concatenated into one vertical MP4 automatically."
        : "Not set: clips download individually; automatic single-MP4 concat needs FAL_KEY.",
      requiredEnv: ["FAL_KEY"],
    },
    {
      key: "media-storage",
      label: "Durable final-video archive",
      configured: durableMediaConfigured(),
      detail: durableMediaConfigured() ? "Vercel Blob is ready to archive final MP4 files." : "Provider URLs can expire. Connect Vercel Blob before long-term production use.",
      requiredEnv: ["BLOB_READ_WRITE_TOKEN"],
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
      detail: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_ACCESS_TOKEN)
        ? "Connected: approved productions upload to TikTok via Content Posting API."
        : "Requires an approved TikTok developer app with the Content Posting API.",
      requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN"],
    },
    {
      key: "instagram",
      label: "Instagram Reels publishing",
      configured: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
      detail: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID)
        ? "Connected: approved productions publish as Instagram Reels via Graph API."
        : "Requires an Instagram Business account connected to a Facebook Page, with a long-lived access token.",
      requiredEnv: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID"],
    },
    {
      key: "x-twitter",
      label: "X / Twitter publishing",
      configured: Boolean(process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET),
      detail: Boolean(process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET)
        ? "Connected: approved productions post to X/Twitter with video attachment."
        : "Requires an X developer app with Elevated access and media upload permission.",
      requiredEnv: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"],
    },
    {
      key: "snapchat",
      label: "Snapchat Spotlight publishing",
      configured: Boolean(process.env.SNAPCHAT_CLIENT_ID && process.env.SNAPCHAT_CLIENT_SECRET && process.env.SNAPCHAT_REFRESH_TOKEN),
      detail: Boolean(process.env.SNAPCHAT_CLIENT_ID && process.env.SNAPCHAT_CLIENT_SECRET && process.env.SNAPCHAT_REFRESH_TOKEN)
        ? "Connected: approved productions upload to Snapchat Spotlight."
        : "Requires a Snapchat developer app with Spotlight API access.",
      requiredEnv: ["SNAPCHAT_CLIENT_ID", "SNAPCHAT_CLIENT_SECRET", "SNAPCHAT_REFRESH_TOKEN"],
    },
  ];
}
