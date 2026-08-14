import { getStore } from "@/lib/store";
import { ownerKey, requireAuth } from "@/lib/security";
import { uploadShort, youtubeConfigured } from "@/lib/publish/youtube";
import { tiktokConfigured, uploadToTikTok } from "@/lib/publish/tiktok";
import { instagramConfigured, uploadToInstagramReels } from "@/lib/publish/instagram";
import { xTwitterConfigured, postToX } from "@/lib/publish/x-twitter";
import { snapchatConfigured, postToSnapchatSpotlight } from "@/lib/publish/snapchat";
import type { PublishPlatform } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({})) as { platforms?: PublishPlatform[] };
  const store = getStore();
  const lockToken = await store.acquireLock(`publish:${id}`, 120);
  if (!lockToken) return Response.json({ error: "Publishing is already in progress. No second upload was started." }, { status: 409 });
  try {
    const p = await store.getProduction(id);
    if (!p || p.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
    if (!p.approved) return Response.json({ error: "Approve the production first (manual approval is required)." }, { status: 400 });

    const selectedPlatforms = body.platforms ?? p.publish.map((e) => e.platform);

    const title = p.publishTitle ?? `Real Miniature ${p.dish} — Tiny Kitchen ASMR`;
    const caption = p.publishCaption ?? `We cooked a real ${p.dish} in a 1:12 kitchen. Every ingredient is edible.`;
    const hashtags = p.publishHashtags ?? ["#miniaturecooking", "#minifood", "#asmr", "#tinykitchen"];

    for (const entry of p.publish) {
      if (entry.status === "published") continue;
      if (!selectedPlatforms.includes(entry.platform)) continue;

      if (entry.platform === "youtube") {
        if (!youtubeConfigured()) {
          entry.status = "not_connected";
          entry.requiredAction = "Create a Google Cloud OAuth client with the youtube.upload scope, complete the OAuth consent flow, and set YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN.";
          continue;
        }
        if (!p.finalVideoUrl || !p.assembled) {
          entry.status = "ready";
          entry.requiredAction = "No merged single MP4 exists for this production. Publishing uploads only a real assembled video.";
          continue;
        }
        try {
          const result = await uploadShort({
            videoUrl: p.finalVideoUrl,
            title,
            description: `${caption}\n\n${hashtags.join(" ")}`,
            tags: hashtags,
          });
          entry.status = "published";
          entry.url = result.url;
          entry.externalId = result.videoId;
          entry.requiredAction = undefined;
        } catch (err) {
          entry.status = "failed";
          entry.requiredAction = `Upload failed: ${err instanceof Error ? err.message : "unknown error"}`;
        }
        continue;
      }

      if (entry.platform === "tiktok") {
        if (!tiktokConfigured()) {
          entry.status = "not_connected";
          entry.requiredAction = "Register a TikTok developer app, pass TikTok's Content Posting API review, and set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_ACCESS_TOKEN.";
          continue;
        }
        if (!p.finalVideoUrl || !p.assembled) {
          entry.status = "ready";
          entry.requiredAction = "No merged single MP4 exists. Assemble the final video first.";
          continue;
        }
        try {
          const result = await uploadToTikTok({
            videoUrl: p.finalVideoUrl,
            title,
            description: `${caption}\n\n${hashtags.slice(0, 5).join(" ")}`,
          });
          entry.status = "processing";
          entry.externalId = result.publishId;
          entry.requiredAction = "Video uploaded to TikTok and processing. It will appear on your profile shortly.";
        } catch (err) {
          entry.status = "failed";
          entry.requiredAction = `Upload failed: ${err instanceof Error ? err.message : "unknown error"}`;
        }
        continue;
      }

      if (entry.platform === "instagram") {
        if (!instagramConfigured()) {
          entry.status = "not_connected";
          entry.requiredAction = "Connect an Instagram Business account. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID.";
          continue;
        }
        if (!p.finalVideoUrl || !p.assembled) {
          entry.status = "ready";
          entry.requiredAction = "No merged single MP4 exists. Assemble the final video first.";
          continue;
        }
        try {
          const result = await uploadToInstagramReels({
            videoUrl: p.finalVideoUrl,
            caption: `${caption}\n\n${hashtags.join(" ")}`,
          });
          entry.status = "published";
          entry.url = result.permalink;
          entry.externalId = result.mediaId;
          entry.requiredAction = undefined;
        } catch (err) {
          entry.status = "failed";
          entry.requiredAction = `Upload failed: ${err instanceof Error ? err.message : "unknown error"}`;
        }
        continue;
      }

      if (entry.platform === "x") {
        if (!xTwitterConfigured()) {
          entry.status = "not_connected";
          entry.requiredAction = "Connect an X/Twitter developer app. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.";
          continue;
        }
        if (!p.finalVideoUrl || !p.assembled) {
          entry.status = "ready";
          entry.requiredAction = "No merged single MP4 exists. Assemble the final video first.";
          continue;
        }
        try {
          const result = await postToX({
            videoUrl: p.finalVideoUrl,
            text: p.socialPack?.xTweet ?? `${caption} ${hashtags.slice(0, 3).join(" ")}`.slice(0, 280),
          });
          entry.status = "published";
          entry.url = result.url;
          entry.externalId = result.tweetId;
          entry.requiredAction = undefined;
        } catch (err) {
          entry.status = "failed";
          entry.requiredAction = `Post failed: ${err instanceof Error ? err.message : "unknown error"}`;
        }
        continue;
      }

      if (entry.platform === "snapchat") {
        if (!snapchatConfigured()) {
          entry.status = "not_connected";
          entry.requiredAction = "Connect a Snapchat developer app. Set SNAPCHAT_CLIENT_ID, SNAPCHAT_CLIENT_SECRET, SNAPCHAT_REFRESH_TOKEN.";
          continue;
        }
        if (!p.finalVideoUrl || !p.assembled) {
          entry.status = "ready";
          entry.requiredAction = "No merged single MP4 exists. Assemble the final video first.";
          continue;
        }
        try {
          const result = await postToSnapchatSpotlight({
            videoUrl: p.finalVideoUrl,
            caption: p.socialPack?.snapchatCaption ?? caption.slice(0, 64),
          });
          entry.status = "processing";
          entry.externalId = result.mediaId;
          entry.requiredAction = "Video uploaded to Snapchat. It may take a moment to process.";
        } catch (err) {
          entry.status = "failed";
          entry.requiredAction = `Upload failed: ${err instanceof Error ? err.message : "unknown error"}`;
        }
        continue;
      }
    }

    const published = p.publish.some((e) => e.status === "published" || e.status === "processing");
    if (published) p.status = "completed";
    p.updatedAt = new Date().toISOString();
    await store.saveProduction(p);
    return Response.json({
      production: p,
      published,
      note: published
        ? "Published entries were confirmed by the platform API."
        : "No video was published yet. See each platform's status for the required action.",
    });
  } finally {
    await store.releaseLock(`publish:${id}`, lockToken);
  }
}
