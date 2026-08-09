import { startAssembly } from "@/lib/agents/pipeline";
import { ownerKey, requireAuth } from "@/lib/security";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const lockToken = await store.acquireLock(`assemble:${id}`, 30);
  if (!lockToken) return Response.json({ error: "Final video preparation is already starting." }, { status: 409 });
  try {
    const production = await store.getProduction(id);
    if (!production || production.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
    if (production.status === "assembling") return Response.json({ production, duplicatePrevented: true });
    return Response.json({ production: await startAssembly(production) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The final video could not be started." }, { status: 400 });
  } finally {
    await store.releaseLock(`assemble:${id}`, lockToken);
  }
}
