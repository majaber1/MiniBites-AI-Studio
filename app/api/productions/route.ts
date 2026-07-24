import { getStore } from "@/lib/store";
import { advanceProduction, createProduction } from "@/lib/agents/pipeline";
import { dailyProductionCap, ownerKey, rateLimit, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const productions = await getStore().listProductions(ownerKey(req));
  return Response.json({ productions });
}

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const limited = (await rateLimit(req, "create", 10, 60)) ?? (await dailyProductionCap(req));
  if (limited) return Response.json({ error: limited }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { dish?: string; language?: string } | null;
  const dish = (body?.dish ?? "").replace(/[<>{}[\]\\]/g, "").trim();
  if (!dish || dish.length < 2 || dish.length > 60) {
    return Response.json({ error: "Enter a dish name between 2 and 60 characters." }, { status: 400 });
  }
  const language = body?.language === "ar" ? "ar" : "en";

  let production = createProduction(dish, language, ownerKey(req));
  await getStore().saveProduction(production);
  production = await advanceProduction(production); // runs the planning agents for real
  return Response.json({ production }, { status: 201 });
}
