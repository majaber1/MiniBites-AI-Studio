import { environmentReport } from "@/lib/config";
import { rateLimit, verifyAdminPassword } from "@/lib/security";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = await rateLimit(req, "admin-login", 8, 60);
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || !verifyAdminPassword(body.password)) return Response.json({ error: "Operations password is not correct or not configured." }, { status: 401 });
  const store = getStore();
  const productions = await store.listAllProductions(100);
  const today = new Date().toISOString().slice(0, 10);
  const todayProductions = productions.filter((production) => production.createdAt.startsWith(today));
  const activeStatuses = new Set(["planning", "generating", "assembling"]);
  const failures = productions.filter((production) => production.status === "failed" || production.shots.some((shot) => shot.status === "failed"));
  const knownCosts = todayProductions.map((production) => production.usage.estimatedCostUsd).filter((cost): cost is number => typeof cost === "number");
  return Response.json({
    store: { name: store.name, durable: store.durable },
    environment: environmentReport(),
    metrics: {
      projectsToday: todayProductions.length,
      submittedShotsToday: todayProductions.reduce((sum, production) => sum + production.usage.submittedShots, 0),
      completedShotsToday: todayProductions.reduce((sum, production) => sum + production.usage.completedShots, 0),
      failedShotsToday: todayProductions.reduce((sum, production) => sum + production.usage.failedShots, 0),
      estimatedCostUsd: knownCosts.length === todayProductions.length ? knownCosts.reduce((sum, cost) => sum + cost, 0) : null,
      activeJobs: productions.filter((production) => activeStatuses.has(production.status)).length,
      recentFailures: failures.slice(0, 10).map((production) => ({ id: production.id, dish: production.dish, status: production.status, updatedAt: production.updatedAt, message: production.error ?? production.shots.find((shot) => shot.error)?.error ?? "A generation step failed." })),
    },
  }, { headers: { "cache-control": "no-store" } });
}
