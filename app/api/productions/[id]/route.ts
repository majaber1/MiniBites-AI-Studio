import { getStore } from "@/lib/store";
import { advanceProduction, cancelProduction } from "@/lib/agents/pipeline";
import { ownerKey, rateLimit, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function load(req: Request, id: string) {
  const p = await getStore().getProduction(id);
  if (!p || p.ownerKey !== ownerKey(req)) return null;
  return p;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "poll", 60, 60);
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const { id } = await ctx.params;
  let p = await load(req, id);
  if (!p) return Response.json({ error: "Production not found." }, { status: 404 });
  const advance = new URL(req.url).searchParams.get("advance") === "1";
  const active = ["planning", "generating", "review", "assembling"].includes(p.status);
  if (advance && active) p = await advanceProduction(p);
  return Response.json({ production: p });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const p = await load(req, id);
  if (!p) return Response.json({ error: "Production not found." }, { status: 404 });
  const cancelled = await cancelProduction(p);
  return Response.json({ production: cancelled });
}
