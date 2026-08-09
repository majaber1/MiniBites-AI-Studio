import { getStore } from "@/lib/store";
import { ownerKey, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const lockToken = await store.acquireLock(`approval:${id}`, 20);
  if (!lockToken) return Response.json({ error: "The approval decision is already being updated." }, { status: 409 });
  try {
  const p = await store.getProduction(id);
  if (!p || p.ownerKey !== ownerKey(req)) return Response.json({ error: "Production not found." }, { status: 404 });
  if (p.status !== "awaiting_approval") {
    return Response.json({ error: "Only productions awaiting approval can be approved." }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { action?: "approve" | "request_changes"; note?: string } | null;
  const action = body?.action ?? "approve";
  const note = (body?.note ?? "").replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (note.length > 500) return Response.json({ error: "Approval notes must be 500 characters or less." }, { status: 400 });
  if (action === "request_changes") {
    p.approved = false;
    p.status = "changes_requested";
    p.approvalNote = note || "Changes requested by the creator.";
    p.updatedAt = new Date().toISOString();
    await store.saveProduction(p);
    return Response.json({ production: p });
  }
  if (p.providerIsMock) {
    return Response.json({ error: "Mock productions cannot be approved — there is no real video." }, { status: 400 });
  }
  p.approved = true;
  p.status = "approved";
  p.approvalNote = note || undefined;
  p.approvedAt = new Date().toISOString();
  p.updatedAt = new Date().toISOString();
  await store.saveProduction(p);
  return Response.json({ production: p });
  } finally {
    await store.releaseLock(`approval:${id}`, lockToken);
  }
}
