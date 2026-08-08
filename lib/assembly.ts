// ---------------------------------------------------------------------------
// Assembly via fal.ai's ffmpeg service (fal-ai/ffmpeg-api/merge-videos).
// Reuses the existing FAL_KEY — no separate worker needed. Queue-based and
// poll-driven, matching the rest of the pipeline: submit returns a request id,
// and advanceProduction polls it until the merged MP4 URL is ready.
// fal queue rule: submit uses the full subpath, but request status/result use
// the base "{namespace}/{model}" id (fal-ai/ffmpeg-api).
// ---------------------------------------------------------------------------
import { cleanEnv } from "@/lib/env";

const SUBMIT_PATH = "fal-ai/ffmpeg-api/merge-videos";
const REQUEST_BASE = "fal-ai/ffmpeg-api";

export function falAssemblyConfigured(): boolean {
  return Boolean(cleanEnv("FAL_KEY"));
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`https://queue.fal.run/${path}`, {
    ...init,
    headers: {
      Authorization: `Key ${cleanEnv("FAL_KEY") ?? ""}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`fal ffmpeg request failed (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function submitMerge(videoUrls: string[]): Promise<string> {
  const data = (await req(SUBMIT_PATH, {
    method: "POST",
    body: JSON.stringify({ video_urls: videoUrls }),
  })) as { request_id: string };
  if (!data.request_id) throw new Error("fal ffmpeg returned no request_id");
  return data.request_id;
}

export type MergeState =
  | { state: "in_queue"; queuePosition?: number }
  | { state: "running" }
  | { state: "completed" }
  | { state: "failed"; error: string };

export async function getMergeStatus(requestId: string): Promise<MergeState> {
  const data = (await req(`${REQUEST_BASE}/requests/${requestId}/status`)) as {
    status: string;
    queue_position?: number;
  };
  if (data.status === "IN_QUEUE") return { state: "in_queue", queuePosition: data.queue_position };
  if (data.status === "IN_PROGRESS") return { state: "running" };
  if (data.status === "COMPLETED") return { state: "completed" };
  return { state: "failed", error: `fal ffmpeg status: ${data.status}` };
}

export async function getMergeResult(requestId: string): Promise<string> {
  const data = (await req(`${REQUEST_BASE}/requests/${requestId}`)) as {
    video?: { url?: string };
    video_url?: string;
    videos?: Array<{ url?: string }>;
  };
  const url = data.video?.url ?? data.video_url ?? data.videos?.[0]?.url;
  if (!url) throw new Error("fal ffmpeg returned no merged video URL");
  return url;
}
