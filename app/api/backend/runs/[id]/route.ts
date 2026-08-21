import { getStore } from "@/lib/store";
import { ownerKey, requireAuth } from "@/lib/security";
import { productionToObservatoryRun } from "@/lib/observability/tracker";
import { sanitizeObject } from "@/lib/observability/sanitize";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const { id } = await ctx.params;
  const prodId = id.startsWith("run_") ? id.replace(/^run_/, "") : id;

  const store = getStore();
  const p = await store.getProduction(prodId);
  if (!p || p.ownerKey !== ownerKey(req)) {
    return Response.json({ error: "Run not found." }, { status: 404 });
  }

  const run = productionToObservatoryRun(p);
  return Response.json(sanitizeObject({ run }));
}
