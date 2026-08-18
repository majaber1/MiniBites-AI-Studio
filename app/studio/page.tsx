"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import type { CreativeStyle, DurationPreset, Production, StoryMode, StudioProject } from "@/lib/types";
import { getCreativeTemplate } from "@/lib/templates";
import { useLocale } from "@/components/LocaleProvider";

const FOOD_SUGGESTIONS = ["Mini Saudi Kabsa", "Mini Pizza", "Tiny Kunafa", "Mini Sushi", "Small Pancakes", "Arabic Coffee"];
const IYAL_SUGGESTIONS = ["ذيبان أول مرة يجرب الكبسة", "فهيد في عزيمة منسف", "ذيبان وفهيد في الكشتة", "شراء سيارة مستعملة", "منفوشة تقفل النقاش", "السعودي أول مرة بعمان"];
const SERIES_SUGGESTIONS = ["First episode", "Unexpected visitor", "Road trip", "Dinner invitation", "A friendly challenge", "The misunderstanding"];
const STYLES: Array<{ id: CreativeStyle; label: string; icon: string }> = [
  { id: "cinematic", label: "Cinematic", icon: "🎬" }, { id: "cozy", label: "Warm / Cozy", icon: "☀️" },
  { id: "traditional", label: "Traditional", icon: "🫖" }, { id: "luxury", label: "Premium", icon: "✨" },
  { id: "street", label: "Street / Energetic", icon: "🔥" }, { id: "playful", label: "Playful", icon: "🐑" },
];

interface ProviderOption {
  id: "fal" | "wan" | "mock" | "google";
  name: string;
  configured: boolean;
  isMock: boolean;
  isDefault: boolean;
  hint?: string;
}
const ACTIVE = ["planning", "generating", "assembling"];

export default function StudioPage() {
  const { locale, setLocale } = useLocale();
  const [subject, setSubject] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<CreativeStyle>("cinematic");
  const [storyMode, setStoryMode] = useState<StoryMode>("satisfying");
  const [durationPreset, setDurationPreset] = useState<DurationPreset>("standard");
  const [provider, setProvider] = useState<string>("auto");
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [projectId, setProjectId] = useState("minibites");
  const [production, setProduction] = useState<Production | null>(null);
  const [error, setError] = useState("");
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createRequestId = useRef<string | null>(null);

  const currentProject = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);
  const isFood = (currentProject?.kind ?? "mini_food") === "mini_food";
  const suggestions = currentProject?.id === "iyal-al-halal" ? IYAL_SUGGESTIONS : isFood ? FOOD_SUGGESTIONS : SERIES_SUGGESTIONS;

  useEffect(() => setLanguage(locale), [locale]);
  useEffect(() => {
    if (currentProject?.kind === "character_series") {
      setStoryMode("funny");
      setStyle((value) => value === "asmr" || value === "macro" || value === "workshop" ? "playful" : value);
    }
  }, [currentProject?.kind]);

  const poll = useCallback(async (id: string) => {
    try {
      const { production: p } = await api<{ production: Production }>(`/api/productions/${id}?advance=1`);
      setProduction(p);
      if (ACTIVE.includes(p.status)) timer.current = setTimeout(() => poll(id), 4000);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503)) setAuthStatus(e.status);
      else if (e instanceof ApiError && e.status === 404) {
        window.localStorage.removeItem("ks_last_production");
        window.localStorage.removeItem("mb_last_production");
        setProduction(null); setError("");
      } else setError(e instanceof Error ? e.message : "Polling failed.");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedProject = params.get("project");
    const template = getCreativeTemplate(params.get("template"));
    if (template) {
      setSubject(template.dish); setDescription(template.description); setStyle(template.style);
      setStoryMode(template.storyMode); setDurationPreset(template.durationPreset);
    }
    Promise.all([
      fetch("/api/status").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(([statusData, projectData]) => {
      if (Array.isArray(statusData.providers)) setProviderOptions(statusData.providers);
      if (Array.isArray(projectData.projects)) {
        setProjects(projectData.projects);
        if (requestedProject && projectData.projects.some((p: StudioProject) => p.id === requestedProject)) setProjectId(requestedProject);
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const id = typeof window !== "undefined" ? window.localStorage.getItem("ks_last_production") ?? window.localStorage.getItem("mb_last_production") : null;
    if (id) poll(id);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [poll]);

  async function startProduction() {
    setBusy(true); setError("");
    try {
      createRequestId.current ??= crypto.randomUUID();
      const { production: p } = await api<{ production: Production }>("/api/productions", {
        method: "POST",
        body: JSON.stringify({ projectId, title: subject, dish: subject, description, language, style, storyMode, durationPreset, provider, clientRequestId: createRequestId.current }),
      });
      createRequestId.current = null; setProduction(p); setAuthStatus(null);
      window.localStorage.setItem("ks_last_production", p.id);
      window.localStorage.setItem("mb_last_production", p.id);
      timer.current = setTimeout(() => poll(p.id), 2500);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503)) setAuthStatus(e.status);
      else setError(e instanceof Error ? e.message : "Could not start production.");
    } finally { setBusy(false); }
  }

  async function cancel() {
    if (!production) return;
    try {
      const { production: p } = await api<{ production: Production }>(`/api/productions/${production.id}`, { method: "DELETE" });
      setProduction(p); if (timer.current) clearTimeout(timer.current);
    } catch (e) { setError(e instanceof Error ? e.message : "Cancel failed."); }
  }

  async function retry(shotId: string) {
    if (!production) return;
    if (!production.providerIsMock && !window.confirm("Retry this failed clip? A new paid generation may be submitted; completed clips stay safe.")) return;
    try {
      const { production: p } = await api<{ production: Production }>(`/api/productions/${production.id}/retry`, { method: "POST", body: JSON.stringify({ shotId }) });
      setProduction(p); timer.current = setTimeout(() => poll(p.id), 2500);
    } catch (e) { setError(e instanceof Error ? e.message : "Retry failed."); }
  }

  async function reviewShot(shotId: string, action: "accept" | "reject" | "regenerate") {
    if (!production) return;
    if (action === "regenerate" && !window.confirm("Create a new version of this clip? This uses paid generation credit and keeps the current version in history.")) return;
    setError("");
    try {
      const { production: updated } = await api<{ production: Production }>(`/api/productions/${production.id}/shots`, { method: "POST", body: JSON.stringify({ shotId, action, confirmCost: action === "regenerate" }) });
      setProduction(updated); if (action === "regenerate") timer.current = setTimeout(() => poll(updated.id), 500);
    } catch (e) { setError(e instanceof Error ? e.message : "The clip could not be updated."); }
  }

  async function assemble() {
    if (!production) return;
    setBusy(true); setError("");
    try {
      const { production: updated } = await api<{ production: Production }>(`/api/productions/${production.id}/assemble`, { method: "POST", body: "{}" });
      setProduction(updated); timer.current = setTimeout(() => poll(updated.id), 500);
    } catch (e) { setError(e instanceof Error ? e.message : "The final video could not be started."); }
    finally { setBusy(false); }
  }

  async function generate() {
    if (!production) return;
    if (!production.providerIsMock && !window.confirm(`Generate ${production.shots.length} video shots now with ${production.provider}? This uses paid video-generation credit.`)) return;
    setBusy(true); setError("");
    try {
      const { production: updated } = await api<{ production: Production }>(`/api/productions/${production.id}/generate`, { method: "POST", body: "{}" });
      setProduction(updated); timer.current = setTimeout(() => poll(updated.id), 500);
    } catch (e) { setError(e instanceof Error ? e.message : "Generation could not start."); }
    finally { setBusy(false); }
  }

  async function savePlan(shots: Production["shots"]) {
    if (!production) return;
    setError("");
    try {
      const { production: updated } = await api<{ production: Production }>(`/api/productions/${production.id}`, {
        method: "PATCH", body: JSON.stringify({ shots: shots.map(({ id, seconds, action, camera, sound }) => ({ id, seconds, action, camera, sound })) }),
      });
      setProduction(updated);
    } catch (e) { setError(e instanceof Error ? e.message : "The shot plan could not be saved."); }
  }

  return <main className="wrap">
    <section className="hero" style={{ paddingBottom: 8 }}>
      <div className="eyebrow">Kiswani AI Studio</div>
      <h1>{language === "ar" ? "ماذا سنصنع اليوم؟" : "What are we creating today?"}</h1>
      <p className="lede">{language === "ar" ? "اختر المشروع، اكتب فكرة الحلقة، اختر محرك الفيديو، وراقب الرحلة حتى النشر." : "Choose a project, describe the episode, pick a video engine, and follow it all the way to publishing."}</p>
    </section>

    {authStatus !== null ? <AccessGate status={authStatus} onUnlocked={() => { setAuthStatus(null); if (production) poll(production.id); }} /> : <div className="ticket creator-form" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="ticket-head">{language === "ar" ? "حلقة / فيديو جديد" : "New episode / video"}</div>
      <div className="creator-options">
        <label>{language === "ar" ? "المشروع" : "Project"}<select value={projectId} onChange={(e) => { setProjectId(e.target.value); setSubject(""); }}>{projects.map((p) => <option key={p.id} value={p.id}>{p.icon ?? "🎬"} {language === "ar" ? p.nameAr ?? p.name : p.name}</option>)}</select></label>
        <label>{language === "ar" ? "محرك الفيديو" : "Video engine"}<select value={provider} onChange={(e) => setProvider(e.target.value)}><option value="auto">{language === "ar" ? "تلقائي — الموصى به" : "Auto — recommended"}</option>{providerOptions.filter((o) => !o.isMock).map((o) => <option key={o.id} value={o.id} disabled={!o.configured}>{o.name}{o.configured ? "" : (language === "ar" ? " (غير مربوط)" : " (not configured)")}</option>)}</select></label>
      </div>

      {currentProject && <div className="note"><strong>{currentProject.icon} {language === "ar" ? currentProject.nameAr ?? currentProject.name : currentProject.name}</strong><span>{language === "ar" ? currentProject.descriptionAr ?? currentProject.description : currentProject.description}</span>{currentProject.bible.characters?.length ? <small>{language === "ar" ? "الشخصيات: " : "Characters: "}{currentProject.bible.characters.map((c) => language === "ar" ? c.displayNameAr ?? c.name : c.name).join(" · ")}</small> : null}</div>}

      <div className="dish-row creator-primary"><input type="text" placeholder={isFood ? (language === "ar" ? "مثال: كبسة سعودية مصغرة" : "Dish, e.g. Mini Saudi Kabsa") : (language === "ar" ? "مثال: ذيبان أول مرة يجرب الكبسة" : "Episode idea, e.g. Dheeban visits Fhaid in Riyadh")} value={subject} maxLength={100} onChange={(e) => setSubject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && subject.trim().length >= 2 && startProduction()} aria-label={language === "ar" ? "فكرة الحلقة" : "Episode idea"} /></div>
      <div className="chips">{suggestions.map((s) => <button key={s} onClick={() => setSubject(s)}>{s}</button>)}</div>
      <textarea value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} placeholder={language === "ar" ? "تفاصيل إضافية: المكان، النكتة، المنتج، الحركة…" : "Optional direction: location, joke, product, action…"} aria-label={language === "ar" ? "الاتجاه الإبداعي" : "Creative direction"} />
      <div className="form-section"><strong>{language === "ar" ? "الأسلوب" : "Style"}</strong><div className="style-grid">{STYLES.map((item) => <button type="button" className={style === item.id ? "style-card selected" : "style-card"} key={item.id} onClick={() => setStyle(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div></div>
      <div className="creator-options">
        <label>{language === "ar" ? "نوع القصة" : "Story"}<select value={storyMode} onChange={(e) => setStoryMode(e.target.value as StoryMode)}><option value="funny">Funny</option><option value="cinematic">Cinematic</option><option value="viral_hook">Viral Hook</option><option value="satisfying">Satisfying</option><option value="educational">Educational</option><option value="asmr">ASMR</option><option value="luxury">Luxury</option></select></label>
        <label>{language === "ar" ? "المدة" : "Length"}<select value={durationPreset} onChange={(e) => setDurationPreset(e.target.value as DurationPreset)}><option value="quick">Quick</option><option value="standard">Standard</option><option value="extended">Extended</option></select></label>
        <label>{language === "ar" ? "اللغة" : "Language"}<select value={language} onChange={(e) => setLocale(e.target.value as "en" | "ar")}><option value="en">English</option><option value="ar">العربية</option></select></label>
      </div>
      <details className="advanced"><summary>{language === "ar" ? "اختبار فقط" : "Testing only"}</summary><label>{language === "ar" ? "محرك تجريبي" : "Test engine"}<select value={provider} onChange={(e) => setProvider(e.target.value)}><option value="auto">Auto</option>{providerOptions.filter((o) => o.isMock).map((o) => <option key={o.id} value={o.id}>{o.name} — test only</option>)}</select></label></details>
      <button className="create-video" onClick={startProduction} disabled={busy || subject.trim().length < 2}>{busy ? (language === "ar" ? "جارٍ التحضير…" : "Preparing…") : (language === "ar" ? "إنشاء الخطة" : "Create plan")}</button>
    </div>}

    {error && <p className="warn" style={{ marginTop: 14 }}>{error}</p>}
    {production && <><div className="ruler" aria-hidden /><ProductionView production={production} onCancel={cancel} onRetry={retry} onGenerate={generate} onReviewShot={reviewShot} onAssemble={assemble} onPlanChange={savePlan} busy={busy} /></>}
  </main>;
}

function ProductionView({ production: p, onCancel, onRetry, onGenerate, onReviewShot, onAssemble, onPlanChange, busy }: { production: Production; onCancel: () => void; onRetry: (shotId: string) => void; onGenerate: () => void; onReviewShot: (shotId: string, action: "accept" | "reject" | "regenerate") => void; onAssemble: () => void; onPlanChange: (shots: Production["shots"]) => Promise<void>; busy: boolean }) {
  const active = ACTIVE.includes(p.status);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState("");
  const [newShotAction, setNewShotAction] = useState("");
  const completedShots = p.shots.filter((shot) => shot.status === "completed").length;
  const acceptedShots = p.shots.filter((shot) => shot.status === "completed" && shot.accepted).length;
  const progressLabel = p.status === "planning" ? "Preparing your shots" : p.status === "generating" ? `Creating shot ${Math.min(completedShots + 1, p.shots.length || 1)} of ${p.shots.length || "…"}` : p.status === "assembling" ? "Preparing the final video" : p.status === "awaiting_approval" ? "Ready for review" : p.status.replaceAll("_", " ");
  function beginEdit(index: number) { const current = p.shots[index]; setEditingShotId(current.id); setDraftAction(current.action); }
  async function saveShot(index: number) { const action = draftAction.trim(); if (!action) return; await onPlanChange(p.shots.map((shot, i) => i === index ? { ...shot, action } : shot)); setEditingShotId(null); }
  async function moveShot(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= p.shots.length) return; const next = [...p.shots]; [next[index], next[target]] = [next[target], next[index]]; await onPlanChange(next); }
  async function deleteShot(index: number) { if (p.shots.length <= 3 || !window.confirm("Remove this shot from the plan?")) return; await onPlanChange(p.shots.filter((_, i) => i !== index)); }
  async function addShot() { const action = newShotAction.trim(); if (!action || p.shots.length >= 9) return; await onPlanChange([...p.shots, { ...p.shots[p.shots.length - 1], id: `shot_new_${Date.now().toString(36)}`, action, status: "planned", attempts: 0, providerJobId: undefined, videoUrl: undefined, error: undefined }]); setNewShotAction(""); }
  return <section>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><h2>{p.episodeTitle ?? p.dish}</h2><StatusBadge status={p.status} />{p.projectName && <span className="badge ready">{p.projectName}</span>}{active && <button className="danger" onClick={onCancel}>Cancel production</button>}</div>
    <p className="progress-copy">{progressLabel}</p>
    {p.providerIsMock && <p className="warn">MOCK provider active — this run is for testing only and produces no real video.</p>}
    {p.error && <p className="warn">{p.error}</p>}
    {p.status === "planned" && <div className="note plan-ready"><strong>Your shot plan is ready.</strong><span>Review the storyboard. No paid generation starts until you confirm.</span><button onClick={onGenerate} disabled={busy}>{busy ? "Starting…" : p.providerIsMock ? "Run safe test" : `Generate ${p.shots.length} shots with ${p.provider}`}</button></div>}

    <div className="grid production-grid" style={{ marginTop: 14 }}>
      <details className="card advanced-panel"><summary>Production details</summary><p className="dim">{p.projectName ?? "MiniBites"} · {p.provider} · {p.planSource === "llm" ? "AI plan" : "Reliable template plan"} · {new Date(p.createdAt).toLocaleString()}</p><p className="mono dim">{p.id}</p><h3>Workflow</h3>{p.agents.map((a) => <div key={a.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: "0.92rem" }}>{a.name}</strong><StatusBadge status={a.status} /></div>{a.note && <p className="dim" style={{ margin: "4px 0 0" }}>{a.note}</p>}{a.logs.length > 0 && <div className="logbox mono" style={{ marginTop: 6 }}>{a.logs.slice(-6).map((line) => <div key={line}>{line}</div>)}</div>}</div>)}</details>
      <div className="card"><h3>Storyboard / Shots</h3>{p.shots.length === 0 ? <p className="dim">The shot list appears once planning completes.</p> : <div className="shots">{p.shots.map((s, shotIndex) => <div className="shot" key={s.id}><div style={{ display: "flex", justifyContent: "space-between" }}><span className="mono" style={{ color: "var(--yolk)" }}>SHOT {String(s.index).padStart(2, "0")} · {s.seconds}s</span><StatusBadge status={s.status} /></div>{editingShotId === s.id ? <div className="inline-shot-editor"><label htmlFor={`edit-${s.id}`}>Shot description</label><textarea id={`edit-${s.id}`} value={draftAction} maxLength={400} onChange={(e) => setDraftAction(e.target.value)} /><div><button onClick={() => saveShot(shotIndex)} disabled={!draftAction.trim()}>Save</button><button className="ghost" onClick={() => setEditingShotId(null)}>Cancel</button></div></div> : <p>{s.action}</p>}<p className="dim mono">{s.camera}</p>{p.status === "planned" && editingShotId !== s.id && <div className="shot-actions"><button className="ghost" onClick={() => beginEdit(shotIndex)}>Edit</button><button className="ghost" disabled={shotIndex === 0} onClick={() => moveShot(shotIndex, -1)}>↑</button><button className="ghost" disabled={shotIndex === p.shots.length - 1} onClick={() => moveShot(shotIndex, 1)}>↓</button><button className="danger" onClick={() => deleteShot(shotIndex)}>Delete</button></div>}{typeof s.queuePosition === "number" && <p className="dim">Queue position: {s.queuePosition}</p>}{s.error && <p className="dim" style={{ color: "var(--coral)" }}>{s.error}</p>}{s.videoUrl && !p.providerIsMock && <a className="action-link ghost compact" href={s.videoUrl} target="_blank" rel="noreferrer">Preview clip</a>}{(p.status === "review" || p.status === "changes_requested") && s.status === "completed" && !p.providerIsMock && <div className="shot-actions" style={{ marginTop: 8 }}><button onClick={() => onReviewShot(s.id, "accept")} disabled={s.accepted}>{s.accepted ? "✓ Accepted" : "Accept clip"}</button><button className="ghost" onClick={() => onReviewShot(s.id, "regenerate")}>Regenerate</button>{(s.versions?.length ?? 0) > 0 && <span className="dim">v{s.versions?.length}</span>}</div>}{(s.status === "failed" || s.status === "rejected") && <button className="ghost" style={{ padding: "6px 12px", marginTop: 6 }} onClick={() => onRetry(s.id)}>Retry shot ({s.attempts}/3)</button>}</div>)}</div>}
        {p.status === "planned" && p.shots.length < 9 && <div className="add-shot"><label htmlFor="new-shot">Add another shot</label><div><input id="new-shot" value={newShotAction} maxLength={400} onChange={(e) => setNewShotAction(e.target.value)} placeholder="Describe what happens…" /><button className="ghost" disabled={!newShotAction.trim()} onClick={addShot}>+ Add shot</button></div></div>}
        {(p.status === "review" || p.status === "changes_requested") && !p.providerIsMock && <div className="note" style={{ marginTop: 14 }}><strong>{p.status === "changes_requested" ? "Changes requested" : "Review every clip"}</strong><span>{p.approvalNote ? `${p.approvalNote} · ` : ""}{acceptedShots} of {p.shots.length} accepted. Regeneration keeps previous versions.</span><button onClick={onAssemble} disabled={busy || acceptedShots !== p.shots.length}>{busy ? "Starting…" : "Create final video"}</button></div>}
      </div>
    </div>
    {p.status === "awaiting_approval" && <div className="note" style={{ marginTop: 14 }}>Generation finished. Review and approve from the <a href="/library" style={{ color: "var(--yolk)" }}>Content Library</a>, then publish from <a href="/publishing" style={{ color: "var(--yolk)" }}>Publishing</a>.</div>}
  </section>;
}
