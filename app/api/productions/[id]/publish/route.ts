import { getStore } from "@/lib/store";
import { ownerKey, requireAuth } from "@/lib/security";
import { cleanEnv } from "@/lib/env";
import { uploadShort, youtubeConfigured } from "@/lib/publish/youtube";

export const dynamic = "force-dynamic";
// Downloading the merged MP4 and uploading it to YouTube can take a while.
export const maxDuration = 60;

/**
 * Publishing is manual-approval only. This route never claims a video was
 * published unless the platform API confirms the upload (a video id is
 * returned). YouTube Shorts upload is implemented; TikTok requires an
 * approved Content Posting API app and remains prepared-only until then.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const p = await store.getProduction(id);
  if (!p || p.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
  if (!p.approved) return Response.json({ error: "Approve the production first (manual approval is required)." }, { status: 400 });

  const tiktokReady = Boolean(cleanEnv("TIKTOK_CLIENT_KEY") && cleanEnv("TIKTOK_CLIENT_SECRET") && cleanEnv("TIKTOK_ACCESS_TOKEN"));

  const title = p.publishTitle ?? `Real Miniature ${p.dish} — Tiny Kitchen ASMR`;
  const caption = p.publishCaption ?? `We cooked a real ${p.dish} in a 1:12 kitchen. Every ingredient is edible.`;
  const hashtags = p.publishHashtags ?? ["#miniaturecooking", "#minifood", "#asmr", "#tinykitchen"];

  for (const entry of p.publish) {
    if (entry.status === "published") continue; // idempotent: never re-upload

    if (entry.platform === "youtube") {
      if (!youtubeConfigured()) {
        entry.status = "not_connected";
        entry.requiredAction =
          "Create a Google Cloud OAuth client with the youtube.upload scope, complete the OAuth consent flow, and set YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN.";
        continue;
      }
      if (!p.finalVideoUrl || !p.assembled) {
        entry.status = "ready";
        entry.requiredAction =
          "No merged single MP4 exists for this production (assembly fell back to individual clips). Publishing uploads only a real assembled video.";
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
        entry.requiredAction = undefined;
      } catch (err) {
        entry.status = "failed";
        entry.requiredAction = `Upload failed: ${err instanceof Error ? err.message : "unknown error"}`;
      }
      continue;
    }

    // TikTok
    entry.status = tiktokReady ? "ready" : "not_connected";
    entry.requiredAction = tiktokReady
      ? "TikTok credentials detected, but automated posting ships only after the app passes TikTok's Content Posting API review. Until then, download the MP4 and post from the TikTok app."
      : "Register a TikTok developer app, pass TikTok's Content Posting API review, and set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_ACCESS_TOKEN.";
  }

  const published = p.publish.some((e) => e.status === "published");
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
}
