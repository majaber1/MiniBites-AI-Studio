import { startGeneration } from "@/lib/agents/pipeline";
import { ownerKey, rateLimit, requireAuth } from "@/lib/security";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "generate", 6, 60);
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const { id } = await ctx.params;
  const store = getStore();
  const lockToken = await store.acquireLock(`generate:${id}`, 30);
  if (!lockToken) return Response.json({ error: "Generation is already starting." }, { status: 409 });
  try {
    const production = await store.getProduction(id);
    if (!production || production.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
    if (production.status === "generating") return Response.json({ production, duplicatePrevented: true });
    return Response.json({ production: await startGeneration(production) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Generation could not start." }, { status: 400 });
  } finally {
    await store.releaseLock(`generate:${id}`, lockToken);
  }
}
