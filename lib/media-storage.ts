import { put } from "@vercel/blob";
import { cleanEnv } from "@/lib/env";

const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;

export function durableMediaConfigured(): boolean {
  return Boolean(cleanEnv("BLOB_READ_WRITE_TOKEN"));
}

/** Copies a provider-hosted MP4 into project-owned durable object storage. */
export async function archiveFinalVideo(sourceUrl: string, productionId: string): Promise<string> {
  if (!durableMediaConfigured()) throw new Error("Durable media storage is not configured.");
  const source = await fetch(sourceUrl, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
  if (!source.ok || !source.body) throw new Error(`Final video could not be read for archiving (HTTP ${source.status}).`);
  const length = Number(source.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_ARCHIVE_BYTES) throw new Error("Final video exceeds the 500 MB archive limit.");
  const blob = await put(`minibites/${productionId}/final.mp4`, source.body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "video/mp4",
    cacheControlMaxAge: 31_536_000,
    multipart: true,
  });
  return blob.url;
}
