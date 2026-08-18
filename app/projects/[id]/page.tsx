"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import { useLocale } from "@/components/LocaleProvider";
import type { Production, StudioProject } from "@/lib/types";

type Tab = "overview" | "episodes" | "characters" | "bible";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const { locale } = useLocale(); const ar = locale === "ar";
  const [project, setProject] = useState<StudioProject | null>(null);
  const [productions, setProductions] = useState<Production[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [concept, setConcept] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [tone, setTone] = useState("");
  const [locations, setLocations] = useState("");
  const [continuity, setContinuity] = useState("");
  const [negative, setNegative] = useState("");

  const hydrate = (p: StudioProject) => {
    setProject(p); setConcept(p.bible.concept); setVisualStyle(p.bible.visualStyle); setTone(p.bible.tone ?? "");
    setLocations((p.bible.locations ?? []).join("\n")); setContinuity((p.bible.continuityRules ?? []).join("\n")); setNegative((p.bible.negativeRules ?? []).join("\n"));
  };
  const load = useCallback(async () => {
    try {
      const result = await api<{ project: StudioProject; productions: Production[] }>(`/api/projects/${encodeURIComponent(id)}`);
      hydrate(result.project); setProductions(result.productions); setAuthStatus(null); setError("");
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 503)) setAuthStatus(reason.status);
      else setError(reason instanceof Error ? reason.message : "Project could not be loaded.");
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function saveBible() {
    if (!project) return; setSaving(true); setError("");
    try {
      const { project: updated } = await api<{ project: StudioProject }>(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ bible: { concept, visualStyle, tone, locations: locations.split("\n").map((v) => v.trim()).filter(Boolean), continuityRules: continuity.split("\n").map((v) => v.trim()).filter(Boolean), negativeRules: negative.split("\n").map((v) => v.trim()).filter(Boolean) } }),
      });
      hydrate(updated);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Project Bible could not be saved."); }
    finally { setSaving(false); }
  }

  if (authStatus !== null) return <main className="wrap"><AccessGate status={authStatus} onUnlocked={() => void load()} /></main>;
  if (!project) return <main className="wrap"><section className="hero"><h1>{ar ? "جارٍ تحميل المشروع…" : "Loading project…"}</h1>{error && <p className="warn">{error}</p>}</section></main>;
  const tabs: Array<{ id: Tab; en: string; ar: string }> = [
    { id: "overview", en: "Overview", ar: "نظرة عامة" }, { id: "episodes", en: "Episodes", ar: "الحلقات" },
    { id: "characters", en: "Characters", ar: "الشخصيات" }, { id: "bible", en: "Project Bible", ar: "دليل المشروع" },
  ];

  return <main className="wrap">
    <section className="dashboard-hero"><div><div className="eyebrow">{project.kind.replaceAll("_", " ")}</div><h1>{project.icon} {ar ? project.nameAr ?? project.name : project.name}</h1><p>{ar ? project.descriptionAr ?? project.description : project.description}</p></div><Link className="button" href={`/studio?project=${encodeURIComponent(project.id)}`}>{ar ? "حلقة جديدة" : "New episode"} →</Link></section>
    {error && <p className="warn">{error}</p>}
    <div className="chips" style={{ marginBottom: 20 }}>{tabs.map((item) => <button key={item.id} className={tab === item.id ? "" : "ghost"} onClick={() => setTab(item.id)}>{ar ? item.ar : item.en}</button>)}</div>

    {tab === "overview" && <section className="dashboard-grid">
      <article className="card"><span className="eyebrow">{ar ? "الفكرة" : "Concept"}</span><h2>{project.bible.concept}</h2><p className="dim">{project.bible.visualStyle}</p></article>
      <article className="card"><span className="eyebrow">{ar ? "إعدادات افتراضية" : "Defaults"}</span><div className="readiness-list"><div><span className="integration-dot connected"/><span><strong>{project.bible.aspectRatio}</strong><small>{ar ? "نسبة الفيديو" : "Aspect ratio"}</small></span></div><div><span className="integration-dot connected"/><span><strong>{project.bible.defaultDurationSeconds}s</strong><small>{ar ? "المدة" : "Default duration"}</small></span></div><div><span className="integration-dot connected"/><span><strong>{project.bible.language}</strong><small>{ar ? "اللغة" : "Language"}</small></span></div></div></article>
      <article className="card"><span className="eyebrow">{ar ? "النشاط" : "Activity"}</span><h2>{productions.length}</h2><p className="dim">{ar ? "إجمالي الحلقات / الفيديوهات" : "episodes / videos"}</p></article>
      <article className="card"><span className="eyebrow">{ar ? "آخر تحديث" : "Updated"}</span><h2>{new Intl.DateTimeFormat(ar ? "ar-SA" : "en", { dateStyle: "medium" }).format(new Date(project.updatedAt))}</h2><p className="dim">{project.status}</p></article>
    </section>}

    {tab === "episodes" && <section className="card"><div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "الحلقات" : "Episodes"}</span><h2>{ar ? "مكتبة المشروع" : "Project episodes"}</h2></div></div>{productions.length === 0 ? <p className="dim">{ar ? "لا توجد حلقات بعد." : "No episodes yet."}</p> : <div className="dashboard-project-list">{productions.map((p) => <Link key={p.id} href={`/studio?project=${project.id}`} className="dashboard-project"><span className="project-thumb">{project.icon ?? "🎬"}</span><span><strong>{p.episodeTitle ?? p.dish}</strong><small>{p.provider} · {new Date(p.updatedAt).toLocaleString()}</small></span><StatusBadge status={p.status}/><span className="project-arrow">→</span></Link>)}</div>}</section>}

    {tab === "characters" && <section><div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "استمرارية الهوية" : "Identity continuity"}</span><h2>{ar ? "الشخصيات" : "Characters"}</h2></div></div><div className="steps-grid">{(project.bible.characters ?? []).map((c) => <article className="card" key={c.id}><span style={{ fontSize: "2rem" }}>🐑</span><h3>{ar ? c.displayNameAr ?? c.name : c.name}</h3><p className="dim">{c.role}</p><p><strong>{ar ? "اللهجة: " : "Dialect: "}</strong>{c.dialect ?? "—"}</p><p><strong>{ar ? "الصوت: " : "Voice: "}</strong>{c.voiceStyle ?? "—"}</p><p>{c.personality}</p><details><summary>{ar ? "تفاصيل الشكل" : "Visual identity"}</summary><p className="dim">{c.visualNotes}</p></details></article>)}</div>{(project.bible.characters ?? []).length === 0 && <div className="note">{ar ? "هذا المشروع لا يحتوي شخصيات ثابتة بعد." : "This project has no recurring characters yet."}</div>}</section>}

    {tab === "bible" && <section className="card creator-form"><div><span className="eyebrow">Project Bible</span><h2>{ar ? "القواعد التي ترثها كل حلقة" : "Rules inherited by every new episode"}</h2><p className="dim">{ar ? "الحلقات القديمة تحتفظ بنسختها الخاصة؛ التعديل هنا يؤثر على الحلقات الجديدة فقط." : "Existing episodes keep their snapshot; edits here affect new episodes only."}</p></div><label>{ar ? "الفكرة" : "Concept"}<textarea value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={1200}/></label><label>{ar ? "الأسلوب البصري" : "Visual style"}<textarea value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} maxLength={800}/></label><label>{ar ? "النبرة" : "Tone"}<textarea value={tone} onChange={(e) => setTone(e.target.value)} maxLength={500}/></label><label>{ar ? "المواقع — سطر لكل موقع" : "Locations — one per line"}<textarea value={locations} onChange={(e) => setLocations(e.target.value)}/></label><label>{ar ? "قواعد الاستمرارية — سطر لكل قاعدة" : "Continuity rules — one per line"}<textarea value={continuity} onChange={(e) => setContinuity(e.target.value)}/></label><label>{ar ? "الممنوعات — سطر لكل قاعدة" : "Negative rules — one per line"}<textarea value={negative} onChange={(e) => setNegative(e.target.value)}/></label><button className="button" onClick={() => void saveBible()} disabled={saving}>{saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ دليل المشروع" : "Save Project Bible")}</button></section>}
  </main>;
}
