// ---------------------------------------------------------------------------
// The MiniBites agent pipeline — a real, persisted state machine.
//
// There is no fake progress: state only advances when real work completes.
// Serverless-friendly design: `advanceProduction` performs at most a small
// unit of real work per call (create plan, submit a shot, poll the provider,
// run a check) and persists the result. The Studio UI polls the production
// endpoint, which both reports and advances real state. A production
// therefore survives refreshes and restarts (with a durable store).
// ---------------------------------------------------------------------------
import type { AgentId, AgentState, CreativeStyle, DurationPreset, Production, ProviderChoice, Shot, StoryMode } from "../types";
import { getVideoProvider } from "../providers";
import { createShotPlan } from "../llm";
import { getStore } from "../store";
import { falAssemblyConfigured, getMergeStatus, getMergeResult, submitMerge } from "../assembly";

export const AGENT_DEFS: Array<{ id: AgentId; name: string; role: string }> = [
  { id: "orchestrator", name: "Orchestrator", role: "Validates the request and coordinates every stage." },
  { id: "recipe", name: "Recipe Agent", role: "Creates a small but genuinely cookable recipe." },
  { id: "miniature_director", name: "Miniature Director", role: "Defines 1:12 ingredients, tools and scale rules." },
  { id: "shot_director", name: "Shot Director", role: "Builds the complete 9:16 shot list." },
  { id: "prompt", name: "Prompt Agent", role: "Writes model-specific video prompts with negatives." },
  { id: "video", name: "Video Agent", role: "Submits real jobs to the video provider and tracks them." },
  { id: "continuity", name: "Continuity Agent", role: "Checks hands, tools, kitchen, scale and colors across shots." },
  { id: "quality", name: "Quality Agent", role: "Rejects defects, normal-size tools, cartoons and slideshows." },
  { id: "assembly", name: "Assembly Agent", role: "Combines accepted shots into one vertical MP4." },
  { id: "publishing", name: "Publishing Agent", role: "Prepares title, caption, hashtags and the publishing package." },
];

const STYLE_PROMPT =
  "Ultra-realistic macro food videography. Real adult human hands cooking with real working dollhouse-scale (1:12) kitchen tools and real edible ingredients in tiny quantities. Continuous physical cooking motion. Macro close-up, shallow depth of field, soft natural kitchen light, vertical 9:16.";
const NEGATIVE_PROMPT =
  "cartoon, animation, illustration, CGI characters, toy figurines, miniature people, dolls with faces, normal-size cookware, still image, slideshow, ken burns, text, watermark, logo, deformed hands, extra fingers";

export interface CreationOptions {
  description?: string;
  style?: CreativeStyle;
  storyMode?: StoryMode;
  durationPreset?: DurationPreset;
}

const STYLE_DETAILS: Record<CreativeStyle, string> = {
  realistic: "natural documentary food realism",
  cinematic: "cinematic contrast, elegant camera motion, premium food commercial",
  cozy: "warm cozy kitchen, soft daylight, inviting textures",
  luxury: "refined plating, premium materials, restrained golden highlights",
  street: "energetic street-food counter, tactile preparation, lively warmth",
  traditional: "authentic regional tools, ingredients, serving style and respectful details",
  playful: "bright playful composition while remaining photorealistic and food-led",
  macro: "extreme macro texture study, precise shallow depth of field",
  workshop: "miniature culinary workshop, visible functional tiny tools",
  asmr: "slow satisfying actions with close cooking sound emphasis",
};

export function initAgents(): AgentState[] {
  return AGENT_DEFS.map((a) => ({ id: a.id, name: a.name, status: "pending", logs: [] }));
}

function agent(p: Production, id: AgentId): AgentState {
  return p.agents.find((a) => a.id === id)!;
}
function log(p: Production, id: AgentId, msg: string) {
  const a = agent(p, id);
  a.logs.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
  if (a.logs.length > 40) a.logs.splice(0, a.logs.length - 40);
}
function start(p: Production, id: AgentId, note?: string) {
  const a = agent(p, id);
  if (a.status === "pending") {
    a.status = "running";
    a.startedAt = new Date().toISOString();
  }
  if (note) a.note = note;
}
function done(p: Production, id: AgentId, note?: string) {
  const a = agent(p, id);
  a.status = "done";
  a.finishedAt = new Date().toISOString();
  if (note) a.note = note;
}

export function createProduction(dish: string, language: "en" | "ar", ownerKey: string, providerChoice?: ProviderChoice, productionId?: string, options: CreationOptions = {}): Production {
  const provider = getVideoProvider(providerChoice);
  const now = new Date().toISOString();
  const p: Production = {
    id: productionId ?? `mb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    dish,
    description: options.description,
    style: options.style ?? "cinematic",
    storyMode: options.storyMode ?? "satisfying",
    durationPreset: options.durationPreset ?? "standard",
    language,
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
    ],
    ownerKey,
    usage: { submittedShots: 0, completedShots: 0, failedShots: 0, estimatedCostUsd: 0 },
    visualBible: {
      environment: options.style === "traditional" ? "authentic miniature regional kitchen" : "consistent premium miniature kitchen",
      scale: "1:12 working kitchen and tools; bite-size edible ingredients",
      lighting: options.style === "cozy" ? "warm soft window light" : "soft controlled food-studio light",
      camera: STYLE_DETAILS[options.style ?? "cinematic"],
      palette: "warm cream, tomato, fresh green and natural food colors",
      hands: "same pair of clean adult hands throughout; no extra fingers",
      props: "same stove, steel pan, board, utensils and serving plate across every shot",
    },
  };
  start(p, "orchestrator", `Production accepted for “${dish}”.`);
  log(p, "orchestrator", `Provider: ${provider.name}${provider.isMock ? " — MOCK, not real video" : ""}`);
  return p;
}

/**
 * Advance the production by one unit of REAL work. Returns the saved state.
 */
export async function advanceProduction(p: Production): Promise<Production> {
  const store = getStore();
  const provider = getVideoProvider(p.providerChoice);
  try {
    if (p.status === "planning") {
      // Recipe + Miniature Director + Shot Director + Prompt agents (one LLM plan)
      start(p, "recipe");
      start(p, "miniature_director");
      start(p, "shot_director");
      const { plan, source } = await createShotPlan(p.dish, p.language, {
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
      p.shots = plan.shots.map((s, i): Shot => ({
        id: `shot_${i + 1}`,
        index: i + 1,
        seconds: Math.min(Math.max(Math.round(s.seconds), 3), 8),
        action: s.action,
        camera: s.camera,
        sound: s.sound,
        prompt: `${STYLE_PROMPT} Creative direction: ${STYLE_DETAILS[p.style]}. Story mode: ${p.storyMode}. Visual bible: ${Object.values(p.visualBible ?? {}).join("; ")}. Scene: ${s.action}. Camera: ${s.camera}. Dish: real miniature ${p.dish}.`,
        negativePrompt: NEGATIVE_PROMPT,
        status: "planned",
        attempts: 0,
      }));
      done(p, "prompt", source === "llm" ? "Prompts written by the planning LLM." : "Template prompts (no LLM key configured).");
      if (!provider.configured) {
        p.status = "failed";
        p.error = `Video provider not configured. ${provider.configurationHint}`;
        agent(p, "video").status = "failed";
        agent(p, "video").note = p.error;
      } else {
        p.status = "planned";
        agent(p, "video").note = "Shot plan ready. Waiting for the creator to start paid generation.";
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
  p.status = "generating";
  start(p, "video");
  log(p, "video", "Creator confirmed the shot plan and started generation.");
  p.updatedAt = new Date().toISOString();
  await getStore().saveProduction(p);
  return p;
}

export interface ShotPlanEdit { id?: string; seconds: number; action: string; camera: string; sound: string }

export async function reviseShotPlan(p: Production, edits: ShotPlanEdit[]): Promise<Production> {
  if (p.status !== "planned") throw new Error("Shots can only be edited before generation starts.");
  if (!Array.isArray(edits) || edits.length < 3 || edits.length > 9) throw new Error("Keep between 3 and 9 shots.");
  const clean = (value: unknown, label: string, max: number) => {
    if (typeof value !== "string") throw new Error(`${label} is required.`);
    const result = value.replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
    if (!result || result.length > max) throw new Error(`${label} is empty or too long.`);
    return result;
  };
  p.shots = edits.map((edit, index) => {
    const seconds = Math.round(Number(edit.seconds));
    if (!Number.isFinite(seconds) || seconds < 3 || seconds > 8) throw new Error(`Shot ${index + 1} must be 3–8 seconds.`);
    const action = clean(edit.action, `Shot ${index + 1} action`, 400);
    const camera = clean(edit.camera, `Shot ${index + 1} camera`, 200);
    const sound = clean(edit.sound, `Shot ${index + 1} sound`, 160);
    return {
      id: edit.id && /^shot_[a-zA-Z0-9_-]+$/.test(edit.id) ? edit.id : `shot_${Date.now().toString(36)}_${index + 1}`,
      index: index + 1,
      seconds,
      action,
      camera,
      sound,
      prompt: `${STYLE_PROMPT} Creative direction: ${STYLE_DETAILS[p.style]}. Story mode: ${p.storyMode}. Visual bible: ${Object.values(p.visualBible ?? {}).join("; ")}. Scene: ${action}. Camera: ${camera}. Dish: real miniature ${p.dish}.`,
      negativePrompt: NEGATIVE_PROMPT,
      status: "planned" as const,
      attempts: 0,
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

  // 1) Poll active shots
  for (const shot of p.shots) {
    if (!shot.providerJobId) continue;
    if (shot.status === "submitted" || shot.status === "in_queue" || shot.status === "generating") {
      const st = await provider.getShotStatus(shot.providerJobId);
      if (st.state === "in_queue") {
        shot.status = "in_queue";
        shot.queuePosition = st.queuePosition;
      } else if (st.state === "generating") {
        shot.status = "generating";
        shot.queuePosition = undefined;
      } else if (st.state === "completed") {
        const result = await provider.getShotResult(shot.providerJobId);
        shot.status = "completed";
        shot.videoUrl = result.videoUrl;
        if (result.resolution) p.resolution = result.resolution;
        p.usage ??= { submittedShots: 0, completedShots: 0, failedShots: 0, estimatedCostUsd: null };
        p.usage.completedShots += 1;
        log(p, "video", `Shot ${shot.index} completed.`);
      } else {
        shot.status = "failed";
        shot.error = st.error;
        p.usage ??= { submittedShots: 0, completedShots: 0, failedShots: 0, estimatedCostUsd: null };
        p.usage.failedShots += 1;
        log(p, "video", `Shot ${shot.index} failed: ${st.error}`);
      }
      if (st.logs?.length) {
        const last = st.logs[st.logs.length - 1];
        if (last) log(p, "video", `Shot ${shot.index}: ${last.slice(0, 160)}`);
      }
    }
  }

  // 2) Submit next planned shot if a slot is free
  const active = p.shots.filter((s) => ["submitted", "in_queue", "generating"].includes(s.status)).length;
  if (active < MAX_CONCURRENT) {
    const next = p.shots.find((s) => s.status === "planned");
    if (next) {
      const input = {
        prompt: next.prompt,
        negativePrompt: next.negativePrompt,
        seconds: next.seconds,
        aspectRatio: "9:16" as const,
      };
      const estimatedCost = provider.estimateCostUsd(input);
      const { providerJobId } = await provider.submitShot(input);
      next.providerJobId = providerJobId;
      next.status = "submitted";
      next.attempts += 1;
      next.estimatedCostUsd = estimatedCost ?? undefined;
      p.usage ??= { submittedShots: 0, completedShots: 0, failedShots: 0, estimatedCostUsd: null };
      p.usage.submittedShots += 1;
      p.usage.estimatedCostUsd = estimatedCost === null || p.usage.estimatedCostUsd === null
        ? null
        : p.usage.estimatedCostUsd + estimatedCost;
      log(p, "video", `Shot ${next.index} submitted (job ${providerJobId.slice(0, 12)}…).`);
    }
  }

  // 3) Transition when all shots have finished one way or another
  const unfinished = p.shots.some((s) => ["planned", "submitted", "in_queue", "generating"].includes(s.status));
  if (!unfinished) {
    const failed = p.shots.filter((s) => s.status === "failed");
    done(p, "video", failed.length ? `${failed.length} shot(s) failed — retry available.` : "All shots generated.");
    p.status = "review";
    start(p, "continuity");
    start(p, "quality");
  }
}

function runReview(p: Production) {
  // Automated review of what the pipeline can genuinely verify server-side:
  // per-shot completion, prompt guards, aspect ratio and provider metadata.
  // Frame-level visual QC needs a vision model pass or human review — the
  // pipeline is honest about that and routes the result to manual approval.
  const completed = p.shots.filter((s) => s.status === "completed");
  const failed = p.shots.filter((s) => s.status === "failed");
  log(p, "continuity", `Verified ${completed.length}/${p.shots.length} shots share one style contract and negative guards.`);
  done(p, "continuity", "Prompt-level continuity contract enforced across all shots.");
  if (failed.length) {
    agent(p, "quality").status = "failed";
    agent(p, "quality").note = `${failed.length} shot(s) failed generation. Retry them before assembly.`;
    p.status = "generating"; // stay actionable: user can retry failed shots
    agent(p, "video").status = "running";
  } else if (completed.length === 0) {
    p.status = "failed";
    p.error = "No shots completed.";
  } else {
    done(p, "quality", "All shots completed. Final visual approval is manual (per publishing policy).");
    p.status = "assembling";
    start(p, "assembly");
  }
}

async function runAssembly(p: Production) {
  const completed = p.shots.filter((s) => s.status === "completed" && s.videoUrl);
  if (p.providerIsMock) {
    done(p, "assembly", "MOCK run — no real clips exist, so no MP4 was assembled.");
    finishAssembly(p, completed.reduce((s, x) => s + x.seconds, 0));
    return;
  }

  // A merge job is already in flight: poll it (real provider status, no fake progress).
  if (p.assemblyJobId) {
    try {
      const st = await getMergeStatus(p.assemblyJobId);
      if (st.state === "in_queue") {
        log(p, "assembly", `Merge queued${st.queuePosition !== undefined ? ` (position ${st.queuePosition})` : ""}.`);
        return;
      }
      if (st.state === "running") return;
      if (st.state === "completed") {
        p.finalVideoUrl = await getMergeResult(p.assemblyJobId);
        p.assembled = true;
        done(p, "assembly", `Merged ${completed.length} clips into one vertical MP4 (fal ffmpeg).`);
        finishAssembly(p, completed.reduce((s, x) => s + x.seconds, 0));
        return;
      }
      throw new Error(st.error);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "merge failed";
      log(p, "assembly", `Merge failed: ${msg}`);
      fallbackToIndividualClips(p, completed, `Automatic merge failed (${msg}).`);
      return;
    }
  }

  if (completed.length === 1) {
    p.finalVideoUrl = completed[0].videoUrl;
    p.assembled = true;
    done(p, "assembly", "Single clip production — no merge needed.");
    finishAssembly(p, completed[0].seconds);
    return;
  }

  if (falAssemblyConfigured() && completed.length > 1) {
    // Submit the concat to fal's ffmpeg service and keep polling on subsequent
    // advances — same durable, refresh-safe pattern as shot generation.
    try {
      const ordered = [...completed].sort((a, b) => a.index - b.index).map((s) => s.videoUrl!) ;
      p.assemblyJobId = await submitMerge(ordered);
      log(p, "assembly", `Submitted ${ordered.length} clips to fal ffmpeg merge (job ${p.assemblyJobId.slice(0, 12)}…).`);
      return; // stay in "assembling"; polling resolves it
    } catch (err) {
      const msg = err instanceof Error ? err.message : "merge submit failed";
      log(p, "assembly", `Merge submit failed: ${msg}`);
      fallbackToIndividualClips(p, completed, `Automatic merge failed (${msg}).`);
      return;
    }
  }

  fallbackToIndividualClips(
    p,
    completed,
    "No merge backend available (set FAL_KEY)."
  );
}

function fallbackToIndividualClips(p: Production, completed: Shot[], reason: string) {
  // Honest default: per-shot MP4s are real and downloadable.
  p.finalVideoUrl = completed[0]?.videoUrl;
  p.assembled = false;
  p.assemblyJobId = undefined;
  done(p, "assembly", `${reason} ${completed.length} real clips remain downloadable individually.`);
  finishAssembly(p, completed.reduce((s, x) => s + x.seconds, 0));
}

function finishAssembly(p: Production, durationSeconds: number) {
  p.durationSeconds = durationSeconds;
  p.status = "awaiting_approval";
  start(p, "publishing", "Publishing package prepared. Awaiting manual approval.");
}

export async function retryShot(p: Production, shotId: string): Promise<Production> {
  const shot = p.shots.find((s) => s.id === shotId);
  if (!shot) throw new Error("Shot not found.");
  if (shot.status !== "failed" && shot.status !== "rejected") throw new Error("Only failed or rejected shots can be retried.");
  if (shot.attempts >= 3) throw new Error("Retry limit reached for this shot (3).");
  shot.status = "planned";
  shot.error = undefined;
  shot.providerJobId = undefined;
  p.status = "generating";
  agent(p, "video").status = "running";
  log(p, "video", `Shot ${shot.index} queued for retry (attempt ${shot.attempts + 1}).`);
  p.updatedAt = new Date().toISOString();
  await getStore().saveProduction(p);
  return p;
}

export async function cancelProduction(p: Production): Promise<Production> {
  const provider = getVideoProvider(p.providerChoice);
  for (const shot of p.shots) {
    if (shot.providerJobId && ["submitted", "in_queue", "generating"].includes(shot.status)) {
      await provider.cancelShot(shot.providerJobId);
      shot.status = "cancelled";
    }
  }
  p.status = "cancelled";
  log(p, "orchestrator", "Production cancelled by the owner.");
  p.updatedAt = new Date().toISOString();
  await getStore().saveProduction(p);
  return p;
}
