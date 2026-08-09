import { regenerateShot, setShotAcceptance } from "@/lib/agents/pipeline";
import { ownerKey, rateLimit, requireAuth } from "@/lib/security";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "shot-review", 20, 60);
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { shotId?: string; action?: "accept" | "reject" | "regenerate"; confirmCost?: boolean } | null;
  if (!body?.shotId || !body.action) return Response.json({ error: "Choose a clip and review action." }, { status: 400 });
  if (body.action === "regenerate" && body.confirmCost !== true) {
    return Response.json({ error: "Confirm the additional generation cost before regenerating this clip." }, { status: 400 });
  }
  const store = getStore();
  const lockKey = `shot-review:${id}:${body.shotId}`;
  const lockToken = await store.acquireLock(lockKey, 30);
  if (!lockToken) return Response.json({ error: "This clip is already being updated." }, { status: 409 });
  try {
    const production = await store.getProduction(id);
    if (!production || production.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
    const updated = body.action === "regenerate"
      ? await regenerateShot(production, body.shotId)
      : await setShotAcceptance(production, body.shotId, body.action === "accept");
    return Response.json({ production: updated });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The clip could not be updated." }, { status: 400 });
  } finally {
    await store.releaseLock(lockKey, lockToken);
  }
}
