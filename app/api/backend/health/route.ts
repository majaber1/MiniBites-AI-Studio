import { requireAuth } from "@/lib/security";
import { getProviderHealthMetrics } from "@/lib/observability/health";
import { sanitizeObject } from "@/lib/observability/sanitize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const health = getProviderHealthMetrics();
  return Response.json(sanitizeObject({ providers: health }));
}
