"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import type { Production } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";

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
                    </>}
                  </>
                )}
                {p.status === "awaiting_approval" && !p.providerIsMock && (
                  <><button onClick={() => act(p.id, "/approve", { action: "approve", note: window.prompt("Optional approval note") ?? "" })}>Approve</button><button className="ghost" onClick={() => { const note = window.prompt("What should change?"); if (note !== null) act(p.id, "/approve", { action: "request_changes", note }); }}>Request changes</button></>
                )}
                {(p.status === "approved") && (
                  <button onClick={() => act(p.id, "/publish")}>{ar ? "النشر على YouTube" : "Publish to YouTube"}</button>
                )}
                {p.finalVideoUrl && !p.providerIsMock && <>
                  <a className="action-link platform-button tiktok" href="https://www.tiktok.com/upload" target="_blank" rel="noreferrer">Open TikTok</a>
                  <a className="action-link platform-button instagram" href="https://www.instagram.com/" target="_blank" rel="noreferrer">Open Instagram</a>
                </>}
                {!p.archivedAt && !["planning", "generating", "assembling"].includes(p.status) && <button className="danger" onClick={() => window.confirm("Archive this project? Its media and history will remain stored.") && act(p.id, "/archive")}>Archive</button>}
              </div>
              {p.mediaStorage?.status !== "archived" && p.finalVideoUrl && !p.providerIsMock && <p className="warn" style={{ marginTop: 10 }}>Long-term archive not connected. Download a backup or connect Vercel Blob.</p>}
              <div style={{ marginTop: 10 }}>
                {p.publish.map((pub) => (
                  <div key={pub.platform} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0" }}>
                    <span className="mono" style={{ minWidth: 70 }}>{pub.platform}</span>
                    <StatusBadge status={pub.status} />
                    {pub.url && <a className="mono" href={pub.url} target="_blank" rel="noreferrer" style={{ color: "var(--yolk)" }}>{pub.url}</a>}
                    {pub.requiredAction && pub.status !== "published" && <span className="dim" style={{ fontSize: "0.82rem" }}>{pub.requiredAction}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
