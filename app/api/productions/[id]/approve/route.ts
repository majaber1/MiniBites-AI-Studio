import { getStore } from "@/lib/store";
import { ownerKey, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const p = await getStore().getProduction(id);
  if (!p || p.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
  if (p.status !== "awaiting_approval") {
    return Response.json({ error: "Only productions awaiting approval can be approved." }, { status: 400 });
  }
  if (p.providerIsMock) {
    return Response.json({ error: "Mock productions cannot be approved — there is no real video." }, { status: 400 });
  }
  p.approved = true;
  p.status = "approved";
  p.updatedAt = new Date().toISOString();
  await getStore().saveProduction(p);
  return Response.json({ production: p });
}
