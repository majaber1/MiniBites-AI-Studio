"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import { api, ApiError } from "@/components/api";
import type { IntegrationStatus, Production, StudioProject } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";

interface ProviderOption { id: string; name: string; shortName: string; description: string; configured: boolean; isMock: boolean; isDefault: boolean; statusLabel: string }
interface StatusResponse {
  signedIn: boolean;
  integrations: IntegrationStatus[];
  providers: ProviderOption[];
  environment: { productionReady: boolean; missingRequired: string[] };
}
type ProjectRow = StudioProject & { episodeCount: number };
const WORKFLOW = ["Idea", "Plan", "Generate", "Review", "Assemble", "Approve", "Publish", "Measure"];

export default function DashboardPage() {
  const { locale } = useLocale(); const ar = locale === "ar";
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [productions, setProductions] = useState<Production[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [currentStatus, prod, projs] = await Promise.all([
        api<StatusResponse>("/api/status"),
        api<{ productions: Production[] }>("/api/productions"),
        api<{ projects: ProjectRow[] }>("/api/projects"),
      ]);
      setStatus(currentStatus); setProductions(prod.productions); setProjects(projs.projects); setAuthStatus(null);
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 503)) setAuthStatus(reason.status);
      else setError(reason instanceof Error ? reason.message : "Dashboard data could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const active = useMemo(() => productions.filter((p) => ["planning", "generating", "assembling"].includes(p.status)), [productions]);
  const ready = useMemo(() => productions.filter((p) => ["awaiting_approval", "approved"].includes(p.status)), [productions]);
  const published = useMemo(() => productions.filter((p) => p.publish.some((e) => e.status === "published" || e.status === "processing")).length, [productions]);
  const queuedShots = useMemo(() => productions.reduce((sum, p) => sum + p.shots.filter((s) => ["submitted", "in_queue", "generating"].includes(s.status)).length, 0), [productions]);
  const providers = status?.providers ?? [];
  const connectedPublishers = status?.integrations.filter((i) => ["youtube", "tiktok", "instagram", "x-twitter", "snapchat"].includes(i.key) && i.configured).length ?? 0;

  return <main className="wrap dashboard-page">
    <section className="dashboard-hero">
      <div><div className="eyebrow"><span className="live-dot" /> {ar ? "مركز قيادة المحتوى" : "Content command center"}</div><h1>{ar ? "Kiswani AI Studio،" : "Kiswani AI Studio,"}<br/><span>{ar ? "من الفكرة إلى الجمهور." : "idea to audience."}</span></h1><p>{ar ? "مشاريع مستقلة، محرك إنتاج واحد، نشر متعدد المنصات، وحالة حقيقية بدون أرقام وهمية." : "Independent projects, one production engine, multi-platform publishing and real state without fake analytics."}</p></div>
      <div className="dashboard-actions"><Link className="button" href="/studio">{ar ? "حلقة جديدة" : "New episode"} <span>→</span></Link><Link className="action-link ghost" href="/projects">{ar ? "المشاريع" : "Projects"}</Link></div>
    </section>

    {authStatus !== null ? <AccessGate status={authStatus} onUnlocked={() => void load()} /> : <>
      {error && <p className="warn">{error}</p>}
      <section className="dashboard-metrics" aria-label="Studio overview">
        <article><span>{ar ? "المشاريع" : "Projects"}</span><strong>{loading ? "—" : projects.length}</strong><small>{ar ? "عوالم محتوى مستقلة" : "Independent content worlds"}</small></article>
        <article><span>{ar ? "يعمل الآن" : "Active now"}</span><strong>{loading ? "—" : active.length}</strong><small>{queuedShots} {ar ? "مقطع قيد التنفيذ" : "shots in flight"}</small></article>
        <article><span>{ar ? "ينتظر الاعتماد" : "Needs approval"}</span><strong>{loading ? "—" : ready.length}</strong><small>{ar ? "راجع ثم انشر" : "Review then publish"}</small></article>
        <article><span>{ar ? "تم النشر" : "Published"}</span><strong>{loading ? "—" : published}</strong><small>{connectedPublishers}/5 {ar ? "منصات مربوطة" : "publishers connected"}</small></article>
      </section>

      <section className="dashboard-grid">
        <article className="card dashboard-projects">
          <div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "واصل الإنشاء" : "Continue creating"}</span><h2>{ar ? "آخر الحلقات" : "Recent episodes"}</h2></div><Link className="text-link" href="/library">{ar ? "المكتبة" : "Library"}</Link></div>
          {productions.length === 0 ? <div className="dashboard-empty"><strong>{ar ? "ابدأ أول حلقة." : "Create your first episode."}</strong><p className="dim">MiniBites and Iyal Al Halal are ready as starter projects.</p><Link className="button" href="/studio">{ar ? "ابدأ" : "Start"}</Link></div> : <div className="dashboard-project-list">{productions.slice(0,6).map((p) => <Link href={`/studio?project=${encodeURIComponent(p.projectId ?? "minibites")}`} className="dashboard-project" key={p.id}><span className="project-thumb" aria-hidden>{projects.find((x) => x.id === (p.projectId ?? "minibites"))?.icon ?? "🎬"}</span><span><strong>{p.episodeTitle ?? p.dish}</strong><small>{p.projectName ?? "MiniBites"} · {p.provider} · {new Intl.DateTimeFormat(ar ? "ar-SA" : "en", { dateStyle: "medium" }).format(new Date(p.updatedAt))}</small></span><StatusBadge status={p.status}/><span className="project-arrow">→</span></Link>)}</div>}
        </article>

        <aside className="card readiness-card">
          <div className="readiness-title"><div><span className="eyebrow">{ar ? "المحركات" : "Video engines"}</span><h2>{status?.environment.productionReady ? (ar ? "جاهزية الإنتاج" : "Production ready") : (ar ? "يحتاج انتباه" : "Needs attention")}</h2></div><span className={status?.environment.productionReady ? "readiness-light ready" : "readiness-light"}/></div>
          <div className="readiness-list">{providers.map((p) => <div key={p.id}><span className={p.configured ? "integration-dot connected" : "integration-dot"}/><span><strong>{p.shortName ?? p.name}</strong><small>{p.statusLabel ?? (p.configured ? "READY" : "NOT CONNECTED")}{p.isDefault ? " · default" : ""}</small></span></div>)}</div>
          <Link className="action-link ghost" href="/integrations">{ar ? "إدارة التكاملات" : "Manage integrations"}</Link>
        </aside>
      </section>

      <section className="dashboard-grid" style={{ marginTop: 18 }}>
        <article className="card">
          <div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "المشاريع" : "Projects"}</span><h2>{ar ? "عوالم المحتوى" : "Content worlds"}</h2></div><Link className="text-link" href="/projects">{ar ? "عرض الكل" : "View all"}</Link></div>
          <div className="dashboard-project-list">{projects.slice(0,4).map((p) => <Link key={p.id} href={`/studio?project=${p.id}`} className="dashboard-project"><span className="project-thumb">{p.icon ?? "🎬"}</span><span><strong>{ar ? p.nameAr ?? p.name : p.name}</strong><small>{p.episodeCount} {ar ? "حلقة" : "episodes"} · {p.kind.replaceAll("_"," ")}</small></span><span className="project-arrow">→</span></Link>)}</div>
        </article>
        <article className="card">
          <div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "العمليات الحية" : "Live operations"}</span><h2>{ar ? "ماذا يحدث الآن؟" : "What is happening now?"}</h2></div><Link className="text-link" href="/monitoring">{ar ? "المراقبة" : "Monitoring"}</Link></div>
          {active.length === 0 ? <p className="dim">{ar ? "لا توجد مهام نشطة حاليًا." : "No active production jobs right now."}</p> : active.slice(0,4).map((p) => <div className="ops-failure" key={p.id}><strong>{p.episodeTitle ?? p.dish}</strong><span className="dim">{p.projectName ?? "MiniBites"} · {p.status} · {p.shots.filter((s) => s.status === "completed").length}/{p.shots.length} shots</span></div>)}
        </article>
      </section>

      <section className="card workflow-card" style={{ marginTop: 18 }}><div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "مسار كسواني" : "Kiswani workflow"}</span><h2>{ar ? "من الفكرة إلى التعلم" : "From idea to learning loop"}</h2></div><p className="dim">{ar ? "التوليد المدفوع والنشر ينتظران تأكيدك." : "Paid generation and publishing always wait for your confirmation."}</p></div><ol>{(ar ? ["فكرة","خطة","توليد","مراجعة","تجميع","اعتماد","نشر","قياس"] : WORKFLOW).map((step,index)=><li key={step}><span>{String(index+1).padStart(2,"0")}</span><strong>{step}</strong></li>)}</ol></section>
    </>}
  </main>;
}
