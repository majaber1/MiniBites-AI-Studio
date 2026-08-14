"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import type { Production, PublishPlatform } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";

const PLATFORM_META: Record<PublishPlatform, { label: string; icon: string; manualUrl: string }> = {
  youtube: { label: "YouTube Shorts", icon: "▶", manualUrl: "https://studio.youtube.com/" },
  tiktok: { label: "TikTok", icon: "♪", manualUrl: "https://www.tiktok.com/upload" },
  instagram: { label: "Instagram Reels", icon: "◎", manualUrl: "https://www.instagram.com/" },
  x: { label: "X / Twitter", icon: "𝕏", manualUrl: "https://x.com/compose/post" },
  snapchat: { label: "Snapchat", icon: "◉", manualUrl: "https://my.snapchat.com/" },
};

function displayDish(dish: string) {
  return /^(mini|tiny|small)\b/i.test(dish.trim()) ? dish.trim() : `Mini ${dish.trim()}`;
}

export default function LibraryPage() {
  const { locale } = useLocale(); const ar = locale === "ar";
  const [productions, setProductions] = useState<Production[] | null>(null);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");

  async function copyCaption(p: Production) {
    const text = `${p.publishCaption ?? `Tiny ${p.dish}, made for real.`}\n\n${(p.publishHashtags ?? ["#miniaturecooking", "#tinyfood", "#asmr"]).join(" ")}`;
    await navigator.clipboard.writeText(text);
    setNotice("Caption and hashtags copied. Your social pack is ready.");
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setNotice(`${label} copied.`);
  }

  function openProject(id: string) {
    window.localStorage.setItem("mb_last_production", id);
    window.location.href = "/studio";
  }

  async function duplicateProject(p: Production) {
    if (!window.confirm(`Duplicate “${p.dish}” as a fresh plan? Generated videos will not be copied.`)) return;
    try {
      const { production: duplicate } = await api<{ production: Production }>(`/api/productions/${p.id}/duplicate`, { method: "POST", body: "{}" });
      setNotice("Fresh editable copy created. No paid media was duplicated.");
      await load();
      openProject(duplicate.id);
    } catch (e) { setError(e instanceof Error ? e.message : "The project could not be duplicated."); }
  }

  const load = useCallback(async () => {
    try {
      const { productions: list } = await api<{ productions: Production[] }>("/api/productions");
      setProductions(list);
      setAuthStatus(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503)) setAuthStatus(e.status);
      else setError(e instanceof Error ? e.message : "Could not load the library.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = (productions ?? []).filter((p) => {
    if (!p.dish.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filter === "archived") return Boolean(p.archivedAt);
    if (p.archivedAt) return false;
    if (filter === "active") return true;
    if (filter === "review") return p.status === "review" || p.status === "awaiting_approval";
    return p.status === filter;
  });

  async function act(id: string, path: string, body?: unknown) {
    setError("");
    setNotice("");
    try {
      const res = await api<{ production: Production; note?: string }>(`/api/productions/${id}${path}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : "{}",
      });
      if (res.note) setNotice(res.note);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
  }

  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 8 }}>
        <div className="eyebrow">{ar ? "أعمالك المكتملة" : "Your finished work"}</div>
        <h1>{ar ? "مكتبة النشر" : "Publish Library"}</h1>
        <p className="lede">{ar ? "راجع مرة، ثم انشر أو خذ حزمة النشر الجاهزة إلى أي منصة." : "Review once, then publish or take the ready-to-post pack anywhere."}</p>
      </section>

      {authStatus !== null && <AccessGate status={authStatus} onUnlocked={load} />}
      {error && <p className="warn">{error}</p>}
      {notice && <p className="note">{notice}</p>}

      {productions && productions.length > 0 && <div className="library-tools card">
        <label>{ar ? "ابحث عن مشروع" : "Find a project"}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ar ? "ابحث في الأطباق…" : "Search dishes…"} /></label>
        <label>{ar ? "الحالة" : "Status"}<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">{ar ? "كل النشط" : "All active"}</option><option value="planned">{ar ? "خطط مسودة" : "Draft plans"}</option><option value="generating">{ar ? "قيد التوليد" : "Generating"}</option><option value="review">{ar ? "تحتاج مراجعة" : "Needs review"}</option><option value="approved">{ar ? "معتمدة" : "Approved"}</option><option value="completed">{ar ? "منشورة" : "Published"}</option><option value="failed">{ar ? "فشلت" : "Failed"}</option><option value="archived">{ar ? "مؤرشفة" : "Archived"}</option></select></label>
      </div>}

      {productions && productions.length === 0 && (
        <div className="card">
          <h3>{ar ? "لا توجد إنتاجات بعد" : "No productions yet"}</h3>
          <p className="dim">
            Start your first production in the Creator Studio. (The old manually-assembled Omelette demo from
            v1 was removed — it was still images with camera movement, not a real generated video.)
          </p>
        </div>
      )}

      {productions && productions.length > 0 && visible.length === 0 && <div className="card"><p className="dim">{ar ? "لا توجد مشاريع تطابق البحث والتصفية." : "No projects match this search and filter."}</p></div>}

      {visible.length > 0 && (
        <div className="grid">
          {visible.map((p) => (
            <div className="card" key={p.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <h3 style={{ marginRight: "auto" }}>{displayDish(p.dish)}</h3>
                <StatusBadge status={p.status} />
                {p.providerIsMock && <span className="badge b-fail">mock — not real</span>}
              </div>
              {p.finalVideoUrl && !p.providerIsMock && <video className="library-preview" src={p.finalVideoUrl} poster={p.thumbnailUrl} controls preload="metadata" playsInline />}
              <p className="dim">
                {new Date(p.createdAt).toLocaleString()}
                {p.durationSeconds ? ` · ~${p.durationSeconds}s` : ""}{p.resolution ? ` · ${p.resolution}` : ""}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button className="ghost" onClick={() => openProject(p.id)}>{ar ? "فتح" : "Open"}</button>
                <button className="ghost" onClick={() => duplicateProject(p)}>{ar ? "تكرار" : "Duplicate"}</button>
                {p.finalVideoUrl && !p.providerIsMock && (
                  <>
                    <a className="action-link ghost" href={p.finalVideoUrl} target="_blank" rel="noreferrer">{ar ? "معاينة" : "Preview"}</a>
                    <a className="action-link ghost" href={p.finalVideoUrl} download>{ar ? "تنزيل MP4" : "Download MP4"}</a>
                    <button className="ghost" onClick={() => copyCaption(p)}>{ar ? "نسخ النص" : "Copy caption"}</button>
                    {p.socialPack && <>
                      <button className="ghost" onClick={() => copyText("TikTok caption", p.socialPack!.tiktokCaption)}>TikTok copy</button>
                      <button className="ghost" onClick={() => copyText("Instagram caption", p.socialPack!.instagramCaption)}>Instagram copy</button>
                      <button className="ghost" onClick={() => copyText("YouTube title and description", `${p.socialPack!.youtubeTitle}\n\n${p.socialPack!.youtubeDescription}`)}>YouTube copy</button>
                      {p.socialPack.xTweet && <button className="ghost" onClick={() => copyText("X/Twitter post", p.socialPack!.xTweet)}>X copy</button>}
                      {p.socialPack.snapchatCaption && <button className="ghost" onClick={() => copyText("Snapchat caption", p.socialPack!.snapchatCaption)}>Snapchat copy</button>}
                    </>}
                  </>
                )}
                {p.status === "awaiting_approval" && !p.providerIsMock && (
                  <><button onClick={() => act(p.id, "/approve", { action: "approve", note: window.prompt("Optional approval note") ?? "" })}>Approve</button><button className="ghost" onClick={() => { const note = window.prompt("What should change?"); if (note !== null) act(p.id, "/approve", { action: "request_changes", note }); }}>Request changes</button></>
                )}
                {(p.status === "approved") && (
                  <PublishSelector productionId={p.id} publish={p.publish} onPublish={async (platforms) => { await act(p.id, "/publish", { platforms }); }} ar={ar} />
                )}
                {p.finalVideoUrl && !p.providerIsMock && (
                  <details className="manual-post-links">
                    <summary className="ghost" style={{ cursor: "pointer", fontSize: "0.85rem" }}>{ar ? "نشر يدوي" : "Post manually"}</summary>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {(Object.entries(PLATFORM_META) as Array<[PublishPlatform, typeof PLATFORM_META[PublishPlatform]]>).map(([key, meta]) => (
                        <a key={key} className="action-link platform-button ghost compact" href={meta.manualUrl} target="_blank" rel="noreferrer">{meta.icon} {meta.label}</a>
                      ))}
                    </div>
                  </details>
                )}
                {!p.archivedAt && !["planning", "generating", "assembling"].includes(p.status) && <button className="danger" onClick={() => window.confirm("Archive this project? Its media and history will remain stored.") && act(p.id, "/archive")}>Archive</button>}
              </div>
              {p.mediaStorage?.status !== "archived" && p.finalVideoUrl && !p.providerIsMock && <p className="warn" style={{ marginTop: 10 }}>Long-term archive not connected. Download a backup or connect Vercel Blob.</p>}
              <div style={{ marginTop: 10 }}>
                {p.publish.map((pub) => {
                  const meta = PLATFORM_META[pub.platform] ?? { label: pub.platform, icon: "•" };
                  return (
                    <div key={pub.platform} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0", flexWrap: "wrap" }}>
                      <span className="mono" style={{ minWidth: 90 }}>{meta.icon} {meta.label}</span>
                      <StatusBadge status={pub.status} />
                      {pub.url && <a className="mono" href={pub.url} target="_blank" rel="noreferrer" style={{ color: "var(--yolk)" }}>{pub.url}</a>}
                      {pub.requiredAction && pub.status !== "published" && pub.status !== "processing" && <span className="dim" style={{ fontSize: "0.82rem" }}>{pub.requiredAction}</span>}
                      {pub.status === "processing" && <span className="dim" style={{ fontSize: "0.82rem" }}>Processing on the platform...</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function PublishSelector({ productionId, publish, onPublish, ar }: { productionId: string; publish: Production["publish"]; onPublish: (platforms: PublishPlatform[]) => Promise<void>; ar: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<PublishPlatform>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(platform: PublishPlatform) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  async function doPublish() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await onPublish(Array.from(selected));
      setOpen(false);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)}>{ar ? "نشر الفيديو" : "Publish Video"}</button>;
  }

  return (
    <div className="publish-selector card" style={{ padding: 16, marginTop: 8, width: "100%" }}>
      <strong style={{ display: "block", marginBottom: 8 }}>{ar ? "اختر منصات النشر" : "Select platforms to publish"}</strong>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {publish.map((entry) => {
          const meta = PLATFORM_META[entry.platform];
          const disabled = entry.status === "published" || entry.status === "processing";
          return (
            <label key={entry.platform} style={{ display: "flex", alignItems: "center", gap: 8, opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }}>
              <input
                type="checkbox"
                checked={disabled || selected.has(entry.platform)}
                disabled={disabled}
                onChange={() => toggle(entry.platform)}
              />
              <span>{meta.icon} {meta.label}</span>
              {entry.status === "published" && <span className="badge b-done" style={{ fontSize: "0.75rem" }}>Published</span>}
              {entry.status === "processing" && <span className="badge b-run" style={{ fontSize: "0.75rem" }}>Processing</span>}
              {entry.status === "not_connected" && <span className="dim" style={{ fontSize: "0.75rem" }}>{ar ? "غير متصل" : "Not connected"}</span>}
            </label>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={doPublish} disabled={busy || selected.size === 0}>{busy ? (ar ? "جارٍ النشر..." : "Publishing...") : (ar ? `نشر إلى ${selected.size} منصة` : `Publish to ${selected.size} platform${selected.size !== 1 ? "s" : ""}`)}</button>
        <button className="ghost" onClick={() => { setOpen(false); setSelected(new Set()); }}>{ar ? "إلغاء" : "Cancel"}</button>
      </div>
    </div>
  );
}
