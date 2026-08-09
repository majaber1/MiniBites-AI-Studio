import { duplicateProduction } from "@/lib/agents/pipeline";
import { ownerKey, rateLimit, requireAuth } from "@/lib/security";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "duplicate", 10, 60);
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const { id } = await ctx.params;
  const store = getStore();
  const lockToken = await store.acquireLock(`duplicate:${id}`, 20);
  if (!lockToken) return Response.json({ error: "This project is already being duplicated." }, { status: 409 });
  try {
    const source = await store.getProduction(id);
    if (!source || source.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
    return Response.json({ production: await duplicateProduction(source) }, { status: 201 });
  } finally {
    await store.releaseLock(`duplicate:${id}`, lockToken);
  }
}
