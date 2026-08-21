"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import { useLocale } from "@/components/LocaleProvider";
import type {
  BenchmarkEntry,
  ObservatoryRun,
  ProviderHealthMetrics,
  StageGraphNode,
} from "@/lib/observability/types";

type TabId =
  | "overview"
  | "graph"
  | "routing"
  | "constraints"
  | "fallbacks"
  | "attempts"
  | "events"
  | "health"
  | "cost"
  | "quality"
  | "benchmark";

export default function BackendObservatoryPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";

  const [runs, setRuns] = useState<ObservatoryRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthMetrics[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const runsData = await api<{ runs: ObservatoryRun[] }>("/api/backend/runs");
      const healthData = await api<{ providers: ProviderHealthMetrics[] }>("/api/backend/health");
      const benchData = await api<{ benchmarks: BenchmarkEntry[] }>("/api/backend/benchmark");

      setRuns(runsData.runs || []);
      setProviderHealth(healthData.providers || []);
      setBenchmarks(benchData.benchmarks || []);
      setAuthStatus(null);
      setError("");
      setLastUpdated(new Date().toLocaleTimeString());

      if (runsData.runs?.length > 0 && !selectedRunId) {
        setSelectedRunId(runsData.runs[0].runId);
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503)) {
        setAuthStatus(e.status);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load backend observatory data.");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedRunId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => {
      void loadData();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, loadData]);

  const currentRun = useMemo(() => {
    if (!runs.length) return null;
    return runs.find((r) => r.runId === selectedRunId) ?? runs[0];
  }, [runs, selectedRunId]);

  const tabs: Array<{ id: TabId; labelEn: string; labelAr: string; icon: string }> = [
    { id: "overview", labelEn: "Overview", labelAr: "نظرة عامة", icon: "📊" },
    { id: "graph", labelEn: "Stage Graph", labelAr: "مخطط المراحل", icon: "🔄" },
    { id: "routing", labelEn: "Route Decision", labelAr: "قرارات التوجيه", icon: "🧭" },
    { id: "constraints", labelEn: "Hard Constraints", labelAr: "الشروط الصارمة", icon: "🛡️" },
    { id: "fallbacks", labelEn: "Fallback Plan", labelAr: "خطة البدائل", icon: "🪜" },
    { id: "attempts", labelEn: "Attempts", labelAr: "محاولات التنفيذ", icon: "⚡" },
    { id: "events", labelEn: "Event Stream", labelAr: "سجل الأحداث", icon: "📜" },
    { id: "health", labelEn: "Provider Health", labelAr: "صحة المزودين", icon: "💓" },
    { id: "cost", labelEn: "Cost Trace", labelAr: "تتبع التكلفة", icon: "💰" },
    { id: "quality", labelEn: "Quality Review", labelAr: "مراجعة الجودة", icon: "⭐" },
    { id: "benchmark", labelEn: "Benchmark", labelAr: "المقارنات المعيارية", icon: "📈" },
  ];

  return (
    <main className="wrap" dir={ar ? "rtl" : "ltr"}>
      {/* Header */}
      <section className="dashboard-hero">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> {ar ? "مرصد المحرك الخلفي ووحدة التوجيه" : "Backend Observatory & Router Console"}
          </div>
          <h1>{ar ? "مرصد المحرك الخلفي — وحدة التوجيه" : "Backend Observatory"}</h1>
          <p>
            {ar
              ? "شفافية مطلقة لقرارات التوجيه، فصل النموذج المختار عن الفعلي، تتبع المحاولات الحقيقية، والجاهزية لدليل قهوة المستقبل."
              : "Complete transparent inspection of routing decisions, selected vs actual model separation, real attempt telemetry, and Future Gahwa proof readiness."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`action-link ${autoRefresh ? "" : "ghost"}`}
            onClick={() => setAutoRefresh((v) => !v)}
            style={{ fontSize: "0.82rem" }}
          >
            {autoRefresh ? (ar ? "● التحديث التلقائي نشط" : "● Auto-refresh ON (4s)") : (ar ? "○ التحديث التلقائي متوقف" : "○ Auto-refresh OFF")}
          </button>
          <button
            type="button"
            className="action-link ghost"
            onClick={() => void loadData()}
            disabled={loading}
            style={{ fontSize: "0.82rem" }}
          >
            {loading ? (ar ? "جارٍ التحديث…" : "Refreshing…") : (ar ? "🔄 تحديث الآن" : "🔄 Refresh")}
          </button>
          <span className="dim" style={{ fontSize: "0.75rem" }}>
            {ar ? "آخر تحديث:" : "Updated:"} {lastUpdated}
          </span>
        </div>
      </section>

      {authStatus !== null ? (
        <AccessGate status={authStatus} onUnlocked={() => void loadData()} />
      ) : (
        <>
          {error && <p className="warn">{error}</p>}

          {/* Run Selector Bar */}
          {runs.length > 0 && (
            <div
              className="card"
              style={{
                marginBottom: 16,
                padding: "10px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="eyebrow" style={{ margin: 0 }}>
                  {ar ? "تشغيل الإنتاج:" : "Inspect Run:"}
                </span>
                <select
                  value={currentRun?.runId ?? ""}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  style={{ minWidth: 260, fontSize: "0.86rem" }}
                >
                  {runs.map((r) => (
                    <option key={r.runId} value={r.runId}>
                      {r.projectName}: {r.episodeTitle} ({r.mode}) — {r.status}
                    </option>
                  ))}
                </select>
              </div>

              {currentRun && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    className="badge"
                    style={{
                      background: currentRun.mode === "AUTO" ? "rgba(46, 204, 113, 0.15)" : "rgba(52, 152, 219, 0.15)",
                      color: currentRun.mode === "AUTO" ? "#2ecc71" : "#3498db",
                      fontWeight: 600,
                    }}
                  >
                    {currentRun.mode === "AUTO" ? "DIRECTOR: AUTO" : "PRO / MANUAL"}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: currentRun.realExecution ? "rgba(46, 204, 113, 0.2)" : "rgba(241, 196, 15, 0.15)",
                      color: currentRun.realExecution ? "#2ecc71" : "#f1c40f",
                    }}
                  >
                    {currentRun.realExecution ? "✓ REAL EXECUTION" : "🧪 NOT RUN / TEST"}
                  </span>
                  <StatusBadge status={currentRun.status.toLowerCase()} />
                </div>
              )}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="chips" style={{ marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`button ${activeTab === tab.id ? "" : "ghost"}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}
              >
                {tab.icon} {ar ? tab.labelAr : tab.labelEn}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <section className="dashboard-grid" style={{ alignItems: "start" }}>
              <article className="card">
                <div className="dashboard-section-head">
                  <div>
                    <span className="eyebrow">{ar ? "بيانات التشغيل" : "Execution Overview"}</span>
                    <h2>{ar ? "معلومات الحلقة والموجه" : "Run & Router Transparency"}</h2>
                  </div>
                </div>

                {!currentRun ? (
                  <p className="dim">{ar ? "لا توجد تشغيلات مسجلة بعد. أنشئ حلقة جديدة من الاستوديو." : "No runs recorded yet. Start an episode from the Studio."}</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                      <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                        <small className="dim">{ar ? "معرّف التشغيل" : "Run ID"}</small>
                        <strong className="mono" style={{ display: "block", fontSize: "0.88rem", marginTop: 2 }}>
                          {currentRun.runId}
                        </strong>
                      </div>
                      <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                        <small className="dim">{ar ? "المشروع والحلقة" : "Project & Episode"}</small>
                        <strong style={{ display: "block", fontSize: "0.95rem", marginTop: 2 }}>
                          {currentRun.projectName} · {currentRun.episodeTitle}
                        </strong>
                      </div>
                      <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                        <small className="dim">{ar ? "المهمة والوضع" : "Task & Mode"}</small>
                        <strong style={{ display: "block", fontSize: "0.95rem", marginTop: 2 }}>
                          {currentRun.task} ({currentRun.mode})
                        </strong>
                      </div>
                      <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                        <small className="dim">{ar ? "المرحلة والحالة" : "Current Stage & Status"}</small>
                        <strong style={{ display: "block", fontSize: "0.95rem", marginTop: 2 }}>
                          {currentRun.currentStage} · {currentRun.status}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                      <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                        <small className="dim">{ar ? "وقت البدء" : "Started At"}</small>
                        <strong style={{ display: "block", fontSize: "0.85rem", marginTop: 2 }}>
                          {new Date(currentRun.startedAt).toLocaleString()}
                        </strong>
                      </div>
                      <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                        <small className="dim">{ar ? "الوقت المستغرق" : "Elapsed Time"}</small>
                        <strong style={{ display: "block", fontSize: "0.95rem", marginTop: 2 }}>
                          {(currentRun.elapsedTimeMs / 1000).toFixed(1)}s
                        </strong>
                      </div>
                      <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                        <small className="dim">{ar ? "التكلفة التقديرية" : "Estimated Cost"}</small>
                        <strong style={{ display: "block", fontSize: "0.95rem", marginTop: 2, color: "var(--yolk)" }}>
                          ${currentRun.costTrace.estimatedPrimaryCostUsd?.toFixed(3) ?? "UNKNOWN"}
                        </strong>
                      </div>
                      <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                        <small className="dim">{ar ? "التكلفة الفعلية" : "Actual Cost"}</small>
                        <strong style={{ display: "block", fontSize: "0.95rem", marginTop: 2, color: currentRun.costTrace.actualSpendUsd ? "#2ecc71" : "var(--muted)" }}>
                          {currentRun.costTrace.actualSpendUsd !== null ? `$${currentRun.costTrace.actualSpendUsd.toFixed(3)}` : "UNKNOWN"}
                        </strong>
                      </div>
                    </div>

                    {/* Selected vs Actual Callout */}
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid var(--line)",
                        marginTop: 4,
                      }}
                    >
                      <h3 style={{ margin: "0 0 8px 0", fontSize: "1rem" }}>
                        {ar ? "🎯 الفصل الصارم: النموذج المختار مقابل النموذج الفعلي" : "🎯 Selected vs Actual Route Integrity"}
                      </h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <span className="dim" style={{ fontSize: "0.8rem" }}>
                            {ar ? "النموذج المختار (Selected Model):" : "Selected Model:"}
                          </span>
                          <div className="mono" style={{ fontSize: "0.9rem", color: "var(--foreground)", marginTop: 2 }}>
                            {currentRun.selectedModel}
                          </div>
                        </div>
                        <div>
                          <span className="dim" style={{ fontSize: "0.8rem" }}>
                            {ar ? "النموذج الفعلي (Actual Executed Model):" : "Actual Model:"}
                          </span>
                          <div
                            className="mono"
                            style={{
                              fontSize: "0.9rem",
                              color: currentRun.actualModel ? "#2ecc71" : "var(--muted)",
                              marginTop: 2,
                            }}
                          >
                            {currentRun.actualModel ?? (ar ? "⏳ لم يتم التنفيذ بعد (NOT RUN YET)" : "⏳ NOT RUN YET")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>

              <aside className="card">
                <div className="dashboard-section-head">
                  <div>
                    <span className="eyebrow">{ar ? "مؤشرات الجاهزية" : "Readiness Metrics"}</span>
                    <h2>{ar ? "جاهزية قهوة المستقبل" : "Future Gahwa Proof"}</h2>
                  </div>
                </div>
                <div className="readiness-list">
                  <div>
                    <span className="integration-dot connected" />
                    <span>
                      <strong>{ar ? "السيناريو والحوار العربي الدقيق" : "Exact Arabic Dialogue"}</strong>
                      <small>{ar ? "محفوظ حرفياً ومربوط بـ Orus و Puck" : "Verbatim preserved & mapped to Orus & Puck"}</small>
                    </span>
                  </div>
                  <div>
                    <span className={`integration-dot ${currentRun?.quality.technicalValidation.assetExists ? "connected" : ""}`} />
                    <span>
                      <strong>{ar ? "المرجع البصري (9:16)" : "Visual Reference (9:16)"}</strong>
                      <small>{ar ? "أبو ناصر + الروبوت برق + ركن القهوة" : "Abu Nasser + Robot Barq + Saudi Coffee Corner"}</small>
                    </span>
                  </div>
                  <div>
                    <span className={`integration-dot ${currentRun?.realExecution ? "connected" : ""}`} />
                    <span>
                      <strong>{ar ? "توليد الفيديو الحقيقي" : "Real Video Generation"}</strong>
                      <small>{ar ? "Google Veo 3.1 مع المرجع والصوت الطبيعي" : "Google Veo 3.1 with reference & native audio"}</small>
                    </span>
                  </div>
                  <div>
                    <span className={`integration-dot ${currentRun?.quality.humanQualityState === "ACCEPT" ? "connected" : ""}`} />
                    <span>
                      <strong>{ar ? "مراجعة الجودة والاعتماد" : "Quality Review & Acceptance"}</strong>
                      <small>{ar ? "فحص ثبات الشخصيات وانعدام الانجراف" : "Zero character drift verification"}</small>
                    </span>
                  </div>
                </div>
              </aside>
            </section>
          )}

          {/* TAB 2: STAGE GRAPH */}
          {activeTab === "graph" && currentRun && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "مسار العمل الكامل" : "Stage Workflow Graph"}</span>
                  <h2>{ar ? "مخطط تدفق الإنتاج V1" : "V1 Production Stage Graph"}</h2>
                </div>
              </div>
              <p className="dim" style={{ marginBottom: 16 }}>
                {ar
                  ? "تتبع تسلسل المراحل من التخطيط حتى الاعتماد النهائي، مع إظهار الحالة الحقيقية والنموذج المختار والفعلي لكل مرحلة."
                  : "Tracks workflow stages from planning to final approval, showing truthful stage status and selected vs actual models."}
              </p>

              <div style={{ display: "grid", gap: 10 }}>
                {currentRun.stageGraph.map((node: StageGraphNode) => {
                  const isDone = node.status === "SUCCESS";
                  const isRunning = node.status === "RUNNING";
                  const isFailed = node.status === "FAILED";
                  const isWaiting = node.status === "WAITING_FOR_APPROVAL";

                  return (
                    <div
                      key={node.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 8,
                        background: isRunning
                          ? "rgba(46, 204, 113, 0.06)"
                          : isFailed
                          ? "rgba(231, 76, 60, 0.08)"
                          : isWaiting
                          ? "rgba(241, 196, 15, 0.08)"
                          : "var(--card-subtle)",
                        border: `1px solid ${isRunning ? "#2ecc71" : isFailed ? "#e74c3c" : "var(--line)"}`,
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: 14,
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: isDone ? "#2ecc71" : isRunning ? "#f39c12" : isFailed ? "#e74c3c" : "var(--line)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                        }}
                      >
                        {node.order}
                      </span>

                      <div>
                        <strong style={{ fontSize: "1rem" }}>{ar ? node.labelAr : node.label}</strong>
                        {node.selectedModel && (
                          <span className="dim" style={{ fontSize: "0.82rem", marginInlineStart: 8 }}>
                            ({ar ? "المختار:" : "Selected:"} {node.selectedModel})
                          </span>
                        )}
                        {node.actualModel && (
                          <span className="mono" style={{ fontSize: "0.8rem", color: "#2ecc71", marginInlineStart: 8 }}>
                            [{ar ? "الفعلي:" : "Actual:"} {node.actualModel}]
                          </span>
                        )}
                        {node.error && (
                          <div style={{ color: "#e74c3c", fontSize: "0.82rem", marginTop: 4 }}>
                            {node.error}
                          </div>
                        )}
                      </div>

                      <div>
                        <StatusBadge status={isDone ? "ready" : isRunning ? "generating" : isFailed ? "failed" : node.status.toLowerCase()} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* TAB 3: ROUTE DECISION */}
          {activeTab === "routing" && currentRun && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "قرارات التوجيه والمسارات" : "Route Decisions & Candidates"}</span>
                  <h2>{ar ? "تحليل المسارات المؤهلة والمستبعدة" : "Candidate Route Evaluation"}</h2>
                </div>
              </div>

              {Object.entries(currentRun.routeDecisions).map(([stage, candidates]) => (
                <div key={stage} style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: "1.05rem", textTransform: "capitalize", margin: "0 0 10px 0", color: "var(--yolk)" }}>
                    📍 {stage.replace("_", " ").toUpperCase()}
                  </h3>

                  <div style={{ display: "grid", gap: 10 }}>
                    {candidates.map((c) => {
                      const isEligible = c.capabilityState === "ELIGIBLE";
                      const isEliminated = c.capabilityState === "ELIMINATED";
                      const isUnverified = c.capabilityState === "UNVERIFIED";

                      return (
                        <div
                          key={c.route.id}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            background: c.selected
                              ? "rgba(46, 204, 113, 0.05)"
                              : isEliminated
                              ? "rgba(231, 76, 60, 0.03)"
                              : "var(--card-subtle)",
                            border: `1px solid ${c.selected ? "#2ecc71" : isEliminated ? "rgba(231,76,60,0.3)" : "var(--line)"}`,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <div>
                              <strong style={{ fontSize: "0.95rem" }}>
                                #{c.rank} {c.route.developer} · {c.route.modelFamily}
                              </strong>
                              <span className="mono dim" style={{ fontSize: "0.8rem", marginInlineStart: 8 }}>
                                ({c.route.exactModel}) via {c.route.accessChannel}
                              </span>
                            </div>

                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span
                                className="badge"
                                style={{
                                  background: isEligible ? "rgba(46,204,113,0.15)" : isEliminated ? "rgba(231,76,60,0.15)" : "rgba(241,196,15,0.15)",
                                  color: isEligible ? "#2ecc71" : isEliminated ? "#e74c3c" : "#f1c40f",
                                  fontWeight: 600,
                                }}
                              >
                                {c.capabilityState}
                              </span>
                              {c.selected && (
                                <span className="badge" style={{ background: "#2ecc71", color: "#000", fontWeight: 700 }}>
                                  ✓ SELECTED
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ marginTop: 6, fontSize: "0.85rem" }}>
                            {c.whySelected && <p style={{ margin: "2px 0", color: "#2ecc71" }}>💡 <strong>{ar ? "سبب الاختيار:" : "Why selected:"}</strong> {c.whySelected}</p>}
                            {c.whyNotSelected && <p style={{ margin: "2px 0", color: "var(--muted)" }}>⚠️ <strong>{ar ? "سبب عدم الاختيار:" : "Why not selected:"}</strong> {c.whyNotSelected}</p>}
                            {c.eliminatedReason && <p style={{ margin: "2px 0", color: "#e74c3c" }}>❌ <strong>{ar ? "سبب الاستبعاد:" : "Elimination reason:"}</strong> {c.eliminatedReason}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* TAB 4: HARD CONSTRAINTS */}
          {activeTab === "constraints" && currentRun && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "فحص الشروط الصارمة" : "Evaluated Hard Constraints"}</span>
                  <h2>{ar ? "الشروط الإلزامية لكل مرحلة" : "Mandatory Hard Constraint Matrix"}</h2>
                </div>
              </div>
              <p className="dim" style={{ marginBottom: 16 }}>
                {ar
                  ? "القاعدة الأساسية: UNKNOWN لا يصبح SUPPORTED تلقائياً. أي شرط غير مؤكد يبقى UNKNOWN."
                  : "Rule: UNKNOWN must never automatically become SUPPORTED. Unverified conditions remain UNKNOWN."}
              </p>

              {Object.entries(currentRun.hardConstraints).map(([stage, constraints]) => (
                <div key={stage} style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: "1rem", textTransform: "capitalize", margin: "0 0 10px 0", color: "var(--yolk)" }}>
                    🛡️ {stage.replace("_", " ").toUpperCase()}
                  </h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {constraints.map((con) => (
                      <div
                        key={con.id}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: "var(--card-subtle)",
                          border: "1px solid var(--line)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div>
                          <strong>{ar ? con.nameAr ?? con.name : con.name}</strong>
                          <p className="dim" style={{ margin: "2px 0 0 0", fontSize: "0.82rem" }}>
                            {con.requirement} {con.details ? `· ${con.details}` : ""}
                          </p>
                        </div>

                        <span
                          className="badge"
                          style={{
                            background: con.evaluation === "PASS" ? "rgba(46,204,113,0.15)" : con.evaluation === "FAIL" ? "rgba(231,76,60,0.15)" : "rgba(255,255,255,0.06)",
                            color: con.evaluation === "PASS" ? "#2ecc71" : con.evaluation === "FAIL" ? "#e74c3c" : "var(--muted)",
                            fontWeight: 700,
                          }}
                        >
                          {con.evaluation}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* TAB 5: FALLBACK PLAN */}
          {activeTab === "fallbacks" && currentRun && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "سلم التراجع والبدائل" : "Fallback Ladder"}</span>
                  <h2>{ar ? "خطة البدائل المنظمة" : "Classified Fallback Hierarchy"}</h2>
                </div>
              </div>
              <p className="dim" style={{ marginBottom: 16 }}>
                {ar
                  ? "السلم: ١. إعادة نفس المسار (للأخطاء المؤقتة) → ٢. مسار معتمد بديل لنفس النموذج → ٣. مسار شبه مكافئ → ٤. سؤال المستخدم → ٥. إيقاف."
                  : "Ladder: 1. Same route retry (transient) → 2. Certified equivalent → 3. Near-equivalent → 4. Ask user → 5. Stop."}
              </p>

              {Object.entries(currentRun.fallbackPlans).map(([stage, plans]) => (
                <div key={stage} style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: "1rem", textTransform: "capitalize", margin: "0 0 10px 0", color: "var(--yolk)" }}>
                    🪜 {stage.replace("_", " ").toUpperCase()}
                  </h3>

                  <div style={{ display: "grid", gap: 8 }}>
                    {plans.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: "var(--card-subtle)",
                          border: "1px solid var(--line)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <div>
                          <strong>
                            {p.route.developer} · {p.route.modelFamily} ({p.route.exactModel})
                          </strong>
                          <p className="dim" style={{ margin: "2px 0 0 0", fontSize: "0.82rem" }}>
                            {ar ? p.reasonAr ?? p.reason : p.reason}
                          </p>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span className="badge ghost" style={{ fontSize: "0.75rem" }}>
                            {p.fallbackClass}
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: p.autoAllowed ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
                              color: p.autoAllowed ? "#2ecc71" : "#e74c3c",
                            }}
                          >
                            {p.autoAllowed ? (ar ? "تلقائي مسموح" : "AUTO ALLOWED") : (ar ? "يتطلب إذناً" : "ASK USER")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* TAB 6: ATTEMPTS */}
          {activeTab === "attempts" && currentRun && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "سجل المحاولات الفعلية" : "Actual Execution Attempts"}</span>
                  <h2>{ar ? "المحاولات المزودة الحقيقية (لا تلفيق)" : "Actual Provider Attempts"}</h2>
                </div>
              </div>
              <p className="dim" style={{ marginBottom: 16 }}>
                {ar
                  ? "يتم تسجيل المحاولات الحقيقية فقط. لا يتم اختلاق أرقام مهام أو أكواد HTTP."
                  : "Only records attempts that ACTUALLY occurred. Never fabricates job IDs, costs, or HTTP results."}
              </p>

              {currentRun.attempts.length === 0 ? (
                <p className="dim" style={{ padding: 20, textAlign: "center" }}>
                  {ar ? "لم يتم تنفيذ أي محاولات مدفوعة أو غير ضرورية بعد." : "No actual provider attempts recorded for this run yet."}
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {currentRun.attempts.map((att) => (
                    <div
                      key={att.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: att.result === "SUCCESS" ? "rgba(46,204,113,0.05)" : "rgba(231,76,60,0.05)",
                        border: `1px solid ${att.result === "SUCCESS" ? "#2ecc71" : "#e74c3c"}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <strong>
                            #{att.attemptNumber} · {att.stage.toUpperCase()} ({att.provider} via {att.channel})
                          </strong>
                          <div className="mono dim" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                            Model: {att.selectedModel} | Job: {att.providerJobId ?? "null"} | Status: HTTP {att.httpStatus ?? "N/A"}
                          </div>
                        </div>

                        <span
                          className="badge"
                          style={{
                            background: att.result === "SUCCESS" ? "rgba(46,204,113,0.2)" : "rgba(231,76,60,0.2)",
                            color: att.result === "SUCCESS" ? "#2ecc71" : "#e74c3c",
                            fontWeight: 700,
                          }}
                        >
                          {att.result}
                        </span>
                      </div>

                      {att.failureType && (
                        <div style={{ marginTop: 6, fontSize: "0.82rem", color: "#e74c3c" }}>
                          ❌ <strong>{att.failureType}</strong> ({att.failureScope ?? "UNKNOWN"} scope): {att.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB 7: EVENT STREAM */}
          {activeTab === "events" && currentRun && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "سجل الأحداث الزمني" : "Chronological Event Stream"}</span>
                  <h2>{ar ? "سلسلة أحداث التشغيل" : "Observatory Event Stream"}</h2>
                </div>
              </div>

              {currentRun.events.length === 0 ? (
                <p className="dim">{ar ? "لا توجد أحداث مسجلة بعد." : "No events recorded yet."}</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {currentRun.events.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "var(--card-subtle)",
                        border: "1px solid var(--line)",
                        display: "grid",
                        gridTemplateColumns: "auto auto 1fr",
                        gap: 10,
                        alignItems: "center",
                        fontSize: "0.85rem",
                      }}
                    >
                      <span className="mono dim" style={{ fontSize: "0.75rem" }}>
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className="badge compact"
                        style={{
                          fontSize: "0.7rem",
                          background: evt.severity === "SUCCESS" ? "rgba(46,204,113,0.15)" : evt.severity === "ERROR" ? "rgba(231,76,60,0.15)" : "rgba(255,255,255,0.06)",
                          color: evt.severity === "SUCCESS" ? "#2ecc71" : evt.severity === "ERROR" ? "#e74c3c" : "var(--foreground)",
                        }}
                      >
                        {evt.eventType}
                      </span>
                      <div>{ar ? evt.messageAr ?? evt.message : evt.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB 8: PROVIDER HEALTH */}
          {activeTab === "health" && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "صحة المزودين وقنوات الوصول" : "Passive Provider Telemetry"}</span>
                  <h2>{ar ? "حالة المزودين وقنوات الربط" : "Provider Health & Circuit Status"}</h2>
                </div>
              </div>
              <p className="dim" style={{ marginBottom: 16 }}>
                {ar
                  ? "قياسات سلبية: لا نقوم بتوليد فيديو مدفوع فقط لجعل البطاقات خضراء. القيم غير المؤكدة تبقى UNKNOWN."
                  : "Passive telemetry first: we do not execute paid generations to turn cards green. Unverified metrics remain UNKNOWN."}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                {providerHealth.map((h) => (
                  <div key={h.id} className="card" style={{ padding: 14, background: "var(--card-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong>{h.name}</strong>
                      <span
                        className="badge"
                        style={{
                          background: h.configured ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
                          color: h.configured ? "#2ecc71" : "#e74c3c",
                        }}
                      >
                        {h.configured ? "CONFIGURED" : "NOT CONFIGURED"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: "0.8rem" }}>
                      <div>Channel: <span className="mono">{h.channel}</span></div>
                      <div>Quota: <span className="mono">{h.quotaState}</span></div>
                      <div>Circuit: <span className="mono">{h.circuitBreaker}</span></div>
                      <div>Success Rate: <span className="mono">{h.recentSuccessRate !== null ? `${(h.recentSuccessRate * 100).toFixed(0)}%` : "UNKNOWN"}</span></div>
                      <div>429 Rate: <span className="mono">{h.rate429 !== null ? `${h.rate429}%` : "UNKNOWN"}</span></div>
                      <div>5xx Rate: <span className="mono">{h.rate5xx !== null ? `${h.rate5xx}%` : "UNKNOWN"}</span></div>
                      <div>p50 Latency: <span className="mono">{h.p50Ms ? `${h.p50Ms}ms` : "UNKNOWN"}</span></div>
                      <div>p95 Latency: <span className="mono">{h.p95Ms ? `${h.p95Ms}ms` : "UNKNOWN"}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TAB 9: COST TRACE */}
          {activeTab === "cost" && currentRun && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "تتبع التكلفة والإنفاق" : "Cost Breakdown & Exposure"}</span>
                  <h2>{ar ? "تفاصيل التكلفة التقديرية والفعلية" : "Cost Trace & Financial Safeguards"}</h2>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                  <small className="dim">{ar ? "التكلفة التقديرية الأساسية" : "Estimated Primary Cost"}</small>
                  <strong style={{ display: "block", fontSize: "1.1rem", color: "var(--yolk)", marginTop: 4 }}>
                    ${currentRun.costTrace.estimatedPrimaryCostUsd?.toFixed(3) ?? "UNKNOWN"}
                  </strong>
                </div>
                <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                  <small className="dim">{ar ? "الإنفاق الفعلي المؤكد" : "Actual Spend"}</small>
                  <strong style={{ display: "block", fontSize: "1.1rem", color: "#2ecc71", marginTop: 4 }}>
                    ${currentRun.costTrace.actualSpendUsd?.toFixed(3) ?? "0.000"}
                  </strong>
                </div>
                <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                  <small className="dim">{ar ? "تكلفة المحاولات الفاشلة" : "Failed Attempt Spend"}</small>
                  <strong style={{ display: "block", fontSize: "1.1rem", color: "#e74c3c", marginTop: 4 }}>
                    ${currentRun.costTrace.failedAttemptSpendUsd?.toFixed(3) ?? "0.000"}
                  </strong>
                </div>
                <div className="card" style={{ padding: 12, background: "var(--card-subtle)" }}>
                  <small className="dim">{ar ? "تكلفة الدبلجة الصوتية (TTS)" : "TTS Audio Cost"}</small>
                  <strong style={{ display: "block", fontSize: "1.1rem", marginTop: 4 }}>
                    ${currentRun.costTrace.ttsCostUsd?.toFixed(3) ?? "0.000"}
                  </strong>
                </div>
              </div>
            </section>
          )}

          {/* TAB 10: QUALITY REVIEW */}
          {activeTab === "quality" && currentRun && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "مراجعة الجودة الفنية والبشرية" : "Technical & Human Quality Review"}</span>
                  <h2>{ar ? "فحص الجودة ومنع الانجراف" : "Quality Validation & Artifact Inspection"}</h2>
                </div>
              </div>
              <p className="dim" style={{ marginBottom: 16 }}>
                {ar
                  ? "القاعدة: نجاح HTTP 200 لا يعني بالضرورة نجاح الجودة. يجب التحقق التقني والبشري."
                  : "Rule: HTTP 200 does NOT equal Quality PASS. Technical and human validation are distinct."}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="card" style={{ padding: 14, background: "var(--card-subtle)" }}>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>
                    ⚙️ {ar ? "التحقق التقني (Technical Validation)" : "Technical Validation"}
                  </h3>
                  <div style={{ display: "grid", gap: 6, fontSize: "0.85rem" }}>
                    <div>Asset Exists: <strong>{currentRun.quality.technicalValidation.assetExists ? "YES" : "NO"}</strong></div>
                    <div>Aspect Ratio: <strong>{currentRun.quality.technicalValidation.aspectRatio}</strong></div>
                    <div>Resolution: <strong>{currentRun.quality.technicalValidation.resolution ?? "UNKNOWN"}</strong></div>
                    <div>Duration: <strong>{currentRun.quality.technicalValidation.durationSeconds ? `${currentRun.quality.technicalValidation.durationSeconds}s` : "UNKNOWN"}</strong></div>
                    <div>Audio Present: <strong>{currentRun.quality.technicalValidation.audioPresent ? "YES" : "NO"}</strong></div>
                    <div>Playable: <strong>{currentRun.quality.technicalValidation.playable ? "YES" : "NO"}</strong></div>
                  </div>
                </div>

                <div className="card" style={{ padding: 14, background: "var(--card-subtle)" }}>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>
                    👤 {ar ? "التقييم البشري (Human Quality State)" : "Human Quality State"}
                  </h3>
                  <div style={{ marginBottom: 10 }}>
                    <span
                      className="badge"
                      style={{
                        background: currentRun.quality.humanQualityState === "ACCEPT" ? "rgba(46,204,113,0.2)" : "rgba(255,255,255,0.06)",
                        color: currentRun.quality.humanQualityState === "ACCEPT" ? "#2ecc71" : "var(--foreground)",
                        fontWeight: 700,
                      }}
                    >
                      {currentRun.quality.humanQualityState}
                    </span>
                  </div>
                  {currentRun.quality.rejectionReasons && currentRun.quality.rejectionReasons.length > 0 && (
                    <div style={{ fontSize: "0.82rem", color: "#e74c3c" }}>
                      <strong>Rejection reasons:</strong> {currentRun.quality.rejectionReasons.join(", ")}
                    </div>
                  )}
                  {currentRun.quality.notes && (
                    <p className="dim" style={{ margin: "8px 0 0 0", fontSize: "0.82rem" }}>
                      Notes: {currentRun.quality.notes}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* TAB 11: BENCHMARK */}
          {activeTab === "benchmark" && (
            <section className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "المقارنات المعيارية الحقيقية" : "Empirical Route Benchmarks"}</span>
                  <h2>{ar ? "بيانات الأداء والتكلفة للمسارات" : "Empirical Route Benchmark Metrics"}</h2>
                </div>
              </div>
              <p className="dim" style={{ marginBottom: 16 }}>
                {ar
                  ? "تجميع بيانات الأداء الفعلي عبر المشاريع والنماذج والقنوات (جمع بيانات فقط دون تعلم ذاتي غير خاضع للرقابة)."
                  : "Aggregated performance and cost metrics across projects, models, and channels (data collection only)."}
              </p>

              {benchmarks.length === 0 ? (
                <p className="dim">{ar ? "لا توجد بيانات مقارنات معيارية مسجلة بعد." : "No benchmark data aggregated yet."}</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: ar ? "right" : "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,0.02)" }}>
                        <th style={{ padding: "8px 10px" }}>Project</th>
                        <th style={{ padding: "8px 10px" }}>Model & Route</th>
                        <th style={{ padding: "8px 10px" }}>Attempts</th>
                        <th style={{ padding: "8px 10px" }}>Tech Success %</th>
                        <th style={{ padding: "8px 10px" }}>Accepted %</th>
                        <th style={{ padding: "8px 10px" }}>Avg Latency</th>
                        <th style={{ padding: "8px 10px" }}>Est. Cost</th>
                        <th style={{ padding: "8px 10px" }}>Actual Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarks.map((b, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "8px 10px" }}>{b.project}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <strong>{b.model}</strong>
                            <small className="dim" style={{ display: "block" }}>{b.channel}</small>
                          </td>
                          <td style={{ padding: "8px 10px" }}>{b.attempts}</td>
                          <td style={{ padding: "8px 10px", color: b.technicalSuccessPercent > 80 ? "#2ecc71" : "#f1c40f" }}>
                            {b.technicalSuccessPercent}%
                          </td>
                          <td style={{ padding: "8px 10px" }}>{b.acceptedPercent}%</td>
                          <td style={{ padding: "8px 10px" }}>{b.averageLatencyMs ? `${b.averageLatencyMs}ms` : "—"}</td>
                          <td style={{ padding: "8px 10px" }}>{b.estimatedCostUsd ? `$${b.estimatedCostUsd.toFixed(3)}` : "—"}</td>
                          <td style={{ padding: "8px 10px" }}>{b.actualCostUsd ? `$${b.actualCostUsd.toFixed(3)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
