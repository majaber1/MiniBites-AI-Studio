import { getStore } from "@/lib/store";
import { ownerKey, requireAuth } from "@/lib/security";
import { aggregateBenchmarks } from "@/lib/observability/benchmark";
import { sanitizeObject } from "@/lib/observability/sanitize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const store = getStore();
  const productions = await store.listProductions(ownerKey(req));
  const benchmarks = aggregateBenchmarks(productions);

  return Response.json(sanitizeObject({ benchmarks }));
}
