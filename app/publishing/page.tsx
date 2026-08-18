"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import { useLocale } from "@/components/LocaleProvider";
import type { Production, PublishPlatform } from "@/lib/types";

const platforms: Array<{ id: PublishPlatform; label: string }> = [
  { id: "youtube", label: "YouTube Shorts" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram Reels" },
  { id: "x", label: "X" },
  { id: "snapchat", label: "Snapchat" },
];

export default function PublishingPage() {
  const { locale } = useLocale(); const ar = locale === "ar";
  const [productions, setProductions] = useState<Production[]>([]);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, PublishPlatform[]>>({});

  const load = useCallback(async () => {
    try {
      const result = await api<{ productions: Production[] }>("/api/productions");
      setProductions(result.productions.filter((p) => p.approved || p.status === "completed" || p.status === "awaiting_approval"));
      setAuthStatus(null); setError("");
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

  async function publish(production: Production) {
    const targets = selected[production.id] ?? production.publish.filter((entry) => entry.status !== "published").map((entry) => entry.platform);
    if (targets.length === 0) return;
    if (!window.confirm(ar ? `نشر الحلقة على ${targets.length} منصة؟` : `Publish this episode to ${targets.length} platform(s)?`)) return;
    setBusy(production.id); setError("");
    try {
      await api(`/api/productions/${production.id}/publish`, { method: "POST", body: JSON.stringify({ platforms: targets }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Publishing failed.");
    } finally { setBusy(null); }
  }

  return <main className="wrap">
    <section className="dashboard-hero"><div><div className="eyebrow">{ar ? "من حلقة إلى جمهور" : "Episode to audience"}</div><h1>{ar ? "مركز النشر" : "Publishing center"}</h1><p>{ar ? "اختر المنصات، راجع حالة كل تكامل، وانشر فقط بعد اعتماد الفيديو النهائي." : "Choose platforms, inspect each connection, and publish only after the final video is approved."}</p></div></section>
    {authStatus !== null ? <AccessGate status={authStatus} onUnlocked={() => void load()} /> : <>
      {error && <p className="warn">{error}</p>}
      {productions.length === 0 ? <div className="card"><h2>{ar ? "لا يوجد شيء جاهز للنشر" : "Nothing ready to publish"}</h2><p className="dim">{ar ? "اعتمد فيديو نهائي أولًا ثم سيظهر هنا." : "Approve a final video first and it will appear here."}</p></div> : productions.map((p) => <section key={p.id} className="card" style={{ marginBottom: 18 }}>
        <div className="dashboard-section-head"><div><span className="eyebrow">{p.projectName ?? "MiniBites"}</span><h2>{p.episodeTitle ?? p.dish}</h2><p className="dim">{p.publishTitle ?? p.dish}</p></div><StatusBadge status={p.status} /></div>
        <div className="dashboard-grid" style={{ alignItems: "start" }}>
          <div>
            <p>{p.publishCaption}</p>
            <p className="dim">{p.publishHashtags?.join(" ")}</p>
            {p.finalVideoUrl && <video src={p.finalVideoUrl} controls playsInline style={{ width: "100%", maxHeight: 420, borderRadius: 16 }} />}
          </div>
          <div className="readiness-list">{platforms.map((platform) => {
            const state = p.publish.find((entry) => entry.platform === platform.id);
            const checked = (selected[p.id] ?? []).includes(platform.id);
            return <label key={platform.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={checked} disabled={state?.status === "published" || !p.approved} onChange={() => toggle(p.id, platform.id)} />
              <span><strong>{platform.label}</strong><small>{state?.requiredAction ?? (state?.status === "published" ? (ar ? "تم النشر" : "Published") : (ar ? "جاهز عند توفر التكامل" : "Ready when integration is connected"))}</small></span>
              <StatusBadge status={state?.status ?? "not_connected"} />
            </label>;
          })}</div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="button" onClick={() => void publish(p)} disabled={!p.approved || busy === p.id}>{busy === p.id ? (ar ? "جارٍ النشر…" : "Publishing…") : (ar ? "نشر على المختار" : "Publish selected")}</button>
        </div>
      </section>)}
    </>}
  </main>;
}
