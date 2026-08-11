"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import { api, ApiError } from "@/components/api";
import type { IntegrationStatus, Production } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";

interface StatusResponse {
  signedIn: boolean;
  integrations: IntegrationStatus[];
  environment: { productionReady: boolean; missingRequired: string[] };
}

const WORKFLOW = ["Idea", "Plan", "Generate", "Review", "Assemble", "Approve", "Share"];

export default function DashboardPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [productions, setProductions] = useState<Production[]>([]);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const currentStatus = await api<StatusResponse>("/api/status");
      setStatus(currentStatus);
      const result = await api<{ productions: Production[] }>("/api/productions");
      setProductions(result.productions);
      setAuthStatus(null);
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 503)) setAuthStatus(reason.status);
      else setError(reason instanceof Error ? reason.message : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const active = useMemo(() => productions.filter((item) => ["planning", "generating", "assembling"].includes(item.status)).length, [productions]);
  const ready = useMemo(() => productions.filter((item) => ["awaiting_approval", "approved", "completed"].includes(item.status)).length, [productions]);
  const completedShots = useMemo(() => productions.reduce((sum, item) => sum + item.usage.completedShots, 0), [productions]);
  const missing = status?.integrations.filter((item) => !item.configured) ?? [];
  const configuredCount = status?.integrations.filter((item) => item.configured).length ?? 0;

  return <main className="wrap dashboard-page">
    <section className="dashboard-hero">
      <div>
        <div className="eyebrow"><span className="live-dot" /> {ar ? "مركز تحكم المنشئ" : "Creator command center"}</div>
        <h1>{ar ? "استوديو الطعام المصغّر،" : "Your tiny-food studio,"}<br /><span>{ar ? "كله في مكان واحد." : "all in one place."}</span></h1>
        <p>{ar ? "ابدأ إنتاجًا، وواصل العمل الحقيقي، واعرف ما هو متصل بدقة—دون تحليلات وهمية." : "Start a production, continue real work, and see exactly what is connected—without fake analytics."}</p>
      </div>
      <div className="dashboard-actions">
        <Link className="button" href="/studio">{ar ? "إنشاء فيديو جديد" : "Create new video"} <span>→</span></Link>
        <Link className="action-link ghost" href="/templates">{ar ? "تصفح القوالب" : "Browse templates"}</Link>
      </div>
    </section>

    {authStatus !== null ? <AccessGate status={authStatus} onUnlocked={() => void load()} /> : <>
      {error && <p className="warn">{error}</p>}
      <section className="dashboard-metrics" aria-label="Production overview">
        <article><span>{ar ? "المشاريع" : "Projects"}</span><strong>{loading ? "—" : productions.length}</strong><small>{ar ? "محفوظة في مكتبتك" : "Saved in your library"}</small></article>
        <article><span>{ar ? "نشط الآن" : "Active now"}</span><strong>{loading ? "—" : active}</strong><small>{ar ? "تخطيط أو توليد" : "Planning or generating"}</small></article>
        <article><span>{ar ? "جاهز" : "Ready"}</span><strong>{loading ? "—" : ready}</strong><small>{ar ? "راجع أو اعتمد أو شارك" : "Review, approve or share"}</small></article>
        <article><span>{ar ? "المقاطع المنشأة" : "Clips made"}</span><strong>{loading ? "—" : completedShots}</strong><small>{ar ? "مهام مزود مكتملة" : "Completed provider jobs"}</small></article>
      </section>

      <section className="dashboard-grid">
        <article className="card dashboard-projects">
          <div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "واصل الإنشاء" : "Continue creating"}</span><h2>{ar ? "المشاريع الأخيرة" : "Recent projects"}</h2></div><Link className="text-link" href="/library">{ar ? "عرض المكتبة" : "View library"}</Link></div>
          {loading ? <p className="dim">Loading your projects…</p> : productions.length === 0 ? <div className="dashboard-empty"><strong>No projects yet.</strong><p className="dim">Start with a dish or a ready-made creative template.</p><Link className="button" href="/studio">Create your first video</Link></div> : <div className="dashboard-project-list">
            {productions.slice(0, 5).map((project) => <Link href="/library" className="dashboard-project" key={project.id}>
              <span className="project-thumb" aria-hidden>{project.dish.slice(0, 1).toUpperCase()}</span>
              <span><strong>{project.dish}</strong><small>{project.style} · {project.durationPreset} · {new Intl.DateTimeFormat(ar ? "ar-SA" : "en", { dateStyle: "medium" }).format(new Date(project.updatedAt))}</small></span>
              <StatusBadge status={project.status} />
              <span className="project-arrow" aria-hidden>→</span>
            </Link>)}
          </div>}
        </article>

        <aside className="card readiness-card">
          <div className="readiness-title"><div><span className="eyebrow">{ar ? "جاهزية الإنتاج" : "Production readiness"}</span><h2>{status?.environment.productionReady ? (ar ? "الأساس جاهز" : "Core ready") : (ar ? "يحتاج اهتمامًا" : "Needs attention")}</h2></div><span className={status?.environment.productionReady ? "readiness-light ready" : "readiness-light"} /></div>
          <p className="dim">{configuredCount} of {status?.integrations.length ?? 0} integrations connected. Optional publishing tools can be added later.</p>
          <div className="readiness-list">{status?.integrations.map((item) => <div key={item.key}><span className={item.configured ? "integration-dot connected" : "integration-dot"} /><span><strong>{item.label}</strong><small>{item.configured ? "Connected" : "Not connected"}</small></span></div>)}</div>
          <Link className="action-link ghost" href="/integrations">{ar ? "إدارة التكاملات" : "Manage integrations"}</Link>
        </aside>
      </section>

      <section className="card workflow-card">
        <div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "مسار واحد واضح" : "One clear workflow"}</span><h2>{ar ? "من الفكرة إلى منشور اجتماعي" : "From idea to social post"}</h2></div><p className="dim">{ar ? "التوليد المدفوع والنشر ينتظران تأكيدك دائمًا." : "Paid generation and publishing always wait for your confirmation."}</p></div>
        <ol>{(ar ? ["فكرة","خطة","توليد","مراجعة","تجميع","اعتماد","مشاركة"] : WORKFLOW).map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></li>)}</ol>
      </section>

      {missing.length > 0 && <section className="missing-panel"><div><span className="eyebrow">Still optional</span><h2>What remains to complete every integration</h2><p>MiniBites can already create and prepare social-ready MP4 files. These external connections expand storage or direct publishing.</p></div><div>{missing.map((item) => <article key={item.key}><span className="integration-dot" /><div><strong>{item.label}</strong><p>{item.detail}</p></div></article>)}</div></section>}
    </>}
  </main>;
}
