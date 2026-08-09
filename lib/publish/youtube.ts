// ---------------------------------------------------------------------------
// YouTube Shorts publishing. Server-side only. Uses a long-lived OAuth
// refresh token (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET /
// YOUTUBE_REFRESH_TOKEN) to mint an access token, downloads the assembled
// MP4, and uploads it via the YouTube Data API. A production is marked
// "published" ONLY when the API returns a video id — never before.
// Vertical videos under 3 minutes are surfaced as Shorts automatically.
// ---------------------------------------------------------------------------
import { cleanEnv } from "@/lib/env";

export function youtubeConfigured(): boolean {
  return Boolean(cleanEnv("YOUTUBE_CLIENT_ID") && cleanEnv("YOUTUBE_CLIENT_SECRET") && cleanEnv("YOUTUBE_REFRESH_TOKEN"));
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cleanEnv("YOUTUBE_CLIENT_ID")!,
      client_secret: cleanEnv("YOUTUBE_CLIENT_SECRET")!,
      refresh_token: cleanEnv("YOUTUBE_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`YouTube connection failed (HTTP ${res.status}). Reconnect the channel and try again.`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("YouTube OAuth returned no access token");
  return data.access_token;
}

export interface UploadInput {
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
}

export async function uploadShort(input: UploadInput): Promise<{ videoId: string; url: string }> {
  const token = await getAccessToken();

  const videoRes = await fetch(input.videoUrl, { cache: "no-store" });
  if (!videoRes.ok) throw new Error(`Could not download final video (HTTP ${videoRes.status})`);
  const videoBytes = Buffer.from(await videoRes.arrayBuffer());

  const metadata = {
    snippet: {
      // YouTube titles max 100 chars.
      title: input.title.slice(0, 100),
      description: `${input.description}\n\n#Shorts`.slice(0, 4900),
      tags: input.tags.map((t) => t.replace(/^#/, "")).slice(0, 20),
      categoryId: "26", // Howto & Style
    },
    status: {
      // Safe default for a newly connected channel. Switch to public only
      // after the creator has verified the result and the API project audit.
      privacyStatus: cleanEnv("YOUTUBE_PRIVACY") ?? "private",
      selfDeclaredMadeForKids: false,
    },
  };

  const boundary = `minibites_${Date.now().toString(36)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
    "utf8"
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const body = Buffer.concat([head, videoBytes, tail]);

  const up = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
    cache: "no-store",
  });
  if (!up.ok) {
    throw new Error(`YouTube upload failed (HTTP ${up.status}). Your approved video is safe; retry when the connection is ready.`);
  }
  const data = (await up.json()) as { id?: string };
  if (!data.id) throw new Error("YouTube upload returned no video id");
  return { videoId: data.id, url: `https://www.youtube.com/shorts/${data.id}` };
}
