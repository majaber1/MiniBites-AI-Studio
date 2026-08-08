import { getStore } from "@/lib/store";
import { retryShot } from "@/lib/agents/pipeline";
import { ownerKey, rateLimit, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "retry", 10, 60);
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { shotId?: string } | null;
  if (!body?.shotId) return Response.json({ error: "shotId is required." }, { status: 400 });
  const store = getStore();
  const lockToken = await store.acquireLock(`advance:${id}`, 30);
  if (!lockToken) return Response.json({ error: "This project is already being updated." }, { status: 409 });
  try {
    const p = await store.getProduction(id);
    if (!p || p.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
    const updated = await retryShot(p, body.shotId);
    return Response.json({ production: updated });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Retry failed." }, { status: 400 });
  } finally {
    await store.releaseLock(`advance:${id}`, lockToken);
  }
}
