import { cleanEnv } from "@/lib/env";

export function instagramConfigured(): boolean {
  return Boolean(
    cleanEnv("INSTAGRAM_ACCESS_TOKEN") &&
    cleanEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID")
  );
}

export interface InstagramUploadInput {
  videoUrl: string;
  caption: string;
}

export async function uploadToInstagramReels(input: InstagramUploadInput): Promise<{ mediaId: string; permalink: string }> {
  const token = cleanEnv("INSTAGRAM_ACCESS_TOKEN")!;
  const accountId = cleanEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID")!;

  const createRes = await fetch(
    `https://graph.facebook.com/v21.0/${accountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: input.videoUrl,
        caption: input.caption.slice(0, 2200),
        share_to_feed: true,
        access_token: token,
      }),
      cache: "no-store",
    }
  );

  if (!createRes.ok) {
    const errBody = await createRes.text().catch(() => "");
    throw new Error(`Instagram container creation failed (HTTP ${createRes.status}). ${errBody}`);
  }

  const createData = (await createRes.json()) as { id?: string };
  if (!createData.id) throw new Error("Instagram returned no container ID.");
  const containerId = createData.id;

  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${token}`,
      { cache: "no-store" }
    );
    if (!statusRes.ok) continue;
    const statusData = (await statusRes.json()) as { status_code?: string };
    if (statusData.status_code === "FINISHED") { ready = true; break; }
    if (statusData.status_code === "ERROR") throw new Error("Instagram video processing failed. The video may be in an unsupported format.");
  }
  if (!ready) throw new Error("Instagram video processing timed out. Try again later.");

  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${accountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: token,
      }),
      cache: "no-store",
    }
  );

  if (!publishRes.ok) {
    const errBody = await publishRes.text().catch(() => "");
    throw new Error(`Instagram publish failed (HTTP ${publishRes.status}). ${errBody}`);
  }

  const publishData = (await publishRes.json()) as { id?: string };
  if (!publishData.id) throw new Error("Instagram publish returned no media ID.");

  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${publishData.id}?fields=permalink&access_token=${token}`,
    { cache: "no-store" }
  );
  const mediaData = (await mediaRes.json()) as { permalink?: string };

  return {
    mediaId: publishData.id,
    permalink: mediaData.permalink ?? `https://www.instagram.com/`,
  };
}
