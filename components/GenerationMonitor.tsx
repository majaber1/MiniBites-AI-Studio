"use client";

import StatusBadge from "@/components/StatusBadge";
import type { StageMonitorEntry, DirectorMode, AudioMode } from "@/lib/types";

interface GenerationMonitorProps {
  monitor?: StageMonitorEntry[];
  directorMode?: DirectorMode;
  audioMode?: AudioMode;
  provider?: string;
  className?: string;
}

const STAGE_LABELS: Record<string, { en: string; ar: string; icon: string }> = {
  planning: { en: "1. Planning & Storyboard", ar: "١. التخطيط والسيناريو", icon: "📝" },
  reference_image: { en: "2. Visual Reference", ar: "٢. المرجع البصري (Image)", icon: "🖼️" },
  video: { en: "3. Video Generation", ar: "٣. توليد الفيديو (Video)", icon: "🎥" },
  audio: { en: "4. Arabic TTS & Sound", ar: "٤. الصوت والدبلجة (Audio)", icon: "🎙️" },
  assembly: { en: "5. Assembly & Stitch", ar: "٥. المونتاج والتجميع", icon: "🎞️" },
  storage: { en: "6. Media Storage", ar: "٦. الحفظ والأرشفة", icon: "💾" },
  publishing: { en: "7. Publishing & Dispatch", ar: "٧. النشر والتوزيع", icon: "🚀" },
};

export default function GenerationMonitor({
  monitor,
  directorMode = "auto",
  audioMode,
  provider,
  className = "",
}: GenerationMonitorProps) {
  if (!monitor || monitor.length === 0) return null;

  return (
    <section className={`card generation-monitor ${className}`} style={{ marginTop: 20, marginBottom: 20 }}>
      <div className="dashboard-section-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span className="eyebrow" style={{ margin: 0 }}>📊 Model Transparency</span>
            <span
              className="badge"
              style={{
                background: directorMode === "auto" ? "rgba(46, 204, 113, 0.15)" : "rgba(52, 152, 219, 0.15)",
                color: directorMode === "auto" ? "var(--yolk, #2ecc71)" : "#3498db",
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            >
              {directorMode === "auto" ? "AI DIRECTOR: AUTO" : "PRO / MANUAL MODE"}
            </span>
            <span className="badge ghost" style={{ fontSize: "0.75rem" }}>
              Fallback: NO (Strict)
            </span>
          </div>
          <h2 style={{ fontSize: "1.15rem", margin: "4px 0" }}>Generation Monitor & Model Inspector</h2>
          <p className="dim" style={{ margin: 0, fontSize: "0.85rem" }}>
            Real-time inspection of selected vs. actual models, selection reasoning, and stage status.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {monitor.map((entry) => {
          const meta = STAGE_LABELS[entry.stage] ?? { en: entry.stage, ar: entry.stage, icon: "⚙️" };
          const isComplete = entry.status === "completed";
          const isRunning = entry.status === "running";
          const isFailed = entry.status === "failed";

          return (
            <div
              key={entry.stage}
              style={{
                background: isRunning
                  ? "rgba(46, 204, 113, 0.04)"
                  : isFailed
                  ? "rgba(231, 76, 60, 0.05)"
                  : "var(--card-subtle, rgba(255, 255, 255, 0.02))",
                border: `1px solid ${isRunning ? "var(--yolk, #2ecc71)" : "var(--line)"}`,
                borderRadius: 10,
                padding: "10px 14px",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <strong style={{ fontSize: "0.95rem" }}>
                    {meta.icon} {meta.en}
                  </strong>
                  <span className="dim" style={{ fontSize: "0.8rem" }}>
                    · {entry.provider}
                  </span>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontFamily: "var(--font-mono, monospace)",
                      background: entry.actualModel ? "rgba(46, 204, 113, 0.12)" : "rgba(255, 255, 255, 0.06)",
                      color: entry.actualModel ? "var(--yolk, #2ecc71)" : "var(--muted)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {entry.actualModel ? `Actual: ${entry.actualModel}` : "⏳ Not executed yet"}
                  </span>
                  <span className="dim" style={{ fontSize: "0.75rem" }}>
                    (Selected: {entry.selectedModel})
                  </span>
                  {entry.status === "completed" && (
                    <span
                      className="badge compact"
                      style={{
                        fontSize: "0.68rem",
                        padding: "1px 5px",
                        background: entry.realExecution ? "rgba(46, 204, 113, 0.2)" : "rgba(241, 196, 15, 0.15)",
                        color: entry.realExecution ? "#2ecc71" : "#f1c40f",
                      }}
                    >
                      {entry.realExecution ? "✓ Real Execution" : "🧪 Mock / Test"}
                    </span>
                  )}
                </div>

                {(entry.selectionReason || entry.whySelected) && (
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--muted, #888)" }}>
                    💡 <em>{entry.selectionReason || entry.whySelected}</em>
                  </p>
                )}

                {entry.referenceAssets && entry.referenceAssets.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                    <small className="dim">Reference assets:</small>
                    {entry.referenceAssets.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt="Reference asset"
                        style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover", border: "1px solid var(--line)" }}
                      />
                    ))}
                  </div>
                )}

                {entry.providerJobId && (
                  <small style={{ display: "block", marginTop: 4, fontFamily: "monospace", color: "var(--muted)" }}>
                    Job ID: {entry.providerJobId}
                  </small>
                )}

                {entry.error && (
                  <small style={{ display: "block", marginTop: 4, color: "#e74c3c" }}>
                    Error: {entry.error}
                  </small>
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <StatusBadge status={entry.status === "completed" ? "ready" : entry.status === "running" ? "generating" : entry.status} />
                {entry.startedAt && (
                  <small className="dim" style={{ display: "block", marginTop: 4, fontSize: "0.72rem" }}>
                    {entry.startedAt.slice(11, 19)}
                  </small>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
