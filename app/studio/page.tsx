"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import GenerationMonitor from "@/components/GenerationMonitor";
import type { CreativeStyle, DirectorMode, DurationPreset, Production, StoryMode, StudioProject } from "@/lib/types";
import { getCreativeTemplate } from "@/lib/templates";
import { useLocale } from "@/components/LocaleProvider";

const FOOD_SUGGESTIONS = ["Mini Saudi Kabsa", "Mini Pizza", "Tiny Kunafa", "Mini Sushi", "Small Pancakes", "Arabic Coffee"];
const IYAL_SUGGESTIONS = ["ذيبان أول مرة يجرب الكبسة", "فهيد في عزيمة منسف", "ذيبان وفهيد في الكشتة", "شراء سيارة مستعملة", "منفوشة تقفل النقاش", "السعودي أول مرة بعمان"];
const FUTURE_GAHWA_SUGGESTIONS = [
  "برق يتعلم يصب القهوة",
  "برق وحساب زاوية الصب ٣٧.٢ درجة",
  "أبو ناصر ومسألة الخوارزمية",
  "برق يجرب التمر السكري",
  "الضيف المستعجل وبرق",
  "ضيافة بلا كود",
];
const SERIES_SUGGESTIONS = ["First episode", "Unexpected visitor", "Road trip", "Dinner invitation", "A friendly challenge", "The misunderstanding"];
const STYLES: Array<{ id: CreativeStyle; label: string; icon: string }> = [
  { id: "cinematic", label: "Cinematic", icon: "🎬" }, { id: "cozy", label: "Warm / Cozy", icon: "☀️" },
  { id: "traditional", label: "Traditional", icon: "🫖" }, { id: "luxury", label: "Premium", icon: "✨" },
  { id: "street", label: "Street / Energetic", icon: "🔥" }, { id: "playful", label: "Playful", icon: "🐑" },
];

interface ProviderOption {
  id: "fal" | "wan" | "mock" | "google";
  name: string;
  shortName: string;
  description: string;
  configured: boolean;
  isMock: boolean;
  isDefault: boolean;
  hint?: string;
  statusLabel: string;
  capabilities?: { nativeAudio?: boolean; imageReference?: boolean; minSeconds?: number; maxSeconds?: number };
}
const ACTIVE = ["planning", "generating", "assembling"];

export default function StudioPage() {
  const { locale, setLocale } = useLocale();
  const [subject, setSubject] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<CreativeStyle>("cinematic");
  const [storyMode, setStoryMode] = useState<StoryMode>("funny");
  const [durationPreset, setDurationPreset] = useState<DurationPreset>("standard");
  const [directorMode, setDirectorMode] = useState<DirectorMode>("auto");
  const [selectedImageModel, setSelectedImageModel] = useState("gemini-3.1-flash-image");
  const [selectedVideoModel, setSelectedVideoModel] = useState("veo-3.1-generate-preview");
  const [selectedTTSModel, setSelectedTTSModel] = useState("gemini-2.5-flash");
  const [audioMode, setAudioMode] = useState<"native" | "exact_tts" | "hybrid">("hybrid");
  const [provider, setProvider] = useState<string>("auto");
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [projectId, setProjectId] = useState("future-gahwa");
  const [production, setProduction] = useState<Production | null>(null);
  const [error, setError] = useState("");
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createRequestId = useRef<string | null>(null);

  const currentProject = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);
  const isFood = (currentProject?.kind ?? "mini_food") === "mini_food";
  const suggestions = currentProject?.id === "future-gahwa"
    ? FUTURE_GAHWA_SUGGESTIONS
    : currentProject?.id === "iyal-al-halal"
    ? IYAL_SUGGESTIONS
    : isFood
    ? FOOD_SUGGESTIONS
    : SERIES_SUGGESTIONS;

  useEffect(() => setLanguage(locale), [locale]);
  useEffect(() => {
    if (currentProject?.kind === "character_series") {
      setStoryMode("funny");
      setAudioMode("hybrid");
      setStyle((value) => value === "asmr" || value === "macro" || value === "workshop" ? "playful" : value);
    } else {
      setAudioMode("native");
    }
    if (currentProject?.defaultProvider) {
      setProvider(currentProject.defaultProvider);
    } else {
      setProvider("auto");
    }
  }, [currentProject?.kind, currentProject?.defaultProvider]);

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
        if (requestedProject && projectData.projects.some((p: StudioProject) => p.id === requestedProject)) {
          setProjectId(requestedProject);
        } else if (projectData.projects.some((p: StudioProject) => p.id === "future-gahwa")) {
          setProjectId("future-gahwa");
        }
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
        body: JSON.stringify({
          projectId,
          title: subject,
          dish: subject,
          description,
          language,
          style,
          storyMode,
          durationPreset,
          directorMode,
          audioMode,
          selectedImageModel: directorMode === "manual" ? selectedImageModel : undefined,
          selectedVideoModel: directorMode === "manual" ? selectedVideoModel : undefined,
          selectedTTSModel: directorMode === "manual" ? selectedTTSModel : undefined,
          provider: directorMode === "manual" ? provider : "auto",
          clientRequestId: createRequestId.current,
        }),
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
      <p className="lede">{language === "ar" ? "اختر المشروع، اكتب فكرة الحلقة، حدد وضع المخرج الذكي، وراقب التوليد بشفافية حتى النشر." : "Choose a project, describe the episode, set AI Director mode, and follow complete model transparency to publishing."}</p>
    </section>

    {authStatus !== null ? <AccessGate status={authStatus} onUnlocked={() => { setAuthStatus(null); if (production) poll(production.id); }} /> : <div className="ticket creator-form" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="ticket-head">{language === "ar" ? "حلقة / فيديو جديد" : "New episode / video"}</div>

      <div className="creator-options">
        <label>{language === "ar" ? "المشروع" : "Project"}<select value={projectId} onChange={(e) => { setProjectId(e.target.value); setSubject(""); }}>{projects.map((p) => <option key={p.id} value={p.id}>{p.icon ?? "🎬"} {language === "ar" ? p.nameAr ?? p.name : p.name}</option>)}</select></label>
      </div>

      {/* AI Director vs Manual Mode Switcher */}
      <div style={{ background: "var(--card-subtle, rgba(255,255,255,0.03))", padding: 12, borderRadius: 10, marginBottom: 12, border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong>{language === "ar" ? "وضع الإخراج والتحكم" : "Director & Model Mode"}</strong>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className={`button compact ${directorMode === "auto" ? "" : "ghost"}`}
              onClick={() => setDirectorMode("auto")}
              style={{ fontSize: "0.78rem" }}
            >
              🤖 {language === "ar" ? "المخرج الذكي (AUTO)" : "AI Director (AUTO)"}
            </button>
            <button
              type="button"
              className={`button compact ${directorMode === "manual" ? "" : "ghost"}`}
              onClick={() => setDirectorMode("manual")}
              style={{ fontSize: "0.78rem" }}
            >
              ⚙️ {language === "ar" ? "يدوي / احترافي (MANUAL)" : "Pro / Manual"}
            </button>
          </div>
        </div>

        {directorMode === "auto" ? (
          <p className="dim" style={{ margin: 0, fontSize: "0.82rem" }}>
            ✨ {language === "ar"
              ? "المخرج الذكي يختار تلقائياً: Nano Banana 2 للصور المرجعية، و Google Veo 3.1 للفيديو بدقة 9:16 مع صوت صب القهوة الطبيعي، و Gemini TTS للدبلجة العربية المطابقة."
              : "AI Director automatically selects: Nano Banana 2 for visual anchors, Google Veo 3.1 for 9:16 vertical video + native pouring sound, and Gemini TTS for exact Arabic dialogue."}
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <div>
              <label style={{ fontSize: "0.78rem", display: "block", marginBottom: 2 }}>{language === "ar" ? "محرك الصور المرجعية" : "Reference Image Model"}</label>
              <select value={selectedImageModel} onChange={(e) => setSelectedImageModel(e.target.value)} style={{ width: "100%", fontSize: "0.82rem" }}>
                <option value="gemini-3.1-flash-image">gemini-3.1-flash-image (Nano Banana 2)</option>
                <option value="imagen-3.0-generate-002">imagen-3.0-generate-002 (Google Imagen 3)</option>
                <option value="fal/flux-pro">fal / Flux Pro (Ultra-HD)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", display: "block", marginBottom: 2 }}>{language === "ar" ? "محرك الفيديو الأساسي" : "Primary Video Engine"}</label>
              <select value={selectedVideoModel} onChange={(e) => setSelectedVideoModel(e.target.value)} style={{ width: "100%", fontSize: "0.82rem" }}>
                <option value="veo-3.1-generate-preview">veo-3.1-generate-preview (Google Veo 3.1)</option>
                <option value="veo-2.0-generate-001">veo-2.0-generate-001 (Google Veo 2.0)</option>
                <option value="fal/kling-video">fal / Kling 1.6 (High-Motion)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", display: "block", marginBottom: 2 }}>{language === "ar" ? "نمط الصوت" : "Audio Mode"}</label>
              <select value={audioMode} onChange={(e) => setAudioMode(e.target.value as any)} style={{ width: "100%", fontSize: "0.82rem" }}>
                <option value="hybrid">Hybrid (Veo Ambient + Gemini TTS Dialogue)</option>
                <option value="native">Native ASMR (Veo Physical Sounds Only)</option>
                <option value="exact_tts">Exact TTS (Dialogue Focus)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", display: "block", marginBottom: 2 }}>{language === "ar" ? "محرك الدبلجة والصوت" : "TTS Speech Model"}</label>
              <select value={selectedTTSModel} onChange={(e) => setSelectedTTSModel(e.target.value)} style={{ width: "100%", fontSize: "0.82rem" }}>
                <option value="gemini-2.5-flash">gemini-2.5-flash (Gemini Arabic TTS)</option>
                <option value="gemini-3.1-flash-tts-preview">gemini-3.1-flash-tts-preview</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="form-section"><strong>{language === "ar" ? "محرك الفيديو" : "Video engine"}</strong>
        <div className="engine-grid">
          <button type="button" className={`engine-card${provider === "auto" ? " selected" : ""}`} onClick={() => setProvider("auto")}>
            <span className="engine-name">Auto</span>
            <span className="engine-desc">{language === "ar" ? "تلقائي — الموصى به" : "Recommended"}</span>
            <span className="engine-status ready">{currentProject?.defaultProvider ? `→ ${providerOptions.find((o) => o.id === currentProject.defaultProvider)?.shortName ?? currentProject.defaultProvider}` : language === "ar" ? "تلقائي" : "Auto"}</span>
          </button>
          {providerOptions.filter((o) => !o.isMock).map((o) => {
            const isProjectDefault = currentProject?.defaultProvider === o.id;
            return <button type="button" key={o.id} className={`engine-card${provider === o.id ? " selected" : ""}${!o.configured ? " unconfigured" : ""}`} onClick={() => setProvider(o.id)}>
              <span className="engine-name">{o.shortName}{isProjectDefault ? (language === "ar" ? " ★" : " ★") : ""}</span>
              <span className="engine-desc">{o.description}</span>
              <span className={`engine-status${o.configured ? " ready" : " warn"}`}>{o.statusLabel}</span>
            </button>;
          })}
        </div>
        {provider !== "auto" && !providerOptions.find((o) => o.id === provider)?.configured && <p className="warn" style={{ marginTop: 8 }}>{providerOptions.find((o) => o.id === provider)?.hint ?? (language === "ar" ? "هذا المحرك غير مربوط. تحقق من التكاملات." : "This engine is not configured. Check Integrations.")}</p>}
      </div>

      {currentProject && <div className="note"><strong>{currentProject.icon} {language === "ar" ? currentProject.nameAr ?? currentProject.name : currentProject.name}</strong><span>{language === "ar" ? currentProject.descriptionAr ?? currentProject.description : currentProject.description}</span>{currentProject.bible.characters?.length ? <small>{language === "ar" ? "الشخصيات: " : "Characters: "}{currentProject.bible.characters.map((c) => language === "ar" ? c.displayNameAr ?? c.name : c.name).join(" · ")}</small> : null}</div>}

      <div className="dish-row creator-primary"><input type="text" placeholder={currentProject?.id === "future-gahwa" ? (language === "ar" ? "مثال: برق يتعلم يصب القهوة" : "Episode idea, e.g. Barq learns to pour Saudi coffee") : isFood ? (language === "ar" ? "مثال: كبسة سعودية مصغرة" : "Dish, e.g. Mini Saudi Kabsa") : (language === "ar" ? "مثال: ذيبان أول مرة يجرب الكبسة" : "Episode idea, e.g. Dheeban visits Fhaid in Riyadh")} value={subject} maxLength={100} onChange={(e) => setSubject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && subject.trim().length >= 2 && startProduction()} aria-label={language === "ar" ? "فكرة الحلقة" : "Episode idea"} /></div>
      <div className="chips">{suggestions.map((s) => <button key={s} onClick={() => setSubject(s)}>{s}</button>)}</div>
      <textarea value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} placeholder={language === "ar" ? "تفاصيل إضافية: المكان، النكتة، المنتج، الحركة…" : "Optional direction: location, joke, product, action…"} aria-label={language === "ar" ? "الاتجاه الإبداعي" : "Creative direction"} />
      <div className="form-section"><strong>{language === "ar" ? "الأسلوب" : "Style"}</strong><div className="style-grid">{STYLES.map((item) => <button type="button" className={style === item.id ? "style-card selected" : "style-card"} key={item.id} onClick={() => setStyle(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div></div>
      <div className="creator-options">
        <label>{language === "ar" ? "نوع القصة" : "Story"}<select value={storyMode} onChange={(e) => setStoryMode(e.target.value as StoryMode)}><option value="funny">Funny</option><option value="cinematic">Cinematic</option><option value="viral_hook">Viral Hook</option><option value="satisfying">Satisfying</option><option value="educational">Educational</option><option value="asmr">ASMR</option><option value="luxury">Luxury</option></select></label>
        <label>{language === "ar" ? "المدة" : "Length"}<select value={durationPreset} onChange={(e) => setDurationPreset(e.target.value as DurationPreset)}><option value="quick">Quick</option><option value="standard">Standard</option><option value="extended">Extended</option></select></label>
        <label>{language === "ar" ? "اللغة" : "Language"}<select value={language} onChange={(e) => setLocale(e.target.value as "en" | "ar")}><option value="en">English</option><option value="ar">العربية</option></select></label>
      </div>
      <details className="advanced"><summary>{language === "ar" ? "اختبار فقط" : "Testing only"}</summary>
        <div className="engine-grid">{providerOptions.filter((o) => o.isMock).map((o) => <button type="button" key={o.id} className={`engine-card${provider === o.id ? " selected" : ""}`} onClick={() => setProvider(o.id)}><span className="engine-name">{o.shortName}</span><span className="engine-desc">{o.description}</span><span className="engine-status warn">{o.statusLabel}</span></button>)}</div>
      </details>
      <button className="create-video" onClick={startProduction} disabled={busy || subject.trim().length < 2}>{busy ? (language === "ar" ? "جارٍ التحضير…" : "Preparing…") : (language === "ar" ? "إنشاء الخطة" : "Create plan")}</button>
    </div>}

    {error && <p className="warn" style={{ marginTop: 14 }}>{error}</p>}
    {production && <><div className="ruler" aria-hidden /><ProductionView production={production} onCancel={cancel} onRetry={retry} onGenerate={generate} onReviewShot={reviewShot} onAssemble={assemble} onPlanChange={savePlan} busy={busy} /></>}
  </main>;
}

function WorkflowStepper({ status }: { status: Production["status"] }) {
  const steps = [
    { id: "project", labelEn: "1. Project", labelAr: "١. المشروع", active: true },
    { id: "idea", labelEn: "2. Idea", labelAr: "٢. الفكرة", active: true },
    { id: "plan", labelEn: "3. Plan", labelAr: "٣. الخطة", active: true },
    { id: "references", labelEn: "4. References", labelAr: "٤. المراجع", active: status !== "planning" },
    { id: "visual", labelEn: "5. Visual", labelAr: "٥. البصري", active: status !== "planning" },
    { id: "audio", labelEn: "6. Audio", labelAr: "٦. الصوت", active: status !== "planning" },
    { id: "generate", labelEn: "7. Generate", labelAr: "٧. التوليد", active: ["generating", "review", "assembling", "awaiting_approval", "published"].includes(status) },
    { id: "review", labelEn: "8. Review", labelAr: "٨. المراجعة", active: ["review", "assembling", "awaiting_approval", "published"].includes(status) },
    { id: "assemble", labelEn: "9. Assemble", labelAr: "٩. التجميع", active: ["assembling", "awaiting_approval", "published"].includes(status) },
    { id: "publish", labelEn: "10. Publish", labelAr: "١٠. النشر", active: ["awaiting_approval", "published"].includes(status) },
  ];

  return (
    <div className="chips" style={{ marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
      {steps.map((s) => (
        <span
          key={s.id}
          className={`badge ${s.active ? "ready" : "ghost"}`}
          style={{ fontSize: "0.78rem", padding: "4px 8px" }}
        >
          {s.labelEn}
        </span>
      ))}
    </div>
  );
}

function ProductionView({
  production: p,
  onCancel,
  onRetry,
  onGenerate,
  onReviewShot,
  onAssemble,
  onPlanChange,
  busy,
}: {
  production: Production;
  onCancel: () => void;
  onRetry: (shotId: string) => void;
  onGenerate: () => void;
  onReviewShot: (shotId: string, action: "accept" | "reject" | "regenerate") => void;
  onAssemble: () => void;
  onPlanChange: (shots: Production["shots"]) => Promise<void>;
  busy: boolean;
}) {
  const active = ACTIVE.includes(p.status);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState("");
  const [draftDialogue, setDraftDialogue] = useState("");
  const [newShotAction, setNewShotAction] = useState("");
  const [playingShotId, setPlayingShotId] = useState<string | null>(null);
  const completedShots = p.shots.filter((shot) => shot.status === "completed").length;
  const acceptedShots = p.shots.filter((shot) => shot.status === "completed" && shot.accepted).length;
  const progressLabel =
    p.status === "planning"
      ? "Preparing your shot plan & dialogue"
      : p.status === "generating"
      ? `Generating clip ${Math.min(completedShots + 1, p.shots.length || 1)} of ${p.shots.length || "…"}`
      : p.status === "assembling"
      ? "Assembling video clips & audio tracks"
      : p.status === "awaiting_approval"
      ? "Ready for final review & publishing"
      : p.status.replaceAll("_", " ");

  function beginEdit(index: number) {
    const current = p.shots[index];
    setEditingShotId(current.id);
    setDraftAction(current.action);
    setDraftDialogue(current.audioPlan?.dialogue?.[0]?.exactText ?? "");
  }

  async function saveShot(index: number) {
    const action = draftAction.trim();
    if (!action) return;
    const current = p.shots[index];
    const updatedDialogue = draftDialogue.trim()
      ? [
          {
            speakerId: current.audioPlan?.dialogue?.[0]?.speakerId ?? "character",
            exactText: draftDialogue.trim(),
            textAr: draftDialogue.trim(),
            voiceName: current.audioPlan?.dialogue?.[0]?.voiceName ?? "Fenrir",
            voiceDirection: current.audioPlan?.dialogue?.[0]?.voiceDirection,
            language: "ar" as const,
          },
        ]
      : current.audioPlan?.dialogue;

    const updatedAudioPlan = current.audioPlan
      ? { ...current.audioPlan, dialogue: updatedDialogue }
      : updatedDialogue
      ? { audioMode: "hybrid" as const, dialogue: updatedDialogue }
      : undefined;

    await onPlanChange(
      p.shots.map((shot, i) =>
        i === index
          ? {
              ...shot,
              action,
              audioPlan: updatedAudioPlan,
            }
          : shot
      )
    );
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
    await onPlanChange([
      ...p.shots,
      {
        ...p.shots[p.shots.length - 1],
        id: `shot_new_${Date.now().toString(36)}`,
        action,
        status: "planned",
        attempts: 0,
        providerJobId: undefined,
        videoUrl: undefined,
        error: undefined,
      },
    ]);
    setNewShotAction("");
  }

  async function previewShotDialogue(shot: Production["shots"][number]) {
    const d = shot.audioPlan?.dialogue?.[0];
    if (!d) return;
    setPlayingShotId(shot.id);
    try {
      const res = await api<{ audioUrl: string }>(`/api/audio/preview`, {
        method: "POST",
        body: JSON.stringify({
          characterId: d.speakerId,
          exactText: d.exactText,
          voiceName: d.voiceName,
          direction: d.voiceDirection,
        }),
      });
      const audio = new Audio(res.audioUrl);
      audio.play().catch(() => undefined);
      audio.onended = () => setPlayingShotId(null);
    } catch {
      setPlayingShotId(null);
    }
  }

  return (
    <section>
      <WorkflowStepper status={p.status} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2>{p.episodeTitle ?? p.dish}</h2>
        <StatusBadge status={p.status} />
        {p.projectName && <span className="badge ready">{p.projectName}</span>}
        <span className="badge">{p.audioMode === "hybrid" ? "Hybrid Audio (Veo + TTS)" : p.audioMode === "exact_tts" ? "Exact TTS" : "Native ASMR Audio"}</span>
        {active && <button className="danger" onClick={onCancel}>Cancel production</button>}
      </div>

      <p className="progress-copy">{progressLabel}</p>
      {p.providerIsMock && <p className="warn">MOCK provider active — this run is for testing only and produces no real video.</p>}
      {p.error && <p className="warn">{p.error}</p>}

      {p.status === "planned" && (
        <div className="note plan-ready">
          <strong>Your shot plan is ready for review.</strong>
          <span>Verify shots, reference images, and exact Arabic dialogue before confirming paid generation.</span>
          <div className="preflight-info">
            <div><small>Engine</small><strong>{p.provider}</strong></div>
            <div><small>Audio Mode</small><strong>{p.audioMode ?? "native"}</strong></div>
            <div><small>Shots</small><strong>{p.shots.length}</strong></div>
            <div><small>Aspect</small><strong>9:16</strong></div>
            <div><small>Duration</small><strong>~{p.shots.reduce((s, shot) => s + shot.seconds, 0)}s</strong></div>
            {p.kitchenReference && <div><small>Kitchen Ref</small><strong>1:12 Master Locked</strong></div>}
          </div>
          <button onClick={onGenerate} disabled={busy}>
            {busy ? "Starting…" : p.providerIsMock ? "Run safe test" : `Generate ${p.shots.length} shots with ${p.provider}`}
          </button>
        </div>
      )}

      {/* Generation Monitor & Model Inspector */}
      <GenerationMonitor monitor={p.generationMonitor} directorMode={p.directorMode} audioMode={p.audioMode} provider={p.provider} />

      <div className="grid production-grid" style={{ marginTop: 14 }}>
        <details className="card advanced-panel">
          <summary>Production details & Agents</summary>
          <p className="dim">{p.projectName ?? "MiniBites"} · {p.provider} · {p.planSource === "llm" ? "AI plan" : "Reliable template plan"} · {new Date(p.createdAt).toLocaleString()}</p>
          <p className="mono dim">{p.id}</p>
          <h3>Workflow Agents</h3>
          {p.agents.map((a) => (
            <div key={a.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: "0.92rem" }}>{a.name}</strong>
                <StatusBadge status={a.status} />
              </div>
              {a.note && <p className="dim" style={{ margin: "4px 0 0" }}>{a.note}</p>}
              {a.logs.length > 0 && (
                <div className="logbox mono" style={{ marginTop: 6 }}>
                  {a.logs.slice(-6).map((line) => <div key={line}>{line}</div>)}
                </div>
              )}
            </div>
          ))}
        </details>

        <div className="card">
          <h3>Storyboard & Shots ({p.shots.length})</h3>
          {p.shots.length === 0 ? (
            <p className="dim">The shot list appears once planning completes.</p>
          ) : (
            <div className="shots">
              {p.shots.map((s, shotIndex) => {
                const dialogueItem = s.audioPlan?.dialogue?.[0];

                return (
                  <div className="shot" key={s.id} style={{ borderLeft: s.audioPlan?.dialogue?.length ? "3px solid var(--yolk)" : undefined }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mono" style={{ color: "var(--yolk)", fontWeight: 600 }}>
                        SHOT {String(s.index).padStart(2, "0")} · {s.seconds}s
                      </span>
                      <StatusBadge status={s.status} />
                    </div>

                    {editingShotId === s.id ? (
                      <div className="inline-shot-editor" style={{ marginTop: 8 }}>
                        <label htmlFor={`edit-action-${s.id}`}>Shot visual action</label>
                        <textarea
                          id={`edit-action-${s.id}`}
                          value={draftAction}
                          maxLength={400}
                          onChange={(e) => setDraftAction(e.target.value)}
                        />
                        <label htmlFor={`edit-dialogue-${s.id}`} style={{ marginTop: 6 }}>
                          Exact Arabic Dialogue / Narration
                        </label>
                        <input
                          id={`edit-dialogue-${s.id}`}
                          dir="rtl"
                          value={draftDialogue}
                          maxLength={300}
                          onChange={(e) => setDraftDialogue(e.target.value)}
                          placeholder="النص العربي الدقيق الذي ينطقه الممثل…"
                        />
                        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                          <button onClick={() => saveShot(shotIndex)} disabled={!draftAction.trim()}>Save</button>
                          <button className="ghost" onClick={() => setEditingShotId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: "6px 0", fontWeight: 500 }}>{s.action}</p>
                        <p className="dim mono" style={{ fontSize: "0.82rem" }}>🎥 {s.camera}</p>

                        {/* Sound & Dialogue details */}
                        <div style={{ background: "var(--card-subtle, rgba(255,255,255,0.02))", padding: "6px 10px", borderRadius: 6, margin: "6px 0", fontSize: "0.86rem" }}>
                          <div style={{ color: "var(--muted)" }}>🔊 {s.sound}</div>
                          {dialogueItem && (
                            <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <div dir="rtl" style={{ fontWeight: 600, color: "var(--foreground)", fontSize: "0.94rem" }}>
                                🗣️ «{dialogueItem.exactText}»
                                <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginRight: 6 }}>({dialogueItem.speakerId} · {dialogueItem.voiceName ?? "TTS"})</span>
                              </div>
                              <button
                                className="button compact ghost"
                                onClick={() => previewShotDialogue(s)}
                                disabled={playingShotId === s.id}
                              >
                                {playingShotId === s.id ? "…" : "▶ استمع"}
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {p.status === "planned" && editingShotId !== s.id && (
                      <div className="shot-actions" style={{ marginTop: 6 }}>
                        <button className="ghost compact" onClick={() => beginEdit(shotIndex)}>Edit</button>
                        <button className="ghost compact" disabled={shotIndex === 0} onClick={() => moveShot(shotIndex, -1)}>↑</button>
                        <button className="ghost compact" disabled={shotIndex === p.shots.length - 1} onClick={() => moveShot(shotIndex, 1)}>↓</button>
                        <button className="danger compact" onClick={() => deleteShot(shotIndex)}>Delete</button>
                      </div>
                    )}

                    {typeof s.queuePosition === "number" && <p className="dim">Queue position: {s.queuePosition}</p>}
                    {s.error && <p className="dim" style={{ color: "var(--coral)" }}>{s.error}</p>}
                    {s.videoUrl && !p.providerIsMock && (
                      <a className="action-link ghost compact" href={s.videoUrl} target="_blank" rel="noreferrer">Preview clip</a>
                    )}

                    {(p.status === "review" || p.status === "changes_requested") && s.status === "completed" && !p.providerIsMock && (
                      <div className="shot-actions" style={{ marginTop: 8 }}>
                        <button onClick={() => onReviewShot(s.id, "accept")} disabled={s.accepted}>
                          {s.accepted ? "✓ Accepted" : "Accept clip"}
                        </button>
                        <button className="ghost" onClick={() => onReviewShot(s.id, "regenerate")}>Regenerate</button>
                        {(s.versions?.length ?? 0) > 0 && <span className="dim">v{s.versions?.length}</span>}
                      </div>
                    )}

                    {(s.status === "failed" || s.status === "rejected") && (
                      <button className="ghost" style={{ padding: "6px 12px", marginTop: 6 }} onClick={() => onRetry(s.id)}>
                        Retry shot ({s.attempts}/3)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {p.status === "planned" && p.shots.length < 9 && (
            <div className="add-shot" style={{ marginTop: 12 }}>
              <label htmlFor="new-shot">Add another shot</label>
              <div>
                <input
                  id="new-shot"
                  value={newShotAction}
                  maxLength={400}
                  onChange={(e) => setNewShotAction(e.target.value)}
                  placeholder="Describe what happens in this scene…"
                />
                <button className="ghost" disabled={!newShotAction.trim()} onClick={addShot}>+ Add shot</button>
              </div>
            </div>
          )}

          {(p.status === "review" || p.status === "changes_requested") && !p.providerIsMock && (
            <div className="note" style={{ marginTop: 14 }}>
              <strong>{p.status === "changes_requested" ? "Changes requested" : "Review every clip"}</strong>
              <span>{p.approvalNote ? `${p.approvalNote} · ` : ""}{acceptedShots} of {p.shots.length} accepted.</span>
              <button onClick={onAssemble} disabled={busy || acceptedShots !== p.shots.length}>
                {busy ? "Starting…" : "Create final video"}
              </button>
            </div>
          )}
        </div>
      </div>

      {p.status === "awaiting_approval" && (
        <div className="note" style={{ marginTop: 14 }}>
          <strong>Generation & Assembly complete!</strong> Review and publish from the{" "}
          <a href="/publishing" style={{ color: "var(--yolk)", textDecoration: "underline" }}>Publishing Dashboard</a>.
        </div>
      )}
    </section>
  );
}
