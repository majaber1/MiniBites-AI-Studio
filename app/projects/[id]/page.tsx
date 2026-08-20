"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import { useLocale } from "@/components/LocaleProvider";
import type { AudioMode, CharacterReferenceAsset, Production, ProjectKitchenReference, ProviderChoice, StudioProject } from "@/lib/types";
import { PREBUILT_VOICES } from "@/lib/audio/tts";

type Tab = "overview" | "episodes" | "references" | "bible";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [project, setProject] = useState<StudioProject | null>(null);
  const [productions, setProductions] = useState<Production[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyRef, setBusyRef] = useState(false);

  // Bible state
  const [concept, setConcept] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [tone, setTone] = useState("");
  const [locations, setLocations] = useState("");
  const [continuity, setContinuity] = useState("");
  const [negative, setNegative] = useState("");
  const [defaultProvider, setDefaultProvider] = useState<string>("");
  const [defaultAudioMode, setDefaultAudioMode] = useState<AudioMode>("native");

  // Reference Generator state
  const [previewKitchen, setPreviewKitchen] = useState<ProjectKitchenReference | null>(null);
  const [previewCharAssets, setPreviewCharAssets] = useState<Record<string, CharacterReferenceAsset>>({});
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [playingCharId, setPlayingCharId] = useState<string | null>(null);

  const hydrate = (p: StudioProject) => {
    setProject(p);
    setConcept(p.bible.concept);
    setVisualStyle(p.bible.visualStyle);
    setTone(p.bible.tone ?? "");
    setLocations((p.bible.locations ?? []).join("\n"));
    setContinuity((p.bible.continuityRules ?? []).join("\n"));
    setNegative((p.bible.negativeRules ?? []).join("\n"));
    setDefaultProvider(p.defaultProvider ?? "");
    setDefaultAudioMode(p.bible.defaultAudioMode ?? (p.kind === "character_series" ? "hybrid" : "native"));
  };

  const load = useCallback(async () => {
    try {
      const result = await api<{ project: StudioProject; productions: Production[] }>(`/api/projects/${encodeURIComponent(id)}`);
      hydrate(result.project);
      setProductions(result.productions);
      setAuthStatus(null);
      setError("");
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 503)) setAuthStatus(reason.status);
      else setError(reason instanceof Error ? reason.message : "Project could not be loaded.");
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function saveBible() {
    if (!project) return;
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const { project: updated } = await api<{ project: StudioProject }>(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          defaultProvider: defaultProvider || undefined,
          bible: {
            concept,
            visualStyle,
            tone,
            defaultAudioMode,
            locations: locations.split("\n").map((v) => v.trim()).filter(Boolean),
            continuityRules: continuity.split("\n").map((v) => v.trim()).filter(Boolean),
            negativeRules: negative.split("\n").map((v) => v.trim()).filter(Boolean),
          },
        }),
      });
      hydrate(updated);
      setSuccessMsg(ar ? "تم حفظ دليل المشروع بنجاح!" : "Project Bible saved successfully!");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Project Bible could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateKitchen() {
    if (!project) return;
    setBusyRef(true);
    setError("");
    try {
      const res = await api<{ reference: ProjectKitchenReference; modelUsed: string }>(`/api/projects/${encodeURIComponent(id)}/references`, {
        method: "POST",
        body: JSON.stringify({ action: "generate_kitchen" }),
      });
      setPreviewKitchen(res.reference);
      setSuccessMsg(ar ? `تم توليد مرجع المطبخ بنجاح (${res.modelUsed}). راجع واعتمد للحفظ.` : `Kitchen reference generated (${res.modelUsed}). Preview and approve to save.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kitchen reference generation failed.");
    } finally {
      setBusyRef(false);
    }
  }

  async function handleApproveKitchen() {
    if (!project || !previewKitchen?.imageUrl) return;
    setBusyRef(true);
    setError("");
    try {
      const res = await api<{ project: StudioProject; kitchenReference: ProjectKitchenReference }>(`/api/projects/${encodeURIComponent(id)}/references`, {
        method: "POST",
        body: JSON.stringify({ action: "approve_kitchen", imageUrl: previewKitchen.imageUrl, prompt: previewKitchen.prompt }),
      });
      hydrate(res.project);
      setPreviewKitchen(null);
      setSuccessMsg(ar ? "تم اعتماد وحفظ مرجع المطبخ الرئيسي في دليل المشروع!" : "Master Kitchen Reference approved and saved to Project Bible!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kitchen reference approval failed.");
    } finally {
      setBusyRef(false);
    }
  }

  async function handleGenerateCharacterAsset(charId: string) {
    if (!project) return;
    setBusyRef(true);
    setError("");
    try {
      const res = await api<{ asset: CharacterReferenceAsset; characterId: string; modelUsed: string }>(`/api/projects/${encodeURIComponent(id)}/references`, {
        method: "POST",
        body: JSON.stringify({ action: "generate_character", characterId: charId }),
      });
      setPreviewCharAssets((prev) => ({ ...prev, [charId]: res.asset }));
      setSuccessMsg(ar ? `تم توليد مرجع الشخصية (${res.modelUsed})!` : `Character reference generated (${res.modelUsed})!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Character reference generation failed.");
    } finally {
      setBusyRef(false);
    }
  }

  async function handleApproveCharacterAsset(charId: string) {
    const asset = previewCharAssets[charId];
    if (!project || !asset?.url) return;
    setBusyRef(true);
    setError("");
    try {
      const res = await api<{ project: StudioProject }>(`/api/projects/${encodeURIComponent(id)}/references`, {
        method: "POST",
        body: JSON.stringify({ action: "approve_character", characterId: charId, imageUrl: asset.url, prompt: asset.prompt }),
      });
      hydrate(res.project);
      setPreviewCharAssets((prev) => {
        const next = { ...prev };
        delete next[charId];
        return next;
      });
      setSuccessMsg(ar ? "تم اعتماد وحفظ مرجع الشخصية في دليل المشروع!" : "Character reference approved and saved!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Character reference approval failed.");
    } finally {
      setBusyRef(false);
    }
  }

  async function handlePreviewVoice(charId: string, voiceName?: string, direction?: string) {
    setPlayingCharId(charId);
    setError("");
    try {
      const res = await api<{ audioUrl: string; exactText: string }>(`/api/audio/preview`, {
        method: "POST",
        body: JSON.stringify({ characterId: charId, voiceName, direction }),
      });
      setPreviewAudioUrl(res.audioUrl);
      const audio = new Audio(res.audioUrl);
      audio.play().catch(() => undefined);
      audio.onended = () => setPlayingCharId(null);
    } catch (err) {
      setPlayingCharId(null);
      setError(err instanceof Error ? err.message : "Voice preview failed.");
    }
  }

  if (authStatus !== null) return <main className="wrap"><AccessGate status={authStatus} onUnlocked={() => void load()} /></main>;
  if (!project) return <main className="wrap"><section className="hero"><h1>{ar ? "جارٍ تحميل المشروع…" : "Loading project…"}</h1>{error && <p className="warn">{error}</p>}</section></main>;

  const tabs: Array<{ id: Tab; en: string; ar: string }> = [
    { id: "overview", en: "Overview", ar: "نظرة عامة" },
    { id: "episodes", en: "Episodes", ar: "الحلقات" },
    { id: "references", en: project.kind === "mini_food" ? "Kitchen Reference" : "Characters & References", ar: project.kind === "mini_food" ? "مرجع المطبخ" : "الشخصيات والمراجع" },
    { id: "bible", en: "Project Bible", ar: "دليل المشروع" },
  ];

  return (
    <main className="wrap">
      <section className="dashboard-hero">
        <div>
          <div className="eyebrow">{project.kind.replaceAll("_", " ")}</div>
          <h1>{project.icon} {ar ? project.nameAr ?? project.name : project.name}</h1>
          <p>{ar ? project.descriptionAr ?? project.description : project.description}</p>
        </div>
        <Link className="button" href={`/studio?project=${encodeURIComponent(project.id)}`}>{ar ? "حلقة جديدة" : "New episode"} →</Link>
      </section>

      {error && <p className="warn" style={{ marginBottom: 12 }}>{error}</p>}
      {successMsg && <div className="note" style={{ marginBottom: 12 }}><strong>{successMsg}</strong></div>}

      <div className="chips" style={{ marginBottom: 20 }}>
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? "" : "ghost"} onClick={() => setTab(item.id)}>
            {ar ? item.ar : item.en}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="dashboard-grid">
          <article className="card">
            <span className="eyebrow">{ar ? "الفكرة" : "Concept"}</span>
            <h2>{project.bible.concept}</h2>
            <p className="dim">{project.bible.visualStyle}</p>
          </article>
          <article className="card">
            <span className="eyebrow">{ar ? "إعدادات افتراضية" : "Defaults"}</span>
            <div className="readiness-list">
              <div><span className="integration-dot connected" /><span><strong>{project.bible.aspectRatio}</strong><small>{ar ? "نسبة الفيديو" : "Aspect ratio"}</small></span></div>
              <div><span className="integration-dot connected" /><span><strong>{project.bible.defaultDurationSeconds}s</strong><small>{ar ? "المدة" : "Default duration"}</small></span></div>
              <div><span className="integration-dot connected" /><span><strong>{project.bible.defaultAudioMode ?? "native"}</strong><small>{ar ? "وضع الصوت" : "Audio mode"}</small></span></div>
              <div><span className="integration-dot connected" /><span><strong>{project.defaultProvider ? { google: "Google (Veo)", fal: "fal.ai", wan: "Wan", mock: "Mock" }[project.defaultProvider] ?? project.defaultProvider : (ar ? "تلقائي" : "Auto")}</strong><small>{ar ? "محرك الفيديو" : "Video engine"}</small></span></div>
            </div>
          </article>
          <article className="card"><span className="eyebrow">{ar ? "النشاط" : "Activity"}</span><h2>{productions.length}</h2><p className="dim">{ar ? "إجمالي الحلقات / الفيديوهات" : "episodes / videos"}</p></article>
          <article className="card"><span className="eyebrow">{ar ? "آخر تحديث" : "Updated"}</span><h2>{new Intl.DateTimeFormat(ar ? "ar-SA" : "en", { dateStyle: "medium" }).format(new Date(project.updatedAt))}</h2><p className="dim">{project.status}</p></article>
        </section>
      )}

      {tab === "episodes" && (
        <section className="card">
          <div className="dashboard-section-head">
            <div><span className="eyebrow">{ar ? "الحلقات" : "Episodes"}</span><h2>{ar ? "مكتبة المشروع" : "Project episodes"}</h2></div>
          </div>
          {productions.length === 0 ? (
            <p className="dim">{ar ? "لا توجد حلقات بعد." : "No episodes yet."}</p>
          ) : (
            <div className="dashboard-project-list">
              {productions.map((p) => (
                <Link key={p.id} href={`/studio?project=${project.id}`} className="dashboard-project">
                  <span className="project-thumb">{project.icon ?? "🎬"}</span>
                  <span><strong>{p.episodeTitle ?? p.dish}</strong><small>{p.provider} · {new Date(p.updatedAt).toLocaleString()}</small></span>
                  <StatusBadge status={p.status} />
                  <span className="project-arrow">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "references" && (
        <section>
          {project.kind === "mini_food" ? (
            <div className="card">
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "استمرارية البيئة" : "Environment Continuity"}</span>
                  <h2>{ar ? "مرجع المطبخ الرئيسي المصغّر (1:12)" : "Permanent 1:12 Master Kitchen Reference"}</h2>
                  <p className="dim">
                    {ar ? "تثبيت المطبخ بمقياس 1:12: نفس الموقد، طاولة التحضير، الأدوات، الإضاءة، والأيدي الحقيقية عبر كل لقطات MiniBites." : "Enforce 1:12 miniature kitchen continuity: identical burner, cutting board, cookware, macro lighting, and adult hands."}
                  </p>
                </div>
                <button className="button compact" onClick={handleGenerateKitchen} disabled={busyRef}>
                  {busyRef ? (ar ? "جارٍ التوليد…" : "Generating…") : (ar ? "توليد مرجع مطبخ جديد" : "Generate Kitchen Reference")}
                </button>
              </div>

              {previewKitchen && (
                <div className="note" style={{ marginBottom: 16 }}>
                  <strong>{ar ? "معاينة مرجع المطبخ المولد" : "Generated Kitchen Reference Preview"}</strong>
                  <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {previewKitchen.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewKitchen.imageUrl} alt="Kitchen preview" style={{ width: 140, height: 248, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <p><strong>{previewKitchen.name}</strong></p>
                      <p className="dim mono" style={{ fontSize: "0.85rem" }}>{previewKitchen.prompt}</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={handleApproveKitchen} disabled={busyRef}>{ar ? "✓ اعتماد كمرجع دائم" : "✓ Approve Master Reference"}</button>
                        <button className="ghost" onClick={handleGenerateKitchen} disabled={busyRef}>{ar ? "إعادة التوليد" : "Regenerate"}</button>
                        <button className="ghost" onClick={() => setPreviewKitchen(null)}>{ar ? "إلغاء" : "Cancel"}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {project.bible.kitchenReference ? (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", marginTop: 12 }}>
                  {project.bible.kitchenReference.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.bible.kitchenReference.imageUrl} alt="Master kitchen" style={{ width: 180, height: 320, objectFit: "cover", borderRadius: 10, border: "2px solid var(--yolk)" }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3>{project.bible.kitchenReference.name}</h3>
                      <span className="badge ready">{ar ? "معتمد في دليل المشروع" : "Approved Master Reference"}</span>
                    </div>
                    <p><strong>{ar ? "المقياس:" : "Scale:"} </strong>{project.bible.kitchenReference.scale ?? "1:12 miniature scale"}</p>
                    <p><strong>{ar ? "بيئة المطبخ:" : "Environment:"} </strong>{project.bible.kitchenReference.environment}</p>
                    <p><strong>{ar ? "الإضاءة والألوان:" : "Lighting & Palette:"} </strong>{project.bible.kitchenReference.lighting} · {project.bible.kitchenReference.palette}</p>
                    <p className="dim">{project.bible.kitchenReference.notes}</p>
                    <p className="mono dim" style={{ fontSize: "0.82rem", marginTop: 8 }}>{project.bible.kitchenReference.prompt}</p>
                  </div>
                </div>
              ) : (
                <p className="dim">{ar ? "لا يوجد مرجع مطبخ معتمد بعد. اضغط على زر التوليد بالأعلى." : "No approved kitchen reference yet. Click Generate Kitchen Reference above."}</p>
              )}
            </div>
          ) : (
            <div>
              <div className="dashboard-section-head">
                <div>
                  <span className="eyebrow">{ar ? "مراجع الشخصيات والأصوات" : "Character & Voice References"}</span>
                  <h2>{ar ? "الشخصيات الثابتة" : "Recurring Characters"}</h2>
                  <p className="dim">
                    {ar ? "تثبيت الملامح، الهوية، الملابس، واللهجة، وملف الصوت (Gemini TTS) لكل شخصية." : "Preserve facial identity, wardrobe, dialect, and stable Google TTS voice profile per character."}
                  </p>
                </div>
              </div>

              <div className="steps-grid">
                {(project.bible.characters ?? []).map((c) => {
                  const previewAsset = previewCharAssets[c.id];
                  const approvedAsset = c.referenceAssets?.[0] ?? (c.referenceImageUrls?.[0] ? { id: "legacy", url: c.referenceImageUrls[0], label: "Reference", approved: true } : null);

                  return (
                    <article className="card" key={c.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "2.2rem" }}>🐑</span>
                        <button className="button compact ghost" onClick={() => handleGenerateCharacterAsset(c.id)} disabled={busyRef}>
                          {busyRef ? "…" : ar ? "توليد صورة مرجعية" : "Generate Reference"}
                        </button>
                      </div>

                      <h3>{ar ? c.displayNameAr ?? c.name : c.name}</h3>
                      <p className="dim">{c.role}</p>

                      {previewAsset && (
                        <div className="note" style={{ margin: "8px 0" }}>
                          <p><strong>{ar ? "معاينة المرجع المولد:" : "Preview Reference:"}</strong></p>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewAsset.url} alt="Preview" style={{ width: 64, height: 114, objectFit: "cover", borderRadius: 6 }} />
                            <div>
                              <button className="compact" onClick={() => handleApproveCharacterAsset(c.id)} disabled={busyRef}>
                                {ar ? "اعتماد المرجع" : "Approve"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {approvedAsset && (
                        <div style={{ display: "flex", gap: 10, margin: "8px 0", alignItems: "center" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={approvedAsset.url} alt={c.name} style={{ width: 72, height: 128, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--yolk)" }} />
                          <div>
                            <span className="badge ready" style={{ fontSize: "0.75rem" }}>{ar ? "مرجع بصري معتمد" : "Approved Reference"}</span>
                          </div>
                        </div>
                      )}

                      <p><strong>{ar ? "اللهجة: " : "Dialect: "}</strong>{c.dialect ?? "—"}</p>
                      <p><strong>{ar ? "الملابس: " : "Wardrobe: "}</strong>{c.wardrobe ?? "—"}</p>
                      <div style={{ background: "var(--card-subtle, rgba(255,255,255,0.03))", padding: 8, borderRadius: 6, margin: "8px 0" }}>
                        <p style={{ margin: 0, fontSize: "0.88rem" }}>
                          <strong>{ar ? "الصوت المعتمد: " : "Voice Profile: "}</strong>
                          {c.voiceProfile?.voiceName ?? "Fenrir"} ({c.voiceProfile?.direction ?? c.voiceStyle ?? "natural"})
                        </p>
                        <button
                          className="button compact ghost"
                          style={{ marginTop: 6 }}
                          onClick={() => handlePreviewVoice(c.id, c.voiceProfile?.voiceName, c.voiceProfile?.direction)}
                          disabled={playingCharId === c.id}
                        >
                          {playingCharId === c.id ? (ar ? "جارٍ الاستماع…" : "Playing…") : (ar ? "▶ استمع للصوت" : "▶ Preview Voice")}
                        </button>
                      </div>

                      <p style={{ fontSize: "0.9rem" }}>{c.personality}</p>
                      <details><summary>{ar ? "تعليمات الاستمرارية" : "Continuity Rules"}</summary><p className="dim" style={{ fontSize: "0.85rem" }}>{c.continuityInstructions?.join(" · ") || c.visualNotes}</p></details>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "bible" && (
        <section className="card creator-form">
          <div>
            <span className="eyebrow">Project Bible</span>
            <h2>{ar ? "القواعد التي ترثها كل حلقة" : "Rules inherited by every new episode"}</h2>
            <p className="dim">{ar ? "الحلقات القديمة تحتفظ بنسختها الخاصة؛ التعديل هنا يؤثر على الحلقات الجديدة فقط." : "Existing episodes keep their snapshot; edits here affect new episodes only."}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              {ar ? "محرك الفيديو الافتراضي" : "Default video engine"}
              <select value={defaultProvider} onChange={(e) => setDefaultProvider(e.target.value as ProviderChoice)}>
                <option value="">{ar ? "تلقائي (حسب المشروع والبيئة)" : "Auto (project default)"}</option>
                <option value="google">Google — Veo (Native Audio & References)</option>
                <option value="fal">fal.ai</option>
                <option value="wan">Wan (self-hosted)</option>
              </select>
            </label>

            <label>
              {ar ? "وضع الصوت الافتراضي" : "Default audio mode"}
              <select value={defaultAudioMode} onChange={(e) => setDefaultAudioMode(e.target.value as AudioMode)}>
                <option value="native">{ar ? "Native ASMR (أصوات البيئة الحقيقية — MiniBites)" : "Native ASMR (Veo ambient & effects)"}</option>
                <option value="hybrid">{ar ? "Hybrid (حوار عربي دقيق TTS + مؤثرات Veo — عيال الحلال)" : "Hybrid (Exact Arabic Gemini TTS + Veo ambient)"}</option>
                <option value="exact_tts">{ar ? "Exact TTS فقط" : "Exact TTS only"}</option>
              </select>
            </label>
          </div>

          <label>{ar ? "الفكرة" : "Concept"}<textarea value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={1200} /></label>
          <label>{ar ? "الأسلوب البصري" : "Visual style"}<textarea value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} maxLength={800} /></label>
          <label>{ar ? "النبرة" : "Tone"}<textarea value={tone} onChange={(e) => setTone(e.target.value)} maxLength={500} /></label>
          <label>{ar ? "المواقع — سطر لكل موقع" : "Locations — one per line"}<textarea value={locations} onChange={(e) => setLocations(e.target.value)} /></label>
          <label>{ar ? "قواعد الاستمرارية — سطر لكل قاعدة" : "Continuity rules — one per line"}<textarea value={continuity} onChange={(e) => setContinuity(e.target.value)} /></label>
          <label>{ar ? "الممنوعات — سطر لكل قاعدة" : "Negative rules — one per line"}<textarea value={negative} onChange={(e) => setNegative(e.target.value)} /></label>
          <button className="button" onClick={() => void saveBible()} disabled={saving}>{saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ دليل المشروع" : "Save Project Bible")}</button>
        </section>
      )}
    </main>
  );
}

