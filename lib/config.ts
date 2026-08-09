import { cleanEnv } from "@/lib/env";

export type EnvironmentCategory = "core" | "provider" | "optional";
export interface SafeEnvironmentEntry { name: string; category: EnvironmentCategory; configured: boolean; required: boolean }

export function environmentReport(): { productionReady: boolean; entries: SafeEnvironmentEntry[]; missingRequired: string[] } {
  const provider = (cleanEnv("VIDEO_PROVIDER") ?? "fal").toLowerCase();
  const required = new Set(["APP_ACCESS_PASSWORD", "SESSION_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VIDEO_PROVIDER"]);
  if (provider === "fal") required.add("FAL_KEY");
  if (provider === "google") { required.add("GEMINI_API_KEY"); required.add("FAL_KEY"); }
  if (provider === "wan") required.add("WAN_VIDEO_ENDPOINT");
  const groups: Record<EnvironmentCategory, string[]> = {
    core: ["APP_ACCESS_PASSWORD", "SESSION_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VIDEO_PROVIDER"],
    provider: ["FAL_KEY", "FAL_MODEL_ID", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "WAN_VIDEO_ENDPOINT", "WAN_VIDEO_TOKEN"],
    optional: ["ADMIN_ACCESS_PASSWORD", "BLOB_READ_WRITE_TOKEN", "YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN", "STORAGE_S3_ENDPOINT", "STORAGE_S3_BUCKET", "STORAGE_S3_ACCESS_KEY_ID", "STORAGE_S3_SECRET_ACCESS_KEY"],
  };
  const entries = (Object.entries(groups) as Array<[EnvironmentCategory, string[]]>).flatMap(([category, names]) => names.map((name) => ({ name, category, configured: Boolean(cleanEnv(name)), required: required.has(name) })));
  const missingRequired = entries.filter((entry) => entry.required && !entry.configured).map((entry) => entry.name);
  return { productionReady: missingRequired.length === 0 && provider !== "mock", entries, missingRequired };
}
