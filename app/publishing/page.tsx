"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import { useLocale } from "@/components/LocaleProvider";
import type { Production, PublishPlatform } from "@/lib/types";

const platforms: Array<{ id: PublishPlatform; label: string; studioUrl: string }> = [
  { id: "youtube", label: "YouTube Shorts", studioUrl: "https://studio.youtube.com" },
  { id: "tiktok", label: "TikTok", studioUrl: "https://www.tiktok.com/creator-center/upload" },
  { id: "instagram", label: "Instagram Reels", studioUrl: "https://www.instagram.com" },
  { id: "x", label: "X / Twitter", studioUrl: "https://x.com" },
  { id: "snapchat", label: "Snapchat Spotlight", studioUrl: "https://my.snapchat.com" },
];

export default function PublishingPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [productions, setProductions] = useState<Production[]>([]);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copyToast, setCopyToast] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, PublishPlatform[]>>({});

  const load = useCallback(async () => {
    try {
      const result = await api<{ productions: Production[] }>("/api/productions");
      setProductions(result.productions.filter((p) => p.approved || p.status === "completed" || p.status === "awaiting_approval"));
      setAuthStatus(null);
      setError("");
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 503)) setAuthStatus(reason.status);
      else setError(reason instanceof Error ? reason.message : "Publishing queue could not be loaded.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string, platform: PublishPlatform) {
    setSelected((current) => {
      const existing = current[id] ?? [];
      return { ...current, [id]: existing.includes(platform) ? existing.filter((p) => p !== platform) : [...existing, platform] };
    });
  }

  async function approveProduction(p: Production) {
    setBusy(p.id);
    setError("");
    try {
      await api(`/api/productions/${p.id}/approve`, { method: "POST", body: "{}" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Approval failed.");
    } finally {
      setBusy(null);
    }
  }

  async function publish(production: Production) {
    const targets = selected[production.id] ?? production.publish.filter((entry) => entry.status !== "published").map((entry) => entry.platform);
    if (targets.length === 0) return;
    if (!window.confirm(ar ? `نشر الحلقة على ${targets.length} منصة؟` : `Publish this episode to ${targets.length} platform(s)?`)) return;
    setBusy(production.id);
    setError("");
    try {
      await api(`/api/productions/${production.id}/publish`, { method: "POST", body: JSON.stringify({ platforms: targets }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Publishing failed.");
    } finally {
      setBusy(null);
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopyToast(ar ? `تم نسخ ${label} إلى الحافظة!` : `Copied ${label} to clipboard!`);
    setTimeout(() => setCopyToast(""), 3000);
  }

  return (
    <main className="wrap">
      <section className="dashboard-hero">
        <div>
          <div className="eyebrow">{ar ? "من حلقة إلى جمهور" : "Episode to audience"}</div>
          <h1>{ar ? "مركز النشر وتوزيع المحتوى" : "Publishing & Distribution Hub"}</h1>
          <p>
            {ar
              ? "نشر مؤتمت عبر واجهات برمجة التطبيقات المعتمدة، أو تسليم يدوي آمن (تحميل MP4 + نسخ الوصف والوسوم)."
              : "Direct API-confirmed publishing for connected platforms, or safe manual handoff (Download MP4 + Copy Caption & Hashtags)."}
          </p>
        </div>
      </section>

      {authStatus !== null ? (
        <AccessGate status={authStatus} onUnlocked={() => void load()} />
      ) : (
        <>
          {error && <p className="warn">{error}</p>}
          {copyToast && <div className="note" style={{ marginBottom: 16 }}><strong>{copyToast}</strong></div>}

          {productions.length === 0 ? (
            <div className="card">
              <h2>{ar ? "لا يوجد شيء جاهز للنشر بعد" : "Nothing ready to publish yet"}</h2>
              <p className="dim">{ar ? "قم بتوليد حلقة وتجميع الفيديو النهائي لتظهر هنا." : "Generate and assemble an episode to publish it here."}</p>
            </div>
          ) : (
            productions.map((p) => (
              <section key={p.id} className="card" style={{ marginBottom: 20 }}>
                <div className="dashboard-section-head">
                  <div>
                    <span className="eyebrow">{p.projectName ?? "MiniBites"}</span>
                    <h2>{p.episodeTitle ?? p.dish}</h2>
                    <p className="dim">{p.publishTitle ?? p.dish}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <StatusBadge status={p.approved ? "ready" : p.status} />
                    {!p.approved && (
                      <button className="button compact" onClick={() => approveProduction(p)} disabled={busy === p.id}>
                        {busy === p.id ? "…" : ar ? "✓ اعتماد الفيديو للنشر" : "✓ Approve for Publishing"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="dashboard-grid" style={{ alignItems: "start", marginTop: 12 }}>
                  <div>
                    <div style={{ background: "var(--card-subtle, rgba(255,255,255,0.03))", padding: 12, borderRadius: 8, marginBottom: 12 }}>
                      <p style={{ margin: "0 0 6px 0", fontWeight: 500 }}>{p.publishCaption}</p>
                      <p className="dim" style={{ margin: 0 }}>{p.publishHashtags?.join(" ")}</p>
                    </div>

                    {p.finalVideoUrl && (
                      <video src={p.finalVideoUrl} controls playsInline style={{ width: "100%", maxHeight: 420, borderRadius: 12, border: "1px solid var(--line)" }} />
                    )}

                    {/* Manual Handoff Tools */}
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {p.finalVideoUrl && (
                        <a className="button compact ghost" href={p.finalVideoUrl} download={`${p.dish || "video"}.mp4`} target="_blank" rel="noreferrer">
                          📥 {ar ? "تحميل MP4" : "Download MP4"}
                        </a>
                      )}
                      <button className="button compact ghost" onClick={() => copyText(p.publishCaption ?? "", "Caption")}>
                        📋 {ar ? "نسخ الوصف" : "Copy Caption"}
                      </button>
                      <button className="button compact ghost" onClick={() => copyText(p.publishHashtags?.join(" ") ?? "", "Hashtags")}>
                        #️⃣ {ar ? "نسخ الوسوم" : "Copy Hashtags"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{ar ? "قنوات النشر" : "Publishing Channels"}</h3>
                    <div className="readiness-list">
                      {platforms.map((platform) => {
                        const state = p.publish.find((entry) => entry.platform === platform.id);
                        const isSnap = platform.id === "snapchat";
                        const checked = (selected[p.id] ?? []).includes(platform.id);

                        return (
                          <div key={platform.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={state?.status === "published" || !p.approved || isSnap}
                              onChange={() => toggle(p.id, platform.id)}
                            />
                            <div>
                              <strong>{platform.label}</strong>
                              <small style={{ display: "block", color: "var(--muted)" }}>
                                {isSnap
                                  ? (ar ? "يدوي: حمّل الفيديو والصق الوصف في Snapchat" : "Manual only: Download MP4 and upload directly")
                                  : state?.requiredAction ?? (state?.status === "published" ? (ar ? "تم النشر بنجاح" : "Published") : (ar ? "جاهز للنشر عند التحديد" : "Ready to publish"))}
                              </small>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <StatusBadge status={isSnap ? "manual_only" : (state?.status ?? "not_connected")} />
                              <a className="button compact ghost" href={platform.studioUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", padding: "2px 6px" }}>
                                ↗
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                      <button className="button" onClick={() => void publish(p)} disabled={!p.approved || busy === p.id}>
                        {busy === p.id ? (ar ? "جارٍ النشر…" : "Publishing…") : (ar ? "نشر على القنوات المحددة" : "Publish Selected")}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ))
          )}
        </>
      )}
    </main>
  );
}

