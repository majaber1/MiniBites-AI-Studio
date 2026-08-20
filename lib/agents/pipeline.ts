// ---------------------------------------------------------------------------
// Kiswani AI Studio agent pipeline — a real, persisted state machine.
// No fake progress: state only advances when real work completes.
// ---------------------------------------------------------------------------
import type { AgentId, AgentState, CreativeStyle, DurationPreset, Production, ProjectBible, ProjectKind, ProviderChoice, Shot, StoryMode } from "../types";
import { getVideoProvider } from "../providers";
import { createStudioPlan } from "../studio-planner";
import { getStore } from "../store";
import { falAssemblyConfigured, getMergeStatus, getMergeResult, submitMerge } from "../assembly";
import { archiveFinalVideo, durableMediaConfigured } from "../media-storage";
import { AGENT_DEFS } from "./defs";
export { AGENT_DEFS };

const MINI_FOOD_STYLE_PROMPT =
  "Ultra-realistic macro food videography. Real adult human hands cooking with real working dollhouse-scale (1:12) kitchen tools and real edible ingredients in tiny quantities. Continuous physical cooking motion. Macro close-up, shallow depth of field, soft natural kitchen light, vertical 9:16.";
const MINI_FOOD_NEGATIVE =
  "cartoon, animation, illustration, CGI characters, toy figurines, miniature people, dolls with faces, normal-size cookware, still image, slideshow, ken burns, text, watermark, logo, deformed hands, extra fingers";
const CHARACTER_STYLE_PROMPT =
  "Polished cinematic 3D character animation for a vertical 9:16 social short. Preserve exact recurring character identity, face, wool/fur, body proportions, wardrobe, cultural clothing, voice identity and location continuity. Natural expressive acting, readable physical comedy, coherent camera geography, no identity drift.";
const CHARACTER_NEGATIVE =
  "identity drift, face change, random costume change, swapped cultural clothing, duplicate character, extra limbs, malformed hands, text, watermark, logo, slideshow, static image, offensive stereotype";
const GENERAL_STYLE_PROMPT =
  "Cinematic vertical 9:16 short-form video. Preserve subject, wardrobe, product, prop, location and lighting continuity across shots. Clear physical action, coherent camera geography, production-ready composition.";
const GENERAL_NEGATIVE = "identity drift, inconsistent wardrobe, duplicate subject, text, watermark, logo, slideshow, static image, malformed anatomy";

export interface CreationOptions {
  description?: string;
  style?: CreativeStyle;
  storyMode?: StoryMode;
  durationPreset?: DurationPreset;
  projectId?: string;
  projectName?: string;
  projectKind?: ProjectKind;
  projectBible?: ProjectBible;
}

const STYLE_DETAILS: Record<CreativeStyle, string> = {
  realistic: "natural documentary realism",
  cinematic: "cinematic contrast, elegant camera motion, premium commercial polish",
  cozy: "warm soft daylight, inviting textures and intimate camera distance",
  luxury: "refined materials, premium composition and restrained golden highlights",
  street: "energetic street-level camera, tactile preparation/action and lively warmth",
  traditional: "authentic regional environment, clothing, tools and respectful cultural detail",
  playful: "bright playful composition, expressive reactions and crisp comedic timing",
  macro: "extreme macro texture study, precise shallow depth of field",
  workshop: "hands-on workshop energy with visible functional tools and props",
  asmr: "slow satisfying actions with close sound emphasis",
};

export function initAgents(): AgentState[] {
  return AGENT_DEFS.map((a) => ({ id: a.id, name: a.name, status: "pending", logs: [] }));
}

function agent(p: Production, id: AgentId): AgentState { return p.agents.find((a) => a.id === id)!; }
function log(p: Production, id: AgentId, msg: string) {
  const a = agent(p, id);
  a.logs.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
  if (a.logs.length > 40) a.logs.splice(0, a.logs.length - 40);
}
function start(p: Production, id: AgentId, note?: string) {
  const a = agent(p, id);
  if (a.status === "pending") { a.status = "running"; a.startedAt = new Date().toISOString(); }
  if (note) a.note = note;
}
function done(p: Production, id: AgentId, note?: string) {
  const a = agent(p, id); a.status = "done"; a.finishedAt = new Date().toISOString(); if (note) a.note = note;
}

function projectKind(p: Production): ProjectKind { return p.projectKind ?? "mini_food"; }
function projectBibleText(p: Production) {
  const bible = p.projectBible;
  if (!bible) return Object.values(p.visualBible ?? {}).join("; ");
  return JSON.stringify({
    concept: bible.concept,
    visualStyle: bible.visualStyle,
    tone: bible.tone,
    dialects: bible.dialects,
    locations: bible.locations,
    continuityRules: bible.continuityRules,
    negativeRules: bible.negativeRules,
    characters: bible.characters?.map((c) => ({ name: c.displayNameAr ?? c.name, role: c.role, dialect: c.dialect, voiceStyle: c.voiceStyle, visualNotes: c.visualNotes, personality: c.personality })),
  });
}
function promptContract(p: Production, action: string, camera: string) {
  const kind = projectKind(p);
  const bible = projectBibleText(p);
  if (kind === "mini_food") {
    return {
      prompt: `${MINI_FOOD_STYLE_PROMPT} Creative direction: ${STYLE_DETAILS[p.style]}. Story mode: ${p.storyMode}. Visual bible: ${bible}. Scene: ${action}. Camera: ${camera}. Dish: real miniature ${p.dish}.`,
      negativePrompt: MINI_FOOD_NEGATIVE,
    };
  }
  if (kind === "character_series") {
    return {
      prompt: `${CHARACTER_STYLE_PROMPT} Project: ${p.projectName ?? "Character series"}. Project Bible: ${bible}. Creative direction: ${STYLE_DETAILS[p.style]}. Story mode: ${p.storyMode}. Episode: ${p.episodeTitle ?? p.dish}. Scene: ${action}. Camera: ${camera}. Keep every recurring character consistent with the Project Bible and reference-image intent.`,
      negativePrompt: `${CHARACTER_NEGATIVE}${p.projectBible?.negativeRules?.length ? `, ${p.projectBible.negativeRules.join(", ")}` : ""}`,
    };
  }
  return {
    prompt: `${GENERAL_STYLE_PROMPT} Project: ${p.projectName ?? "Kiswani project"}. Project Bible: ${bible}. Creative direction: ${STYLE_DETAILS[p.style]}. Story mode: ${p.storyMode}. Video idea: ${p.episodeTitle ?? p.dish}. Scene: ${action}. Camera: ${camera}.`,
    negativePrompt: `${GENERAL_NEGATIVE}${p.projectBible?.negativeRules?.length ? `, ${p.projectBible.negativeRules.join(", ")}` : ""}`,
  };
}export function createProduction(subject: string, language: "en" | "ar", ownerKey: string, providerChoice?: ProviderChoice, productionId?: string, options: CreationOptions = {}): Production {
  const provider = getVideoProvider(providerChoice);
  const now = new Date().toISOString();
  const kind = options.projectKind ?? "mini_food";
  const p: Production = {
    id: productionId ?? `mb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    dish: subject,
    episodeTitle: subject,
    projectId: options.projectId ?? "minibites",
    projectName: options.projectName ?? "MiniBites",
    projectKind: kind,
    projectBible: options.projectBible ? structuredClone(options.projectBible) : undefined,
    description: options.description,
    style: options.style ?? "cinematic",
    storyMode: options.storyMode ?? (kind === "character_series" ? "funny" : "satisfying"),
    durationPreset: options.durationPreset ?? "standard",
    language,
    audioMode: options.projectBible?.defaultAudioMode ?? (kind === "character_series" ? "hybrid" : "native"),
    kitchenReference: options.projectBible?.kitchenReference ? structuredClone(options.projectBible.kitchenReference) : undefined,
    createdAt: now,
    updatedAt: now,
    status: "planning",
    provider: provider.name,
    providerIsMock: provider.isMock,
    providerChoice,
    planSource: "template",
    agents: initAgents(),
    shots: [],
    approved: false,
    publish: [
      { platform: "youtube", status: "not_connected", requiredAction: "Connect a YouTube OAuth client (see Integrations)." },
      { platform: "tiktok", status: "not_connected", requiredAction: "Connect an approved TikTok developer app (see Integrations)." },
      { platform: "instagram", status: "not_connected", requiredAction: "Connect an Instagram Business account via Facebook Graph API (see Integrations)." },
      { platform: "x", status: "not_connected", requiredAction: "Connect an X/Twitter developer app with media upload scope (see Integrations)." },
      { platform: "snapchat", status: "manual_only", requiredAction: "Direct organic Spotlight publishing uses manual handoff (Download MP4 + Copy Caption)." },
    ],
    ownerKey,
    usage: { submittedShots: 0, completedShots: 0, failedShots: 0, estimatedCostUsd: 0 },
    visualBible: kind === "mini_food" ? {
      environment: options.style === "traditional" ? "authentic miniature regional kitchen" : "consistent premium miniature kitchen",
      scale: "1:12 working kitchen and tools; bite-size edible ingredients",
      lighting: options.style === "cozy" ? "warm soft window light" : "soft controlled food-studio light",
      camera: STYLE_DETAILS[options.style ?? "cinematic"],
      palette: "warm cream, tomato, fresh green and natural food colors",
      hands: "same pair of clean adult hands throughout; no extra fingers",
      props: "same stove, steel pan, board, utensils and serving plate across every shot",
    } : {
      environment: options.projectBible?.locations?.join(" / ") || "project-defined consistent environment",
      scale: "stable character/subject proportions across every shot",
      lighting: options.style === "cozy" ? "warm soft light" : "consistent cinematic lighting",
      camera: STYLE_DETAILS[options.style ?? "cinematic"],
      palette: options.projectBible?.visualStyle || "project-defined visual style",
      hands: "only when required by the scene; anatomically consistent",
      props: "preserve key props and wardrobe throughout the scene sequence",
    },
  };
  start(p, "orchestrator", `Production accepted for "${subject}" in ${p.projectName}.`);
  log(p, "orchestrator", `Project: ${p.projectName} (${kind}). Provider: ${provider.name}${provider.isMock ? " — MOCK, not real video" : ""}`);
  return p;
}

export async function advanceProduction(p: Production): Promise<Production> {
  const store = getStore();
  const provider = getVideoProvider(p.providerChoice);
  try {
    if (p.status === "planning") {
      start(p, "recipe"); start(p, "miniature_director"); start(p, "shot_director");
      const { plan, source } = await createStudioPlan({
        id: p.projectId ?? "minibites",
        name: p.projectName ?? "MiniBites",
        kind: projectKind(p),
        bible: p.projectBible,
      }, p.dish, p.language, {
        description: p.description,
        style: p.style,
        storyMode: p.storyMode,
        durationPreset: p.durationPreset,
        visualBible: p.visualBible,
      });
      p.planSource = source;
      p.recipeSummary = plan.recipeSummary;
      p.miniatureBrief = plan.miniatureBrief;
      p.publishTitle = plan.title;
      p.publishCaption = plan.caption;
      p.publishHashtags = plan.hashtags;
      done(p, "recipe", plan.recipeSummary);
      done(p, "miniature_director", plan.miniatureBrief);
      done(p, "shot_director", `${plan.shots.length} shots, ~${plan.shots.reduce((s, x) => s + x.seconds, 0)}s total`);
      start(p, "prompt");
      p.shots = plan.shots.map((s, i): Shot => {
        const contract = promptContract(p, s.action, s.camera);
        const audioPlan = s.audioPlan ?? (p.audioMode === "hybrid" && s.dialogue ? { audioMode: "hybrid" as const, dialogue: s.dialogue, ambient: s.sound } : { audioMode: p.audioMode ?? "native" as const, ambient: s.sound });
        return {
          id: `shot_${i + 1}`,
          index: i + 1,
          seconds: Math.min(Math.max(Math.round(s.seconds), 3), 8),
          action: s.action,
          camera: s.camera,
          sound: s.sound,
          prompt: contract.prompt,
          negativePrompt: contract.negativePrompt,
          status: "planned",
          attempts: 0,
          audioPlan,
          referenceImageUrl: p.kitchenReference?.imageUrl ?? p.projectBible?.referenceImageUrls?.[0],
        };
      });
      done(p, "prompt", source === "llm" ? "Prompts written by the project-aware planning LLM." : "Project template prompts (no LLM key configured or planner fallback)." );
      if (!provider.configured) {
        p.status = "failed"; p.error = `Video provider not configured. ${provider.configurationHint}`; agent(p, "video").status = "failed"; agent(p, "video").note = p.error;
      } else {
        p.status = "planned"; agent(p, "video").note = "Storyboard ready. Waiting for creator confirmation before paid generation.";
      }
    } else if (p.status === "generating") {
      await advanceGeneration(p);
    } else if (p.status === "review") {
      runReview(p);
    } else if (p.status === "assembling") {
      await runAssembly(p);
    }
  } catch (err) {
    p.error = err instanceof Error ? err.message : "Unexpected pipeline error";
    log(p, "orchestrator", `Error: ${p.error}`);
  }
  p.updatedAt = new Date().toISOString();
  await store.saveProduction(p);
  return p;
}

export async function startGeneration(p: Production): Promise<Production> {
  if (p.status !== "planned") throw new Error("Only a reviewed shot plan can start generation.");
  const provider = getVideoProvider(p.providerChoice);
  if (!provider.configured) throw new Error("The selected video engine is not configured.");
  if (p.shots.length < 1 || p.shots.some((shot) => shot.status !== "planned")) throw new Error("The shot plan is not ready for generation.");
  p.status = "generating"; start(p, "video"); log(p, "video", "Creator confirmed the storyboard and started generation.");
  p.updatedAt = new Date().toISOString(); await getStore().saveProduction(p); return p;
}

export interface ShotPlanEdit {
  id?: string;
  seconds: number;
  action: string;
  camera: string;
  sound: string;
  dialogue?: Shot["audioPlan"] extends { dialogue?: infer D } ? D : never;
  audioPlan?: Shot["audioPlan"];
  referenceImageUrl?: string;
}

export async function reviseShotPlan(p: Production, edits: ShotPlanEdit[]): Promise<Production> {
  if (p.status !== "planned") throw new Error("Shots can only be edited before generation starts.");
  if (!Array.isArray(edits) || edits.length < 3 || edits.length > 9) throw new Error("Keep between 3 and 9 shots.");
  const clean = (value: unknown, label: string, max: number) => {
    if (typeof value !== "string") throw new Error(`${label} is required.`);
    const result = value.replace(/[<>]/g, " ").replace(/\s+/g, " ").trim();
    if (!result || result.length > max) throw new Error(`${label} is empty or too long.`);
    return result;
  };
  p.shots = edits.map((edit, index) => {
    const seconds = Math.round(Number(edit.seconds));
    if (!Number.isFinite(seconds) || seconds < 3 || seconds > 8) throw new Error(`Shot ${index + 1} must be 3–8 seconds.`);
    const action = clean(edit.action, `Shot ${index + 1} action`, 400);
    const camera = clean(edit.camera, `Shot ${index + 1} camera`, 200);
    const sound = clean(edit.sound, `Shot ${index + 1} sound`, 250);
    const contract = promptContract(p, action, camera);
    return {
      id: edit.id && /^shot_[a-zA-Z0-9_-]+$/.test(edit.id) ? edit.id : `shot_${Date.now().toString(36)}_${index + 1}`,
      index: index + 1,
      seconds,
      action,
      camera,
      sound,
      prompt: contract.prompt,
      negativePrompt: contract.negativePrompt,
      status: "planned" as const,
      attempts: 0,
      audioPlan: edit.audioPlan,
      referenceImageUrl: edit.referenceImageUrl ?? p.kitchenReference?.imageUrl,
    };
  });
  agent(p, "shot_director").note = `${p.shots.length} creator-reviewed shots`;
  p.updatedAt = new Date().toISOString();
  await getStore().saveProduction(p);
  return p;
}

const MAX_CONCURRENT = 2;
async function advanceGeneration(p: Production) {
  const provider = getVideoProvider(p.providerChoice);
  for (const shot of p.shots) {
    if (!shot.providerJobId) continue;
    if (shot.status === "submitted" || shot.status === "in_queue" || shot.status === "generating") {
      const st = await provider.getShotStatus(shot.providerJobId);
      if (st.state === "in_queue") { shot.status = "in_queue"; shot.queuePosition = st.queuePosition; }
      else if (st.state === "generating") { shot.status = "generating"; shot.queuePosition = undefined; }
      else if (st.state === "completed") {
        const result = await provider.getShotResult(shot.providerJobId);
        shot.status = "completed"; shot.videoUrl = result.videoUrl; shot.accepted = p.providerIsMock; shot.versions ??= [];
        shot.versions.push({ version: shot.versions.length + 1, videoUrl: result.videoUrl, prompt: shot.prompt, providerJobId: shot.providerJobId, createdAt: new Date().toISOString(), accepted: p.providerIsMock });
        if (result.resolution) p.resolution = result.resolution;
        p.usage ??= { submittedShots: 0, completedShots: 0, failedShots: 0, estimatedCostUsd: null }; p.usage.completedShots += 1; log(p, "video", `Shot ${shot.index} completed.`);
      } else {
        shot.status = "failed"; shot.error = st.error; p.usage ??= { submittedShots: 0, completedShots: 0, failedShots: 0, estimatedCostUsd: null }; p.usage.failedShots += 1; log(p, "video", `Shot ${shot.index} failed: ${st.error}`);
      }
      if (st.logs?.length) { const last = st.logs[st.logs.length - 1]; if (last) log(p, "video", `Shot ${shot.index}: ${last.slice(0, 160)}`); }
    }
  }
  const active = p.shots.filter((s) => ["submitted", "in_queue", "generating"].includes(s.status)).length;
  if (active < MAX_CONCURRENT) {
    const next = p.shots.find((s) => s.status === "planned");
    if (next) {
      const input = { prompt: next.prompt, negativePrompt: next.negativePrompt, seconds: next.seconds, aspectRatio: "9:16" as const };
      const estimatedCost = provider.estimateCostUsd(input);
      const { providerJobId } = await provider.submitShot(input);
      next.providerJobId = providerJobId; next.status = "submitted"; next.attempts += 1; next.estimatedCostUsd = estimatedCost ?? undefined;
      p.usage ??= { submittedShots: 0, completedShots: 0, failedShots: 0, estimatedCostUsd: null }; p.usage.submittedShots += 1;
      p.usage.estimatedCostUsd = estimatedCost === null || p.usage.estimatedCostUsd === null ? null : p.usage.estimatedCostUsd + estimatedCost;
      log(p, "video", `Shot ${next.index} submitted (job ${providerJobId.slice(0, 12)}…).`);
    }
  }
  const unfinished = p.shots.some((s) => ["planned", "submitted", "in_queue", "generating"].includes(s.status));
  if (!unfinished) {
    const failed = p.shots.filter((s) => s.status === "failed");
    done(p, "video", failed.length ? `${failed.length} shot(s) failed — retry available.` : "All shots generated.");
    p.status = "review"; start(p, "continuity"); start(p, "quality");
  }
}

function runReview(p: Production) {
  const completed = p.shots.filter((s) => s.status === "completed");
  const failed = p.shots.filter((s) => s.status === "failed");
  log(p, "continuity", `Verified ${completed.length}/${p.shots.length} shots share one project continuity contract and negative guards.`);
  done(p, "continuity", "Prompt-level Project Bible continuity contract enforced across all shots.");
  if (failed.length) {
    agent(p, "quality").status = "failed"; agent(p, "quality").note = `${failed.length} shot(s) failed generation. Retry them before assembly.`; p.status = "generating"; agent(p, "video").status = "running";
  } else if (completed.length === 0) { p.status = "failed"; p.error = "No shots completed."; }
  else if (p.providerIsMock) { done(p, "quality", "Mock lifecycle check completed; no real media exists."); p.status = "assembling"; start(p, "assembly"); }
  else { agent(p, "quality").note = "All clips generated. Waiting for the creator to accept each clip before assembly."; p.status = "review"; }
}

export async function setShotAcceptance(p: Production, shotId: string, accepted: boolean): Promise<Production> {
  if (p.status !== "review" && p.status !== "changes_requested") throw new Error("Clips can only be reviewed after generation finishes.");
  const shot = p.shots.find((candidate) => candidate.id === shotId);
  if (!shot || shot.status !== "completed" || !shot.videoUrl) throw new Error("This clip is not ready for review.");
  shot.accepted = accepted; const current = shot.versions?.at(-1); if (current) current.accepted = accepted;
  p.updatedAt = new Date().toISOString(); await getStore().saveProduction(p); return p;
}

export async function startAssembly(p: Production): Promise<Production> {
  if (p.status !== "review" && p.status !== "changes_requested") throw new Error("This project is not ready to assemble.");
  if (!p.shots.length || p.shots.some((shot) => shot.status !== "completed" || !shot.videoUrl || !shot.accepted)) throw new Error("Accept every completed clip before creating the final video.");
  done(p, "quality", "Every generated clip was accepted by the creator."); p.status = "assembling"; start(p, "assembly"); p.updatedAt = new Date().toISOString(); await getStore().saveProduction(p); return p;
}

async function runAssembly(p: Production) {
  const completed = p.shots.filter((s) => s.status === "completed" && s.videoUrl);
  if (p.providerIsMock) { done(p, "assembly", "MOCK run — no real clips exist, so no MP4 was assembled."); finishAssembly(p, completed.reduce((s, x) => s + x.seconds, 0)); return; }
  if (p.assemblyJobId) {
    try {
      const st = await getMergeStatus(p.assemblyJobId);
      if (st.state === "in_queue") { log(p, "assembly", `Merge queued${st.queuePosition !== undefined ? ` (position ${st.queuePosition})` : ""}.`); return; }
      if (st.state === "running") return;
      if (st.state === "completed") { p.finalVideoUrl = await getMergeResult(p.assemblyJobId); p.assembled = true; await archiveIfConfigured(p); done(p, "assembly", `Merged ${completed.length} clips into one vertical MP4 (fal ffmpeg).`); finishAssembly(p, completed.reduce((s, x) => s + x.seconds, 0)); return; }
      throw new Error(st.error);
    } catch (err) { const msg = err instanceof Error ? err.message : "merge failed"; log(p, "assembly", `Merge failed: ${msg}`); fallbackToIndividualClips(p, completed, `Automatic merge failed (${msg}).`); return; }
  }
  if (completed.length === 1) { p.finalVideoUrl = completed[0].videoUrl; p.assembled = true; await archiveIfConfigured(p); done(p, "assembly", "Single clip production — no merge needed."); finishAssembly(p, completed[0].seconds); return; }
  if (falAssemblyConfigured() && completed.length > 1) {
    try { const ordered = [...completed].sort((a, b) => a.index - b.index).map((s) => s.videoUrl!); p.assemblyJobId = await submitMerge(ordered); log(p, "assembly", `Submitted ${ordered.length} clips to fal ffmpeg merge (job ${p.assemblyJobId.slice(0, 12)}…).`); return; }
    catch (err) { const msg = err instanceof Error ? err.message : "merge submit failed"; log(p, "assembly", `Merge submit failed: ${msg}`); fallbackToIndividualClips(p, completed, `Automatic merge failed (${msg}).`); return; }
  }
  fallbackToIndividualClips(p, completed, "No merge backend available (set FAL_KEY).");
}

function fallbackToIndividualClips(p: Production, completed: Shot[], reason: string) {
  p.finalVideoUrl = completed[0]?.videoUrl; p.assembled = false; p.assemblyJobId = undefined; done(p, "assembly", `${reason} ${completed.length} real clips remain downloadable individually.`); finishAssembly(p, completed.reduce((s, x) => s + x.seconds, 0));
}

function finishAssembly(p: Production, durationSeconds: number) {
  p.durationSeconds = durationSeconds;
  const defaultCaption = projectKind(p) === "mini_food" ? `Tiny ${p.dish}, made for real.` : `${p.projectName ?? "Kiswani"}: ${p.episodeTitle ?? p.dish}.`;
  const defaultTags = projectKind(p) === "mini_food" ? ["#miniaturecooking", "#tinyfood", "#asmr"] : ["#KiswaniAI", "#AIvideo", "#shorts"];
  const caption = p.publishCaption ?? defaultCaption;
  const hashtags = (p.publishHashtags ?? defaultTags).slice(0, 8);
  const xCaption = `${caption} ${hashtags.slice(0, 3).join(" ")}`.slice(0, 280);
  p.socialPack = {
    tiktokCaption: `${caption}\n\n${hashtags.slice(0, 5).join(" ")}`,
    instagramCaption: `${caption}\n\n${hashtags.join(" ")}`,
    youtubeTitle: (p.publishTitle ?? `${p.episodeTitle ?? p.dish} — ${p.projectName ?? "Kiswani AI"}`).slice(0, 100),
    youtubeDescription: `${caption}\n\n${hashtags.join(" ")}`,
    xTweet: xCaption,
    snapchatCaption: caption.slice(0, 64),
    hashtags,
  };
  p.status = "awaiting_approval"; start(p, "publishing", "Publishing package prepared. Awaiting manual approval.");
}

export async function retryShot(p: Production, shotId: string): Promise<Production> {
  const shot = p.shots.find((s) => s.id === shotId); if (!shot) throw new Error("Shot not found.");
  if (shot.status !== "failed" && shot.status !== "rejected") throw new Error("Only failed or rejected shots can be retried.");
  if (shot.attempts >= 3) throw new Error("Retry limit reached for this shot (3).");
  shot.status = "planned"; shot.error = undefined; shot.providerJobId = undefined; p.status = "generating"; agent(p, "video").status = "running"; log(p, "video", `Shot ${shot.index} queued for retry (attempt ${shot.attempts + 1}).`);
  p.updatedAt = new Date().toISOString(); await getStore().saveProduction(p); return p;
}

export async function duplicateProduction(source: Production): Promise<Production> {
  const duplicate = createProduction(source.dish, source.language, source.ownerKey, source.providerChoice, undefined, {
    description: source.description, style: source.style, storyMode: source.storyMode, durationPreset: source.durationPreset,
    projectId: source.projectId, projectName: source.projectName, projectKind: source.projectKind, projectBible: source.projectBible ? structuredClone(source.projectBible) : undefined,
  });
  duplicate.status = "planned"; duplicate.planSource = source.planSource; duplicate.recipeSummary = source.recipeSummary; duplicate.miniatureBrief = source.miniatureBrief;
  duplicate.visualBible = source.visualBible ? structuredClone(source.visualBible) : undefined; duplicate.publishTitle = source.publishTitle; duplicate.publishCaption = source.publishCaption; duplicate.publishHashtags = source.publishHashtags ? [...source.publishHashtags] : undefined;
  duplicate.audioMode = source.audioMode;
  duplicate.kitchenReference = source.kitchenReference ? structuredClone(source.kitchenReference) : undefined;
  duplicate.shots = source.shots.map((shot, index) => ({
    id: `shot_${index + 1}`,
    index: index + 1,
    seconds: shot.seconds,
    action: shot.action,
    camera: shot.camera,
    sound: shot.sound,
    prompt: shot.prompt,
    negativePrompt: shot.negativePrompt,
    status: "planned",
    attempts: 0,
    audioPlan: shot.audioPlan ? structuredClone(shot.audioPlan) : undefined,
    referenceImageUrl: shot.referenceImageUrl,
  }));
  for (const id of ["recipe", "miniature_director", "shot_director", "prompt"] as AgentId[]) done(duplicate, id, "Reused from the source project's creator-reviewed plan.");
  agent(duplicate, "video").note = "No generated media was copied. Review the plan before starting a new paid generation.";
  duplicate.updatedAt = new Date().toISOString(); await getStore().saveProduction(duplicate); return duplicate;
}

export async function archiveProduction(p: Production): Promise<Production> {
  if (["planning", "generating", "assembling"].includes(p.status)) throw new Error("Wait for the active job or cancel it before archiving.");
  p.archivedAt = new Date().toISOString(); p.updatedAt = p.archivedAt; await getStore().saveProduction(p); return p;
}

async function archiveIfConfigured(p: Production) {
  if (!p.finalVideoUrl || p.providerIsMock) return;
  p.providerFinalVideoUrl ??= p.finalVideoUrl;
  if (!durableMediaConfigured()) { p.mediaStorage = { status: "not_configured", provider: "provider", note: "Using the video provider URL. Connect Vercel Blob for a durable archive." }; return; }
  try { p.finalVideoUrl = await archiveFinalVideo(p.finalVideoUrl, p.id); p.mediaStorage = { status: "archived", provider: "vercel_blob", archivedAt: new Date().toISOString() }; log(p, "assembly", "Final MP4 archived to durable project storage."); }
  catch { p.mediaStorage = { status: "failed", provider: "provider", note: "The final MP4 is available from the video provider, but durable archiving needs retry." }; log(p, "assembly", "Durable archive failed; provider video remains available."); }
}

export async function regenerateShot(p: Production, shotId: string): Promise<Production> {
  if (p.status !== "review" && p.status !== "changes_requested") throw new Error("A completed clip can only be regenerated during review.");
  const shot = p.shots.find((candidate) => candidate.id === shotId);
  if (!shot || shot.status !== "completed" || !shot.videoUrl) throw new Error("This clip is not ready to regenerate.");
  if (shot.attempts >= 3) throw new Error("Retry limit reached for this shot (3).");
  shot.accepted = false; shot.status = "planned"; shot.videoUrl = undefined; shot.error = undefined; shot.providerJobId = undefined; p.status = "generating"; agent(p, "video").status = "running"; agent(p, "quality").status = "running";
  log(p, "video", `Creator requested shot ${shot.index} version ${(shot.versions?.length ?? 0) + 1}; the previous clip remains saved.`);
  p.updatedAt = new Date().toISOString(); await getStore().saveProduction(p); return p;
}

export async function cancelProduction(p: Production): Promise<Production> {
  const provider = getVideoProvider(p.providerChoice);
  for (const shot of p.shots) {
    if (shot.providerJobId && ["submitted", "in_queue", "generating"].includes(shot.status)) { await provider.cancelShot(shot.providerJobId); shot.status = "cancelled"; }
  }
  p.status = "cancelled"; log(p, "orchestrator", "Production cancelled by the owner."); p.updatedAt = new Date().toISOString(); await getStore().saveProduction(p); return p;
}
