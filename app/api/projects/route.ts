import { getStore } from "@/lib/store";
import { builtinProjects, makeProject } from "@/lib/projects";
import type { ProjectKind } from "@/lib/types";
import { ownerKey, rateLimit, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

async function ensureBuiltinProjects(owner: string) {
  const store = getStore();
  const existing = await store.listProjects(owner);
  const ids = new Set(existing.map((project) => project.id));
  for (const preset of builtinProjects(owner)) {
    if (!ids.has(preset.id)) await store.saveProject(preset);
  }
  return store.listProjects(owner);
}

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const owner = ownerKey(req);
  const projects = await ensureBuiltinProjects(owner);
  const productions = await getStore().listProductions(owner);
  const counts = productions.reduce<Record<string, number>>((acc, production) => {
    const projectId = production.projectId ?? "minibites";
    acc[projectId] = (acc[projectId] ?? 0) + 1;
    return acc;
  }, {});
  return Response.json({ projects: projects.map((project) => ({ ...project, episodeCount: counts[project.id] ?? 0 })) });
}

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "project-create", 10, 60);
  if (limited) return Response.json({ error: limited }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { name?: string; nameAr?: string; kind?: string; description?: string } | null;
  const name = body?.name?.replace(/[<>{}[\]\\]/g, "").trim() ?? "";
  const nameAr = body?.nameAr?.replace(/[<>{}[\]\\]/g, "").trim();
  const description = body?.description?.replace(/[<>{}[\]\\]/g, "").trim();
  const kinds: ProjectKind[] = ["mini_food", "character_series", "commercial_campaign", "general_video"];
  if (name.length < 2 || name.length > 80) return Response.json({ error: "Project name must be 2–80 characters." }, { status: 400 });
  if (!body?.kind || !kinds.includes(body.kind as ProjectKind)) return Response.json({ error: "Choose a valid project type." }, { status: 400 });
  if (nameAr && nameAr.length > 80) return Response.json({ error: "Arabic project name must be 80 characters or less." }, { status: 400 });
  if (description && description.length > 400) return Response.json({ error: "Project description must be 400 characters or less." }, { status: 400 });

  const project = makeProject({ name, nameAr, kind: body.kind as ProjectKind, description, ownerKey: ownerKey(req) });
  await getStore().saveProject(project);
  return Response.json({ project }, { status: 201 });
}
