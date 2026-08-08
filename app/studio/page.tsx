"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import type { CreativeStyle, DurationPreset, Production, StoryMode } from "@/lib/types";

const SUGGESTIONS = ["Mini Saudi Kabsa", "Mini Pizza", "Tiny Kunafa", "Mini Sushi", "Small Pancakes", "Arabic Coffee"];
const STYLES: Array<{ id: CreativeStyle; label: string; icon: string }> = [
  { id: "cinematic", label: "Cinematic", icon: "🎬" }, { id: "cozy", label: "Cozy Kitchen", icon: "☀️" },
  { id: "traditional", label: "Traditional", icon: "🫖" }, { id: "luxury", label: "Luxury Food", icon: "✨" },
  { id: "street", label: "Street Food", icon: "🔥" }, { id: "asmr", label: "ASMR", icon: "🎧" },
];

interface ProviderOption {
  id: "fal" | "wan" | "mock" | "google";
  name: string;
  configured: boolean;
  isMock: boolean;
  isDefault: boolean;
}
const ACTIVE = ["planning", "generating", "review", "assembling"];

export default function StudioPage() {
  const [dish, setDish] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<CreativeStyle>("cinematic");
  const [storyMode, setStoryMode] = useState<StoryMode>("satisfying");
  const [durationPreset, setDurationPreset] = useState<DurationPreset>("standard");
  const [provider, setProvider] = useState<string>("auto");
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [production, setProduction] = useState<Production | null>(null);
  const [error, setError] = useState("");
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createRequestId = useRef<string | null>(null);

  const poll = useCallback(async (id: string) => {
    try {
      const { production: p } = await api<{ production: Production }>(`/api/productions/${id}?advance=1`);
      setProduction(p);
      if (ACTIVE.includes(p.status)) {
        timer.current = setTimeout(() => poll(id), 4000);
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503)) setAuthStatus(e.status);
      else if (e instanceof ApiError && e.status === 404) {
        // The stored production no longer exists (expired or never persisted).
        // Forget it and return to a clean studio instead of erroring forever.
        window.localStorage.removeItem("mb_last_production");
        setProduction(null);
        setError("");
      } else setError(e instanceof Error ? e.message : "Polling failed.");
    }
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.providers) && setProviderOptions(d.providers))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // Resume an in-flight production after refresh (real persistence).
    const id = typeof window !== "undefined" ? window.localStorage.getItem("mb_last_production") : null;
    if (id) poll(id);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [poll]);

  async function startProduction() {
    setBusy(true);
    setError("");
    try {
      createRequestId.current ??= crypto.randomUUID();
      const { production: p } = await api<{ production: Production }>("/api/productions", {
        method: "POST",
        body: JSON.stringify({ dish, description, language, style, storyMode, durationPreset, provider, clientRequestId: createRequestId.current }),
      });
      createRequestId.current = null;
      setProduction(p);
      setAuthStatus(null);
      window.localStorage.setItem("mb_last_production", p.id);
      timer.current = setTimeout(() => poll(p.id), 2500);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503)) setAuthStatus(e.status);
      else setError(e instanceof Error ? e.message : "Could not start production.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!production) return;
    try {
      const { production: p } = await api<{ production: Production }>(`/api/productions/${production.id}`, { method: "DELETE" });
      setProduction(p);
      if (timer.current) clearTimeout(timer.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed.");
    }
  }

  async function retry(shotId: string) {
    if (!production) return;
    try {
      const { production: p } = await api<{ production: Production }>(`/api/productions/${production.id}/retry`, {
        method: "POST",
        body: JSON.stringify({ shotId }),
      });
      setProduction(p);
      timer.current = setTimeout(() => poll(p.id), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed.");
    }
  }

  async function generate() {
    if (!production) return;
    if (!production.providerIsMock && !window.confirm(`Generate ${production.shots.length} video shots now? This uses paid video-generation credit.`)) return;
    setBusy(true);
    setError("");
    try {
      const { production: updated } = await api<{ production: Production }>(`/api/productions/${production.id}/generate`, { method: "POST", body: "{}" });
      setProduction(updated);
      timer.current = setTimeout(() => poll(updated.id), 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation could not start.");
    } finally { setBusy(false); }
  }

  async function savePlan(shots: Production["shots"]) {
    if (!production) return;
    setError("");
    try {
      const { production: updated } = await api<{ production: Production }>(`/api/productions/${production.id}`, {
        method: "PATCH",
        body: JSON.stringify({ shots: shots.map(({ id, seconds, action, camera, sound }) => ({ id, seconds, action, camera, sound })) }),
      });
      setProduction(updated);
    } catch (e) { setError(e instanceof Error ? e.message : "The shot plan could not be saved."); }
  }

  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 8 }}>
        <div className="eyebrow">MiniBites Studio</div>
        <h1>{language === "ar" ? "ماذا تريد أن تطبخ اليوم؟" : "What do you want to cook today?"}</h1>
        <p className="lede">{language === "ar" ? "أدخل فكرتك، واختر الأسلوب، وسنحوّلها إلى قصة قصيرة." : "Bring the idea. MiniBites turns it into a tiny food story."}</p>
      </section>

      {authStatus !== null ? (
        <AccessGate status={authStatus} onUnlocked={() => { setAuthStatus(null); if (production) poll(production.id); }} />
      ) : (
        <div className="ticket creator-form" dir={language === "ar" ? "rtl" : "ltr"}>
          <div className="ticket-head">{language === "ar" ? "فيديو جديد" : "New video"}</div>
          <div className="dish-row creator-primary">
            <input
              type="text"
              placeholder={language === "ar" ? "مثال: كبسة سعودية مصغرة" : "Dish or idea, e.g. Mini Saudi Kabsa"}
              value={dish}
              maxLength={60}
              onChange={(e) => setDish(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && dish.trim().length >= 2 && startProduction()}
              aria-label="Dish name"
            />
          </div>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setDish(s)}>{s}</button>
            ))}
          </div>
          <textarea value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder={language === "ar" ? "اتجاه إبداعي اختياري…" : "Optional creative direction…"} aria-label="Creative direction" />
          <div className="form-section"><strong>{language === "ar" ? "اختر الأسلوب" : "Choose a style"}</strong><div className="style-grid">{STYLES.map((item) => <button type="button" className={style === item.id ? "style-card selected" : "style-card"} key={item.id} onClick={() => setStyle(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div></div>
          <div className="creator-options">
            <label>{language === "ar" ? "نوع القصة" : "Story"}<select value={storyMode} onChange={(e) => setStoryMode(e.target.value as StoryMode)}><option value="satisfying">Satisfying</option><option value="cinematic">Cinematic</option><option value="educational">Educational</option><option value="asmr">ASMR</option><option value="funny">Funny</option><option value="luxury">Luxury</option><option value="viral_hook">Hook Ideas</option></select></label>
            <label>{language === "ar" ? "المدة" : "Length"}<select value={durationPreset} onChange={(e) => setDurationPreset(e.target.value as DurationPreset)}><option value="quick">Quick</option><option value="standard">Standard</option><option value="extended">Extended</option></select></label>
            <label>{language === "ar" ? "اللغة" : "Language"}<select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "ar")}><option value="en">English</option><option value="ar">العربية</option></select></label>
          </div>
          <details className="advanced"><summary>Advanced</summary><label>Video engine<select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Video provider"><option value="auto">MiniBites recommended</option>{providerOptions.map((o) => <option key={o.id} value={o.id} disabled={!o.configured}>{o.isMock ? `${o.name} — test only` : o.name}{o.configured ? "" : " (not configured)"}</option>)}</select></label></details>
          <button className="create-video" onClick={startProduction} disabled={busy || dish.trim().length < 2}>{busy ? (language === "ar" ? "جارٍ التحضير…" : "Preparing…") : (language === "ar" ? "إنشاء فيديو" : "Create Video")}</button>
        </div>
      )}

      {error && <p className="warn" style={{ marginTop: 14 }}>{error}</p>}

      {production && (
        <>
          <div className="ruler" aria-hidden />
          <ProductionView production={production} onCancel={cancel} onRetry={retry} onGenerate={generate} onPlanChange={savePlan} busy={busy} />
        </>
      )}
    </main>
  );
}

function ProductionView({ production: p, onCancel, onRetry, onGenerate, onPlanChange, busy }: { production: Production; onCancel: () => void; onRetry: (shotId: string) => void; onGenerate: () => void; onPlanChange: (shots: Production["shots"]) => Promise<void>; busy: boolean }) {
  const active = ACTIVE.includes(p.status);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState("");
  const [newShotAction, setNewShotAction] = useState("");
  const completedShots = p.shots.filter((shot) => shot.status === "completed").length;
  const progressLabel = p.status === "planning" ? "Preparing your shots" : p.status === "generating" ? `Creating shot ${Math.min(completedShots + 1, p.shots.length || 1)} of ${p.shots.length || "…"}` : p.status === "assembling" ? "Preparing the final video" : p.status === "awaiting_approval" ? "Ready for review" : p.status.replaceAll("_", " ");
  function beginEdit(index: number) {
    const current = p.shots[index];
    setEditingShotId(current.id);
    setDraftAction(current.action);
  }
  async function saveShot(index: number) {
    const action = draftAction.trim();
    if (!action) return;
    const next = p.shots.map((shot, i) => i === index ? { ...shot, action } : shot);
    await onPlanChange(next);
    setEditingShotId(null);
  }
  async function moveShot(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= p.shots.length) return;
    const next = [...p.shots];
    [next[index], next[target]] = [next[target], next[index]];
    await onPlanChange(next);
  }
  async function deleteShot(index: number) {
    if (p.shots.length <= 3 || !window.confirm("Remove this shot from the plan?")) return;
    await onPlanChange(p.shots.filter((_, i) => i !== index));
  }
  async function addShot() {
    const action = newShotAction.trim();
    if (!action || p.shots.length >= 9) return;
    if (!action) return;
    await onPlanChange([...p.shots, { ...p.shots[p.shots.length - 1], id: `shot_new_${Date.now().toString(36)}`, action, status: "planned", attempts: 0, providerJobId: undefined, videoUrl: undefined, error: undefined }]);
    setNewShotAction("");
  }
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2>{p.dish}</h2>
        <StatusBadge status={p.status} />
        {active && <button className="danger" onClick={onCancel}>Cancel production</button>}
      </div>
      <p className="progress-copy">{progressLabel}</p>
      {p.providerIsMock && (
        <p className="warn">MOCK provider active — this run is for testing only and produces no real video.</p>
      )}
      {p.error && <p className="warn">{p.error}</p>}
      {p.status === "planned" && <div className="note plan-ready"><strong>Your shot plan is ready.</strong><span>Review the shots below. Nothing paid starts until you confirm.</span><button onClick={onGenerate} disabled={busy}>{busy ? "Starting…" : p.providerIsMock ? "Run safe test" : `Generate ${p.shots.length} shots`}</button></div>}

      <div className="grid production-grid" style={{ marginTop: 14 }}>
        <details className="card advanced-panel">
          <summary>Production details</summary>
          <p className="dim">{p.provider} · {p.planSource === "llm" ? "AI plan" : "Reliable template plan"} · {new Date(p.createdAt).toLocaleString()}</p>
          <p className="mono dim">{p.id}</p>
          <h3>Workflow</h3>
          {p.agents.map((a) => (
            <div key={a.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: "0.92rem" }}>{a.name}</strong>
                <StatusBadge status={a.status} />
              </div>
              {a.note && <p className="dim" style={{ margin: "4px 0 0" }}>{a.note}</p>}
              {a.logs.length > 0 && (
                <div className="logbox mono" style={{ marginTop: 6 }}>
                  {a.logs.slice(-6).map((l, i) => <div key={i}>{l}</div>)}
                </div>
              )}
            </div>
          ))}
        </details>

        <div className="card">
          <h3>Shots</h3>
          {p.shots.length === 0 ? (
            <p className="dim">The shot list appears once planning completes.</p>
          ) : (
            <div className="shots">
              {p.shots.map((s, shotIndex) => (
                <div className="shot" key={s.id}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="mono" style={{ color: "var(--yolk)" }}>SHOT {String(s.index).padStart(2, "0")} · {s.seconds}s</span>
                    <StatusBadge status={s.status} />
                  </div>
                  {editingShotId === s.id ? <div className="inline-shot-editor"><label htmlFor={`edit-${s.id}`}>Shot description</label><textarea id={`edit-${s.id}`} value={draftAction} maxLength={400} onChange={(e) => setDraftAction(e.target.value)} /><div><button onClick={() => saveShot(shotIndex)} disabled={!draftAction.trim()}>Save</button><button className="ghost" onClick={() => setEditingShotId(null)}>Cancel</button></div></div> : <p>{s.action}</p>}
                  <p className="dim mono">{s.camera}</p>
                  {p.status === "planned" && editingShotId !== s.id && <div className="shot-actions"><button className="ghost" onClick={() => beginEdit(shotIndex)}>Edit</button><button className="ghost" aria-label={`Move shot ${shotIndex + 1} up`} disabled={shotIndex === 0} onClick={() => moveShot(shotIndex, -1)}>↑</button><button className="ghost" aria-label={`Move shot ${shotIndex + 1} down`} disabled={shotIndex === p.shots.length - 1} onClick={() => moveShot(shotIndex, 1)}>↓</button><button className="danger" onClick={() => deleteShot(shotIndex)}>Delete</button></div>}
                  {typeof s.queuePosition === "number" && <p className="dim">Queue position: {s.queuePosition}</p>}
                  {s.error && <p className="dim" style={{ color: "var(--coral)" }}>{s.error}</p>}
                  {s.videoUrl && !p.providerIsMock && (
                    <a href={s.videoUrl} target="_blank" rel="noreferrer"><button className="ghost" style={{ padding: "6px 12px" }}>Preview clip</button></a>
                  )}
                  {(s.status === "failed" || s.status === "rejected") && (
                    <button className="ghost" style={{ padding: "6px 12px", marginTop: 6 }} onClick={() => onRetry(s.id)}>
                      Retry shot ({s.attempts}/3)
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {p.status === "planned" && p.shots.length < 9 && <div className="add-shot"><label htmlFor="new-shot">Add another shot</label><div><input id="new-shot" value={newShotAction} maxLength={400} onChange={(e) => setNewShotAction(e.target.value)} placeholder="Describe what happens…" /><button className="ghost" disabled={!newShotAction.trim()} onClick={addShot}>+ Add shot</button></div></div>}
        </div>
      </div>

      {p.status === "awaiting_approval" && (
        <div className="note" style={{ marginTop: 14 }}>
          Generation finished. Review the clips above, then approve and publish from the <a href="/library" style={{ color: "var(--yolk)" }}>Content Library</a>.
        </div>
      )}
    </section>
  );
}
