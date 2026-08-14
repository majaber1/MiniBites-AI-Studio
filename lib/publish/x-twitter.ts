import { cleanEnv } from "@/lib/env";

export function xTwitterConfigured(): boolean {
  return Boolean(
    cleanEnv("X_API_KEY") &&
    cleanEnv("X_API_SECRET") &&
    cleanEnv("X_ACCESS_TOKEN") &&
    cleanEnv("X_ACCESS_TOKEN_SECRET")
  );
}

function buildOAuthHeader(method: string, url: string, params: Record<string, string> = {}): string {
  const apiKey = cleanEnv("X_API_KEY")!;
  const accessToken = cleanEnv("X_ACCESS_TOKEN")!;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...params };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");

  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(cleanEnv("X_API_SECRET")!)}&${encodeURIComponent(cleanEnv("X_ACCESS_TOKEN_SECRET")!)}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const msgData = encoder.encode(baseString);
  const signature = hmacSha1Sync(keyData, msgData);

  oauthParams["oauth_signature"] = signature;

  return "OAuth " + Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(", ");
}

function hmacSha1Sync(key: Uint8Array, message: Uint8Array): string {
  const { createHmac } = require("crypto") as typeof import("crypto");
  return createHmac("sha1", key).update(message).digest("base64");
}

export interface XUploadInput {
  videoUrl: string;
  text: string;
}

export async function postToX(input: XUploadInput): Promise<{ tweetId: string; url: string }> {
  const videoRes = await fetch(input.videoUrl, { cache: "no-store" });
  if (!videoRes.ok) throw new Error(`Could not download video (HTTP ${videoRes.status})`);
  const videoBytes = Buffer.from(await videoRes.arrayBuffer());

  const initUrl = "https://upload.twitter.com/1.1/media/upload.json";
  const initAuth = buildOAuthHeader("POST", initUrl);
  const initBody = new URLSearchParams({
    command: "INIT",
    total_bytes: videoBytes.length.toString(),
    media_type: "video/mp4",
    media_category: "tweet_video",
  });

  const initRes = await fetch(initUrl, {
    method: "POST",
    headers: { Authorization: initAuth, "Content-Type": "application/x-www-form-urlencoded" },
    body: initBody,
    cache: "no-store",
  });
  if (!initRes.ok) throw new Error(`X media init failed (HTTP ${initRes.status})`);
  const initData = (await initRes.json()) as { media_id_string?: string };
  if (!initData.media_id_string) throw new Error("X media init returned no media ID.");
  const mediaId = initData.media_id_string;

  const chunkSize = 5 * 1024 * 1024;
  for (let i = 0; i * chunkSize < videoBytes.length; i++) {
    const chunk = videoBytes.subarray(i * chunkSize, (i + 1) * chunkSize);
    const form = new FormData();
    form.append("command", "APPEND");
    form.append("media_id", mediaId);
    form.append("segment_index", i.toString());
    form.append("media_data", Buffer.from(chunk).toString("base64"));

    const appendAuth = buildOAuthHeader("POST", initUrl);
    const appendRes = await fetch(initUrl, {
      method: "POST",
      headers: { Authorization: appendAuth },
      body: form,
      cache: "no-store",
    });
    if (!appendRes.ok) throw new Error(`X media append failed on chunk ${i} (HTTP ${appendRes.status})`);
  }

  const finalizeAuth = buildOAuthHeader("POST", initUrl);
  const finalizeRes = await fetch(initUrl, {
    method: "POST",
    headers: { Authorization: finalizeAuth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "FINALIZE", media_id: mediaId }),
    cache: "no-store",
  });
  if (!finalizeRes.ok) throw new Error(`X media finalize failed (HTTP ${finalizeRes.status})`);

  const finalizeData = (await finalizeRes.json()) as { processing_info?: { state: string; check_after_secs: number } };
  if (finalizeData.processing_info) {
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((r) => setTimeout(r, (finalizeData.processing_info!.check_after_secs || 5) * 1000));
      const statusAuth = buildOAuthHeader("GET", `${initUrl}?command=STATUS&media_id=${mediaId}`);
      const statusRes = await fetch(`${initUrl}?command=STATUS&media_id=${mediaId}`, {
        headers: { Authorization: statusAuth },
        cache: "no-store",
      });
      if (!statusRes.ok) continue;
      const statusData = (await statusRes.json()) as { processing_info?: { state: string } };
      if (statusData.processing_info?.state === "succeeded") break;
      if (statusData.processing_info?.state === "failed") throw new Error("X video processing failed.");
    }
  }

  const tweetUrl = "https://api.twitter.com/2/tweets";
  const tweetAuth = buildOAuthHeader("POST", tweetUrl);
  const tweetRes = await fetch(tweetUrl, {
    method: "POST",
    headers: {
      Authorization: tweetAuth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: input.text.slice(0, 280),
      media: { media_ids: [mediaId] },
    }),
    cache: "no-store",
  });

  if (!tweetRes.ok) {
    const errBody = await tweetRes.text().catch(() => "");
    throw new Error(`X tweet failed (HTTP ${tweetRes.status}). ${errBody}`);
  }

  const tweetData = (await tweetRes.json()) as { data?: { id?: string } };
  if (!tweetData.data?.id) throw new Error("X tweet returned no tweet ID.");

  return {
    tweetId: tweetData.data.id,
    url: `https://x.com/i/status/${tweetData.data.id}`,
  };
}
