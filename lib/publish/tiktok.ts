import { cleanEnv } from "@/lib/env";

export function tiktokConfigured(): boolean {
  return Boolean(
    cleanEnv("TIKTOK_CLIENT_KEY") &&
    cleanEnv("TIKTOK_CLIENT_SECRET") &&
    cleanEnv("TIKTOK_ACCESS_TOKEN")
  );
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = cleanEnv("TIKTOK_REFRESH_TOKEN");
  if (refreshToken) {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: cleanEnv("TIKTOK_CLIENT_KEY")!,
        client_secret: cleanEnv("TIKTOK_CLIENT_SECRET")!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { access_token?: string };
      if (data.access_token) return data.access_token;
    }
  }
  const token = cleanEnv("TIKTOK_ACCESS_TOKEN");
  if (!token) throw new Error("No TikTok access token available.");
  return token;
}

export interface TikTokUploadInput {
  videoUrl: string;
  title: string;
  description: string;
}

export async function uploadToTikTok(input: TikTokUploadInput): Promise<{ publishId: string; status: string }> {
  const token = await refreshAccessToken();

  const videoRes = await fetch(input.videoUrl, { cache: "no-store" });
  if (!videoRes.ok) throw new Error(`Could not download video (HTTP ${videoRes.status})`);
  const videoBytes = Buffer.from(await videoRes.arrayBuffer());

  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: {
        title: input.title.slice(0, 150),
        privacy_level: cleanEnv("TIKTOK_PRIVACY") ?? "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoBytes.length,
        chunk_size: videoBytes.length,
        total_chunk_count: 1,
      },
    }),
    cache: "no-store",
  });

  if (!initRes.ok) {
    const errBody = await initRes.text().catch(() => "");
    throw new Error(`TikTok upload init failed (HTTP ${initRes.status}). ${errBody}`);
  }

  const initData = (await initRes.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };

  if (initData.error?.code && initData.error.code !== "ok") {
    throw new Error(`TikTok API error: ${initData.error.message ?? initData.error.code}`);
  }

  const uploadUrl = initData.data?.upload_url;
  const publishId = initData.data?.publish_id;
  if (!uploadUrl || !publishId) throw new Error("TikTok init returned no upload URL or publish ID.");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${videoBytes.length - 1}/${videoBytes.length}`,
    },
    body: videoBytes,
    cache: "no-store",
  });

  if (!uploadRes.ok) {
    throw new Error(`TikTok video upload failed (HTTP ${uploadRes.status}). Your video is safe; retry when ready.`);
  }

  return { publishId, status: "processing" };
}
