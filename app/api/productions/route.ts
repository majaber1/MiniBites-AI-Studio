import { getStore } from "@/lib/store";
import { advanceProduction, createProduction } from "@/lib/agents/pipeline";
import { getVideoProvider } from "@/lib/providers";
import { builtinProjects } from "@/lib/projects";
import type { CreativeStyle, DurationPreset, ProviderChoice, StoryMode, StudioProject } from "@/lib/types";
import { dailyProductionCap, ownerKey, rateLimit, requireAuth } from "@/lib/security";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const productions = await getStore().listProductions(ownerKey(req));
  // Old MiniBites records are normalized at read time without rewriting them.
  return Response.json({ productions: productions.map((p) => ({
    ...p,
    projectId: p.projectId ?? "minibites",
    projectName: p.projectName ?? "MiniBites",
    projectKind: p.projectKind ?? "mini_food",
    episodeTitle: p.episodeTitle ?? p.dish,
  })) });
}

async function resolveProject(owner: string, requested?: string): Promise<StudioProject> {
  const store = getStore();
  const id = requested?.trim() || "minibites";
  const stored = await store.getProject(id);
  if (stored?.ownerKey === owner) return stored;
  const preset = builtinProjects(owner).find((p) => p.id === id) ?? builtinProjects(owner)[0];
  await store.saveProject(preset);
  return preset;
}

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "create", 10, 60);
  if (limited) return Response.json({ error: limited }, { status: 429 });

  const body = (await req.json().catch(() => null)) as {
    dish?: string; title?: string; projectId?: string; description?: string; language?: string; provider?: string; clientRequestId?: string;
    style?: string; storyMode?: string; durationPreset?: string;
  } | null;
  const subject = (body?.title ?? body?.dish ?? "").replace(/[<>{}[\]\\]/g, "").trim();
  if (!subject || subject.length < 2 || subject.length > 100) return Response.json({ error: "Enter an episode/video idea between 2 and 100 characters." }, { status: 400 });
  const language = body?.language === "ar" ? "ar" : "en";
  const description = (body?.description ?? "").replace(/[<>{}[\]\\]/g, "").trim();
  if (description.length > 400) return Response.json({ error: "Creative direction must be 400 characters or less." }, { status: 400 });
  const styles = ["realistic", "cinematic", "cozy", "luxury", "street", "traditional", "playful", "macro", "workshop", "asmr"] as const;
  const storyModes = ["satisfying", "educational", "funny", "cinematic", "asmr", "luxury", "viral_hook"] as const;
  const durations = ["quick", "standard", "extended"] as const;
  if (body?.style && !styles.includes(body.style as CreativeStyle)) return Response.json({ error: "Choose a valid creative style." }, { status: 400 });
  if (body?.storyMode && !storyModes.includes(body.storyMode as StoryMode)) return Response.json({ error: "Choose a valid story type." }, { status: 400 });
  if (body?.durationPreset && !durations.includes(body.durationPreset as DurationPreset)) return Response.json({ error: "Choose a valid video length." }, { status: 400 });
  const clientRequestId = body?.clientRequestId?.trim() ?? "";
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(clientRequestId)) return Response.json({ error: "This creation request is missing a valid request ID. Refresh the studio and try again." }, { status: 400 });

  const store = getStore();
  if (process.env.NODE_ENV === "production" && !store.durable) return Response.json({ error: "Production storage is not ready. Configure Upstash Redis, then redeploy." }, { status: 503 });
  const owner = ownerKey(req);
  const project = await resolveProject(owner, body?.projectId);

  let providerChoice: ProviderChoice | undefined;
  if (body?.provider !== undefined && body.provider !== "" && body.provider !== "auto") {
    if (!["fal", "wan", "mock", "google"].includes(body.provider)) return Response.json({ error: "Invalid provider. Use fal, google, wan, mock, or auto." }, { status: 400 });
    providerChoice = body.provider as ProviderChoice;
  }
  if (!providerChoice && project.defaultProvider) {
    const projectDefault = getVideoProvider(project.defaultProvider);
    if (projectDefault.configured) providerChoice = project.defaultProvider;
  }
  const chosen = getVideoProvider(providerChoice);
  if (!chosen.configured) return Response.json({ error: `${chosen.name} is not configured. ${chosen.configurationHint}` }, { status: 400 });
  if (process.env.NODE_ENV === "production" && chosen.isMock) return Response.json({ error: "The test video engine is disabled in production." }, { status: 400 });
  const productionId = `mb_${createHash("sha256").update(`${owner}:${clientRequestId}`).digest("hex").slice(0, 20)}`;
  const existing = await store.getProduction(productionId);
  if (existing?.ownerKey === owner) return Response.json({ production: existing, duplicatePrevented: true });

  const lockToken = await store.acquireLock(`create:${productionId}`, 120);
  if (!lockToken) {
    const concurrent = await store.getProduction(productionId);
    if (concurrent?.ownerKey === owner) return Response.json({ production: concurrent, duplicatePrevented: true });
    return Response.json({ error: "This video is already being created. Please wait a moment." }, { status: 409 });
  }
  try {
    const afterLock = await store.getProduction(productionId);
    if (afterLock?.ownerKey === owner) return Response.json({ production: afterLock, duplicatePrevented: true });
    const capped = await dailyProductionCap(req);
    if (capped) return Response.json({ error: capped }, { status: 429 });
    let production = createProduction(subject, language, owner, providerChoice, productionId, {
      description: description || undefined,
      style: (body?.style as CreativeStyle | undefined) ?? "cinematic",
      storyMode: (body?.storyMode as StoryMode | undefined) ?? (project.kind === "character_series" ? "funny" : "satisfying"),
      durationPreset: (body?.durationPreset as DurationPreset | undefined) ?? "standard",
      projectId: project.id,
      projectName: project.name,
      projectKind: project.kind,
      projectBible: structuredClone(project.bible),
    });
    await store.saveProduction(production);
    production = await advanceProduction(production);
    return Response.json({ production }, { status: 201 });
  } finally {
    await store.releaseLock(`create:${productionId}`, lockToken);
  }
}
