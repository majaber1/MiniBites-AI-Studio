import { getStore } from "@/lib/store";
import { advanceProduction, cancelProduction, reviseShotPlan, type ShotPlanEdit } from "@/lib/agents/pipeline";
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
  const active = ["planning", "generating", "assembling"].includes(p.status);
  if (advance && active) {
    const store = getStore();
    const lockKey = `advance:${id}`;
    const lockToken = await store.acquireLock(lockKey, 55);
    if (lockToken) {
      try {
        // Reload after acquiring the lock so concurrent polls cannot submit the
        // same paid provider job twice.
        const latest = await load(req, id);
        if (latest && ["planning", "generating", "assembling"].includes(latest.status)) {
          p = await advanceProduction(latest);
        }
      } finally {
        await store.releaseLock(lockKey, lockToken);
      }
    }
  }
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const lockToken = await store.acquireLock(`plan:${id}`, 20);
  if (!lockToken) return Response.json({ error: "The shot plan is already being updated." }, { status: 409 });
  try {
    const production = await load(req, id);
    if (!production) return Response.json({ error: "Production not found." }, { status: 404 });
    const body = (await req.json().catch(() => null)) as { shots?: unknown[] } | null;
    if (!body?.shots) return Response.json({ error: "A shot list is required." }, { status: 400 });
    return Response.json({ production: await reviseShotPlan(production, body.shots as ShotPlanEdit[]) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The shot plan could not be saved." }, { status: 400 });
  } finally {
    await store.releaseLock(`plan:${id}`, lockToken);
  }
}
