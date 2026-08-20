import type { IntegrationStatus } from "./types";
import { getVideoProvider } from "./providers";
import { llmConfigured } from "./llm";
import { getStore } from "./store";
import { passwordConfigured } from "./security";
import { durableMediaConfigured } from "./media-storage";
import { cleanEnv } from "./env";

/** Reports only booleans and hints — never values of secrets. */
export function integrationStatuses(): IntegrationStatus[] {
  const provider = getVideoProvider();
  const llm = llmConfigured();
  const store = getStore();
  const geminiKey = Boolean(cleanEnv("GEMINI_API_KEY"));
  const falKey = Boolean(cleanEnv("FAL_KEY"));
  const imageModel = cleanEnv("GOOGLE_IMAGE_MODEL") ?? "imagen-3.0-generate-002";
  const videoModel = cleanEnv("GOOGLE_VIDEO_MODEL") ?? "veo-2.0-generate-001";
  const ttsModel = cleanEnv("GOOGLE_TTS_MODEL") ?? "gemini-2.5-flash";

  return [
    // --- CORE & STORAGE ---
    {
      key: "auth",
      label: "Studio access protection",
      category: "core",
      configured: passwordConfigured(),
      status: passwordConfigured() ? "ready" : "auth_required",
      detail: passwordConfigured() ? "Password gate and signed sessions active." : "Set APP_ACCESS_PASSWORD and SESSION_SECRET — generation stays locked until both exist.",
      requiredEnv: ["APP_ACCESS_PASSWORD", "SESSION_SECRET"],
    },
    {
      key: "database",
      label: "Production database",
      category: "core",
      configured: store.durable,
      status: store.durable ? "ready" : "not_connected",
      detail: store.durable ? `Durable (${store.name}): jobs and references survive reloads and restarts.` : "Non-durable store. Add Upstash Redis for persistence.",
      requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    },
    {
      key: "media-storage",
      label: "Durable final-video archive",
      category: "core",
      configured: durableMediaConfigured(),
      status: durableMediaConfigured() ? "ready" : "not_connected",
      detail: durableMediaConfigured() ? "Vercel Blob is ready to archive final MP4 files." : "Provider URLs can expire. Connect Vercel Blob before long-term production use.",
      requiredEnv: ["BLOB_READ_WRITE_TOKEN"],
    },

    // --- MEDIA ENGINES ---
    {
      key: "google-image",
      label: `Google Gemini / Imagen Image (${imageModel})`,
      category: "media",
      configured: geminiKey,
      status: geminiKey ? "ready" : "not_connected",
      detail: geminiKey ? `Ready to generate visual reference assets and keyframes using ${imageModel}.` : "Set GEMINI_API_KEY to generate kitchen and character references.",
      requiredEnv: ["GEMINI_API_KEY", "GOOGLE_IMAGE_MODEL"],
    },
    {
      key: "google-veo",
      label: `Google Veo Video (${videoModel})`,
      category: "media",
      configured: geminiKey,
      status: geminiKey ? "ready" : "not_connected",
      detail: geminiKey ? `Ready to generate 9:16 vertical video with native audio and reference images using ${videoModel}.` : "Set GEMINI_API_KEY for Google Veo video generation.",
      requiredEnv: ["GEMINI_API_KEY", "GOOGLE_VIDEO_MODEL"],
    },
    {
      key: "google-tts",
      label: `Gemini Text-to-Speech (${ttsModel})`,
      category: "media",
      configured: geminiKey,
      status: geminiKey ? "ready" : "not_connected",
      detail: geminiKey ? `Ready to synthesize exact Arabic dialogue with prebuilt character voice profiles (${ttsModel}).` : "Set GEMINI_API_KEY for Gemini TTS character dialogue.",
      requiredEnv: ["GEMINI_API_KEY", "GOOGLE_TTS_MODEL"],
    },
    {
      key: "fal",
      label: "fal.ai (generation & ffmpeg assembly)",
      category: "media",
      configured: falKey,
      status: falKey ? "ready" : "not_connected",
      detail: falKey ? "fal.ai active for multi-model video generation and FFmpeg clip assembly/merging." : "Set FAL_KEY for fal models and automatic single-MP4 concat.",
      requiredEnv: ["FAL_KEY"],
    },
    {
      key: "wan",
      label: "Wan Video (self-hosted)",
      category: "media",
      configured: Boolean(cleanEnv("WAN_VIDEO_TOKEN")),
      status: Boolean(cleanEnv("WAN_VIDEO_TOKEN")) ? "ready" : "not_connected",
      detail: Boolean(cleanEnv("WAN_VIDEO_TOKEN")) ? "Self-hosted Wan GPU worker connected." : "Set WAN_VIDEO_TOKEN and WAN_VIDEO_ENDPOINT for custom GPU worker.",
      requiredEnv: ["WAN_VIDEO_TOKEN", "WAN_VIDEO_ENDPOINT"],
    },
    {
      key: "llm",
      label: "Planning LLM",
      category: "media",
      configured: Boolean(llm),
      status: Boolean(llm) ? "ready" : "not_connected",
      detail: llm ? `Connected: ${llm}.` : "No LLM key — studio uses deterministic structured template plans.",
      requiredEnv: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
    },

    // --- SOCIAL PUBLISHING ---
    {
      key: "youtube",
      label: "YouTube Shorts publishing",
      category: "social",
      configured: Boolean(cleanEnv("YOUTUBE_CLIENT_ID") && cleanEnv("YOUTUBE_CLIENT_SECRET") && cleanEnv("YOUTUBE_REFRESH_TOKEN")),
      status: Boolean(cleanEnv("YOUTUBE_CLIENT_ID") && cleanEnv("YOUTUBE_CLIENT_SECRET") && cleanEnv("YOUTUBE_REFRESH_TOKEN")) ? "connected" : "auth_required",
      detail: Boolean(cleanEnv("YOUTUBE_CLIENT_ID") && cleanEnv("YOUTUBE_CLIENT_SECRET") && cleanEnv("YOUTUBE_REFRESH_TOKEN"))
        ? "Connected: approved productions upload to YouTube as private Shorts on publish."
        : "Requires a Google Cloud OAuth client with youtube.upload scope and a refresh token.",
      requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
    },
    {
      key: "tiktok",
      label: "TikTok publishing",
      category: "social",
      configured: Boolean(cleanEnv("TIKTOK_CLIENT_KEY") && cleanEnv("TIKTOK_CLIENT_SECRET") && cleanEnv("TIKTOK_ACCESS_TOKEN")),
      status: Boolean(cleanEnv("TIKTOK_CLIENT_KEY") && cleanEnv("TIKTOK_CLIENT_SECRET") && cleanEnv("TIKTOK_ACCESS_TOKEN")) ? "connected" : "auth_required",
      detail: Boolean(cleanEnv("TIKTOK_CLIENT_KEY") && cleanEnv("TIKTOK_CLIENT_SECRET") && cleanEnv("TIKTOK_ACCESS_TOKEN"))
        ? "Connected: approved productions upload to TikTok via Content Posting API."
        : "Requires an approved TikTok developer app with Content Posting API scopes.",
      requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN"],
    },
    {
      key: "instagram",
      label: "Instagram Reels publishing",
      category: "social",
      configured: Boolean(cleanEnv("INSTAGRAM_ACCESS_TOKEN") && cleanEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID")),
      status: Boolean(cleanEnv("INSTAGRAM_ACCESS_TOKEN") && cleanEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID")) ? "connected" : "auth_required",
      detail: Boolean(cleanEnv("INSTAGRAM_ACCESS_TOKEN") && cleanEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID"))
        ? `Connected: approved productions publish as Instagram Reels via Meta Graph API (${cleanEnv("INSTAGRAM_GRAPH_VERSION") ?? "v21.0"}).`
        : "Requires an Instagram Business account connected to a Facebook Page, with a long-lived access token.",
      requiredEnv: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID"],
    },
    {
      key: "x-twitter",
      label: "X / Twitter publishing",
      category: "social",
      configured: Boolean(cleanEnv("X_API_KEY") && cleanEnv("X_API_SECRET") && cleanEnv("X_ACCESS_TOKEN") && cleanEnv("X_ACCESS_TOKEN_SECRET")),
      status: Boolean(cleanEnv("X_API_KEY") && cleanEnv("X_API_SECRET") && cleanEnv("X_ACCESS_TOKEN") && cleanEnv("X_ACCESS_TOKEN_SECRET")) ? "connected" : "auth_required",
      detail: Boolean(cleanEnv("X_API_KEY") && cleanEnv("X_API_SECRET") && cleanEnv("X_ACCESS_TOKEN") && cleanEnv("X_ACCESS_TOKEN_SECRET"))
        ? "Connected: approved productions post to X/Twitter with video attachment."
        : "Requires an X developer app with media upload permission and OAuth 1.0a credentials.",
      requiredEnv: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"],
    },
    {
      key: "snapchat",
      label: "Snapchat Spotlight publishing",
      category: "social",
      configured: false,
      status: "manual_only",
      detail: "MANUAL ONLY: Organic Spotlight publishing requires Snap Kit Creative Kit or manual app upload. Safe manual handoff (Download MP4, Copy Caption, Open Snapchat) is enabled.",
      requiredEnv: ["SNAPCHAT_CLIENT_ID", "SNAPCHAT_CLIENT_SECRET", "SNAPCHAT_REFRESH_TOKEN"],
    },
  ];
}
