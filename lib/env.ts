/**
 * Read an environment variable defensively: strip accidental wrapping
 * quotes and whitespace that come along when values are pasted from
 * .env-formatted copy buttons (Upstash, provider dashboards, etc.).
 * Returns undefined for missing/empty values so `??` fallbacks still work.
 */
export function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  const trimmed = raw?.trim().replace(/^["']+|["']+$/g, "").trim();
  return trimmed || undefined;
}
