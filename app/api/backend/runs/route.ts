import { getStore } from "@/lib/store";
import { isAuthed, ownerKey, requireAuth } from "@/lib/security";
import { productionToObservatoryRun } from "@/lib/observability/tracker";
import { sanitizeObject } from "@/lib/observability/sanitize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const store = getStore();
  const productions = await store.listProductions(ownerKey(req));
  const runs = productions.map(productionToObservatoryRun);

  return Response.json(sanitizeObject({ runs }));
}
