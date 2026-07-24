import { getStore } from "@/lib/store";
import { ownerKey, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Publishing is manual-approval only (phase one). This route never claims a
 * video was published: until platform credentials exist AND the platform API
 * confirms an upload, it returns the exact integration status and the action
 * you must take.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const p = await getStore().getProduction(id);
  if (!p || p.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
  if (!p.approved) return Response.json({ error: "Approve the production first (manual approval is required)." }, { status: 400 });

  const youtubeReady = Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN);
  const tiktokReady = Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_ACCESS_TOKEN);

  p.publish = p.publish.map((entry) => {
    const ready = entry.platform === "youtube" ? youtubeReady : tiktokReady;
    return ready
      ? { ...entry, status: "ready", requiredAction: "Credentials detected. Upload execution ships behind these credentials once you connect them — no publish is claimed until the platform API confirms it." }
      : {
          ...entry,
          status: "not_connected",
          requiredAction:
            entry.platform === "youtube"
              ? "Create a Google Cloud OAuth client with the youtube.upload scope, complete the OAuth consent flow, and set YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN."
              : "Register a TikTok developer app, pass TikTok's Content Posting API review, and set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_ACCESS_TOKEN.",
        };
  });
  p.updatedAt = new Date().toISOString();
  await getStore().saveProduction(p);
  return Response.json({
    production: p,
    published: false,
    note: "No video was published. Publishing requires connected platform credentials and API confirmation.",
  });
}
