import { archiveProduction } from "@/lib/agents/pipeline";
import { ownerKey, requireAuth } from "@/lib/security";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const production = await store.getProduction(id);
  if (!production || production.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
  try {
    return Response.json({ production: await archiveProduction(production) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The project could not be archived." }, { status: 400 });
  }
}
