import { cleanEnv } from "@/lib/env";

export function snapchatConfigured(): boolean {
  return Boolean(
    cleanEnv("SNAPCHAT_CLIENT_ID") &&
    cleanEnv("SNAPCHAT_CLIENT_SECRET") &&
    cleanEnv("SNAPCHAT_REFRESH_TOKEN")
  );
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://accounts.snapchat.com/login/oauth2/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cleanEnv("SNAPCHAT_CLIENT_ID")!,
      client_secret: cleanEnv("SNAPCHAT_CLIENT_SECRET")!,
      grant_type: "refresh_token",
      refresh_token: cleanEnv("SNAPCHAT_REFRESH_TOKEN")!,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Snapchat token refresh failed (HTTP ${res.status}).`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Snapchat OAuth returned no access token.");
  return data.access_token;
}

export interface SnapchatUploadInput {
  videoUrl: string;
  caption: string;
}

export async function postToSnapchatSpotlight(input: SnapchatUploadInput): Promise<{ mediaId: string; status: string }> {
  const token = await getAccessToken();

  const videoRes = await fetch(input.videoUrl, { cache: "no-store" });
  if (!videoRes.ok) throw new Error(`Could not download video (HTTP ${videoRes.status})`);
  const videoBytes = Buffer.from(await videoRes.arrayBuffer());

  const uploadRes = await fetch("https://adsapi.snapchat.com/v1/media", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      media: [{
        name: input.caption.slice(0, 64),
        type: "VIDEO",
      }],
    }),
    cache: "no-store",
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text().catch(() => "");
    throw new Error(`Snapchat media creation failed (HTTP ${uploadRes.status}). ${errBody}`);
  }

  const uploadData = (await uploadRes.json()) as { media?: Array<{ media?: { id?: string; upload_link?: string } }> };
  const media = uploadData.media?.[0]?.media;
  if (!media?.id || !media.upload_link) throw new Error("Snapchat returned no media upload link.");

  const putRes = await fetch(media.upload_link, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "video/mp4",
    },
    body: videoBytes,
    cache: "no-store",
  });

  if (!putRes.ok) throw new Error(`Snapchat video upload failed (HTTP ${putRes.status}).`);

  return { mediaId: media.id, status: "uploaded" };
}
