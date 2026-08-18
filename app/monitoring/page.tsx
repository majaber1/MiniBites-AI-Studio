"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import { useLocale } from "@/components/LocaleProvider";
import type { Production } from "@/lib/types";

interface ProviderOption {
  id: "fal" | "google" | "wan" | "mock";
  name: string;
  configured: boolean;
  isMock: boolean;
  isDefault: boolean;
  capabilities?: { nativeAudio?: boolean; imageReference?: boolean; minSeconds?: number; maxSeconds?: number };
}
interface StatusResponse { providers: ProviderOption[]; environment: { productionReady: boolean; missingRequired: string[] } }

const pipeline = ["Plan", "Generate", "Review", "Assemble", "Approve", "Publish", "Measure"] as const;

function stageIndex(status: Production["status"]) {
  if (status === "planning" || status === "planned") return 0;
  if (status === "generating") return 1;
  if (status === "review" || status === "changes_requested") return 2;
  if (status === "assembling") return 3;
  if (status === "awaiting_approval") return 4;
  if (status === "approved") return 5;
  if (status === "completed") return 6;
  return -1;
}

export default function MonitoringPage() {
  const { locale } = useLocale(); const ar = locale === "ar";
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [productions, setProductions] = useState<Production[]>([]);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [providerId, setProviderId] = useState("auto");
  const [shotCount, setShotCount] = useState(8);

  const load = useCallback(async () => {
    try {
      const s = await api<StatusResponse>("/api/status");
      const p = await api<{ productions: Production[] }>("/api/productions");
      setStatus(s); setProductions(p.productions); setAuthStatus(null); setError("");
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 503)) setAuthStatus(reason.status);
      else setError(reason instanceof Error ? reason.message : "Monitoring data could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const active = productions.filter((p) => ["planning", "generating", "assembling"].includes(p.status));
  const queuedShots = productions.reduce((sum, p) => sum + p.shots.filter((s) => ["submitted", "in_queue", "generating"].includes(s.status)).length, 0);
  const failedShots = productions.reduce((sum, p) => sum + p.shots.filter((s) => s.status === "failed").length, 0);
  const completeShots = productions.reduce((sum, p) => sum + p.shots.filter((s) => s.status === "completed").length, 0);
  const selectedProvider = useMemo(() => {
    if (!status?.providers.length) return null;
    if (providerId === "auto") return status.providers.find((p) => p.isDefault) ?? status.providers[0];
    return status.providers.find((p) => p.id === providerId) ?? null;
  }, [providerId, status]);

  return <main className="wrap">
    <section className="dashboard-hero"><div><div className="eyebrow"><span className="live-dot" /> {ar ? "حالة حقيقية" : "Live production state"}</div><h1>{ar ? "المراقبة والمحاكاة" : "Monitoring & simulation"}</h1><p>{ar ? "راقب المهام الحقيقية، وافهم مكان كل حلقة، وحاكي المسار المتوقع قبل صرف رصيد التوليد." : "Watch real jobs, see exactly where every episode is, and simulate the expected path before spending generation credit."}</p></div><button className="action-link ghost" onClick={() => void load()}>{ar ? "تحديث" : "Refresh"}</button></section>

    {authStatus !== null ? <AccessGate status={authStatus} onUnlocked={() => void load()} /> : <>
      {error && <p className="warn">{error}</p>}
      <section className="dashboard-metrics">
        <article><span>{ar ? "يعمل الآن" : "Active now"}</span><strong>{active.length}</strong><small>{ar ? "تخطيط / توليد / تجميع" : "Planning / generating / assembling"}</small></article>
        <article><span>{ar ? "مقاطع في الطابور" : "Shots in flight"}</span><strong>{queuedShots}</strong><small>{ar ? "مرسلة أو قيد التوليد" : "Queued or generating"}</small></article>
        <article><span>{ar ? "مقاطع مكتملة" : "Completed shots"}</span><strong>{completeShots}</strong><small>{ar ? "نتائج مزود حقيقية" : "Real provider results"}</small></article>
        <article><span>{ar ? "فشل" : "Failures"}</span><strong>{failedShots}</strong><small>{ar ? "يحتاج إعادة محاولة أو تعديل" : "Needs retry or prompt change"}</small></article>
      </section>

      <section className="dashboard-grid" style={{ alignItems: "start" }}>
        <article className="card dashboard-projects">
          <div className="dashboard-section-head"><div><span className="eyebrow">{ar ? "خط الإنتاج" : "Production pipeline"}</span><h2>{ar ? "الحلقات النشطة" : "Active episodes"}</h2></div></div>
          {active.length === 0 ? <p className="dim">{ar ? "لا توجد مهام نشطة الآن." : "No active jobs right now."}</p> : active.map((p) => {
            const current = stageIndex(p.status);
            return <div key={p.id} className="card" style={{ marginTop: 12 }}>
              <div className="dashboard-section-head"><div><strong>{p.episodeTitle ?? p.dish}</strong><p className="dim">{p.projectName ?? "MiniBites"} · {p.provider}</p></div><StatusBadge status={p.status} /></div>
              <ol style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6, padding: 0, listStyle: "none" }}>{pipeline.map((step, index) => <li key={step} className={index < current ? "note" : index === current ? "warn" : "dim"} style={{ padding: 8, textAlign: "center", borderRadius: 10 }}><small>{index < current ? "✓" : index === current ? "●" : "○"} {step}</small></li>)}</ol>
              <div className="readiness-list">{p.shots.map((shot) => <div key={shot.id}><span className={`integration-dot ${shot.status === "completed" ? "connected" : ""}`} /><span><strong>Shot {String(shot.index).padStart(2, "0")}</strong><small>{shot.status}{shot.queuePosition ? ` · queue #${shot.queuePosition}` : ""}{shot.error ? ` · ${shot.error}` : ""}</small></span></div>)}</div>
            </div>;
          })}
        </article>

        <aside className="card readiness-card">
          <div className="readiness-title"><div><span className="eyebrow">{ar ? "محاكاة — لا تنفذ شيئًا" : "Simulation — no work is submitted"}</span><h2>{ar ? "لو بدأنا الآن" : "If we start now"}</h2></div></div>
          <label>{ar ? "محرك الفيديو" : "Video engine"}<select value={providerId} onChange={(e) => setProviderId(e.target.value)}><option value="auto">Auto — recommended</option>{status?.providers.filter((p) => !p.isMock).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>{ar ? "عدد المشاهد" : "Shots"}<input type="number" min={3} max={12} value={shotCount} onChange={(e) => setShotCount(Math.min(12, Math.max(3, Number(e.target.value) || 8)))} /></label>
          <div className={selectedProvider?.configured ? "note" : "warn"}>
            <strong>{selectedProvider?.configured ? (ar ? "المحرك جاهز" : "Provider ready") : (ar ? "المحرك غير مربوط" : "Provider not configured")}</strong>
            <p>{selectedProvider?.name ?? "—"}</p>
          </div>
          <ol style={{ paddingInlineStart: 20 }}>
            <li>{ar ? `تخطيط ${shotCount} مشاهد` : `Plan ${shotCount} shots`}</li>
            <li>{ar ? "توليد كل مشهد ومراقبة حالته" : "Generate and poll each shot"}</li>
            <li>{ar ? "مراجعة / إعادة توليد عند الحاجة" : "Review / regenerate when needed"}</li>
            <li>{ar ? "تجميع MP4 واحد" : "Assemble one MP4"}</li>
            <li>{ar ? "اعتماد يدوي" : "Manual approval"}</li>
            <li>{ar ? "نشر على المنصات المختارة" : "Publish to selected platforms"}</li>
          </ol>
          <p className="dim">{ar ? "هذه المحاكاة تعرض المسار المتوقع فقط. لا تعتبر أي خطوة ناجحة حتى تؤكدها حالة المزود/API الحقيقية." : "Simulation shows the expected path only. Nothing is marked successful until the real provider/API confirms it."}</p>
        </aside>
      </section>
    </>}
  </main>;
}
