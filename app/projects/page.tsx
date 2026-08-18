"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import { useLocale } from "@/components/LocaleProvider";
import type { ProjectKind, StudioProject } from "@/lib/types";

type ProjectRow = StudioProject & { episodeCount: number };

const kinds: Array<{ id: ProjectKind; en: string; ar: string }> = [
  { id: "character_series", en: "Character series", ar: "سلسلة شخصيات" },
  { id: "mini_food", en: "Mini food", ar: "طبخ مصغّر" },
  { id: "commercial_campaign", en: "Campaign", ar: "حملة تجارية" },
  { id: "general_video", en: "General video", ar: "فيديو عام" },
];

export default function ProjectsPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [kind, setKind] = useState<ProjectKind>("character_series");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await api<{ projects: ProjectRow[] }>("/api/projects");
      setProjects(result.projects);
      setAuthStatus(null);
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 503)) setAuthStatus(reason.status);
      else setError(reason instanceof Error ? reason.message : "Projects could not be loaded.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createProject() {
    setCreating(true);
    setError("");
    try {
      await api("/api/projects", { method: "POST", body: JSON.stringify({ name, nameAr: nameAr || undefined, kind }) });
      setName(""); setNameAr("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Project could not be created.");
    } finally { setCreating(false); }
  }

  return <main className="wrap">
    <section className="dashboard-hero">
      <div>
        <div className="eyebrow"><span className="live-dot" /> {ar ? "عالم المحتوى" : "Content worlds"}</div>
        <h1>{ar ? "مشاريع كسواني" : "Kiswani Projects"}</h1>
        <p>{ar ? "كل فكرة لها شخصياتها، عالمها، حلقاتها وأصولها — بينما محرك الإنتاج والنشر مشترك." : "Each idea keeps its own characters, world, episodes and assets while sharing one production and publishing engine."}</p>
      </div>
      <Link className="button" href="/studio">{ar ? "حلقة جديدة" : "New episode"} <span>→</span></Link>
    </section>

    {authStatus !== null ? <AccessGate status={authStatus} onUnlocked={() => void load()} /> : <>
      {error && <p className="warn">{error}</p>}
      <section className="dashboard-grid" style={{ alignItems: "start" }}>
        <article className="card dashboard-projects">
          <div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "المشاريع" : "Projects"}</span><h2>{ar ? "السلاسل والأفكار" : "Series & ideas"}</h2></div></div>
          <div className="dashboard-project-list">
            {projects.map((project) => <Link key={project.id} href={`/projects/${encodeURIComponent(project.id)}`} className="dashboard-project">
              <span className="project-thumb" aria-hidden>{project.icon ?? project.name.slice(0, 1).toUpperCase()}</span>
              <span><strong>{ar ? project.nameAr ?? project.name : project.name}</strong><small>{ar ? project.descriptionAr ?? project.description : project.description} · {project.episodeCount} {ar ? "حلقة" : "episodes"}</small></span>
              <span className="badge ready">{kinds.find((item) => item.id === project.kind)?.[ar ? "ar" : "en"]}</span>
              <span className="project-arrow" aria-hidden>→</span>
            </Link>)}
          </div>
        </article>

        <aside className="card readiness-card">
          <div className="readiness-title"><div><span className="eyebrow">{ar ? "مشروع جديد" : "New project"}</span><h2>{ar ? "أضف فكرة جديدة" : "Add another world"}</h2></div></div>
          <label>{ar ? "الاسم الإنجليزي" : "Project name"}<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bedouin Stories" /></label>
          <label>{ar ? "الاسم العربي" : "Arabic name"}<input value={nameAr} maxLength={80} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: علوم البدو" /></label>
          <label>{ar ? "النوع" : "Type"}<select value={kind} onChange={(e) => setKind(e.target.value as ProjectKind)}>{kinds.map((item) => <option value={item.id} key={item.id}>{ar ? item.ar : item.en}</option>)}</select></label>
          <button className="button" onClick={createProject} disabled={creating || name.trim().length < 2}>{creating ? (ar ? "جارٍ الإنشاء…" : "Creating…") : (ar ? "إنشاء المشروع" : "Create project")}</button>
        </aside>
      </section>
    </>}
  </main>;
}
