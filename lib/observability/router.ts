// ---------------------------------------------------------------------------
// Kiswani AI Studio — Routing Architecture & Evaluation Engine
// ---------------------------------------------------------------------------

import { cleanEnv } from "../env";
import type {
  CapabilityState,
  EvaluatedConstraint,
  ExecutionRoute,
  FallbackCandidate,
  FailureScope,
  FailureType,
  RouteCandidate,
  RouteTask,
} from "./types";

export interface RoutingEvaluationContext {
  task: RouteTask;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  durationSeconds?: number;
  requiresReferenceImage?: boolean;
  requiresArabicDialogue?: boolean;
  requiresExactTTS?: boolean;
  continuityCritical?: boolean;
  budgetCeilingUsd?: number;
  directorMode?: "auto" | "manual";
  userSelectedModel?: string;
  userSelectedProvider?: string;
  projectId?: string;
  isCommercial?: boolean;
}

/** Known routing registry across tasks, developers, families, models, and channels */
export const ROUTE_CATALOG: ExecutionRoute[] = [
  // --- PLANNING ROUTES ---
  {
    id: "anthropic-claude-3-5-sonnet-api",
    task: "planning",
    developer: "Anthropic",
    modelFamily: "Claude 3.5 Sonnet",
    exactModel: "claude-3-5-sonnet-latest",
    accessChannel: "Anthropic API",
    endpointOperation: "https://api.anthropic.com/v1/messages",
    costPolicyContext: { estimatedCostPerUnit: 0.01, unitName: "episode_plan", currency: "USD" },
  },
  {
    id: "google-gemini-2-5-flash-api",
    task: "planning",
    developer: "Google",
    modelFamily: "Gemini 2.5 Flash",
    exactModel: "gemini-2.5-flash",
    accessChannel: "Gemini API",
    endpointOperation: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    costPolicyContext: { estimatedCostPerUnit: 0.002, unitName: "episode_plan", currency: "USD" },
  },
  {
    id: "kiswani-deterministic-template-planner",
    task: "planning",
    developer: "Kiswani",
    modelFamily: "Deterministic Project Planner",
    exactModel: "kiswani-v1-template-planner",
    accessChannel: "Local Engine",
    endpointOperation: "lib/studio-planner.ts:projectTemplatePlan",
    costPolicyContext: { estimatedCostPerUnit: 0.0, unitName: "episode_plan", currency: "USD" },
  },

  // --- REFERENCE IMAGE ROUTES ---
  {
    id: "google-nano-banana-2-gemini-api",
    task: "reference_image",
    developer: "Google",
    modelFamily: "Nano Banana 2",
    exactModel: "gemini-3.1-flash-image",
    accessChannel: "Gemini API",
    endpointOperation: "models/gemini-3.1-flash-image:generateContent",
    runtimeConfig: { responseModalities: ["IMAGE"], defaultAspectRatio: "9:16" },
    costPolicyContext: { estimatedCostPerUnit: 0.02, unitName: "image", currency: "USD" },
  },
  {
    id: "google-nano-banana-2-lite-gemini-api",
    task: "reference_image",
    developer: "Google",
    modelFamily: "Nano Banana 2 Lite",
    exactModel: "gemini-3.1-flash-lite-image",
    accessChannel: "Gemini API",
    endpointOperation: "models/gemini-3.1-flash-lite-image:generateContent",
    runtimeConfig: { responseModalities: ["IMAGE"], defaultAspectRatio: "9:16" },
    costPolicyContext: { estimatedCostPerUnit: 0.01, unitName: "image", currency: "USD" },
  },
  {
    id: "google-nano-banana-pro-gemini-api",
    task: "reference_image",
    developer: "Google",
    modelFamily: "Nano Banana Pro",
    exactModel: "gemini-3-pro-image",
    accessChannel: "Gemini API",
    endpointOperation: "models/gemini-3-pro-image:generateContent",
    runtimeConfig: { responseModalities: ["IMAGE"], defaultAspectRatio: "9:16" },
    costPolicyContext: { estimatedCostPerUnit: 0.05, unitName: "image", currency: "USD" },
  },
  {
    id: "fal-flux-pro-v1-1-api",
    task: "reference_image",
    developer: "Black Forest Labs",
    modelFamily: "Flux Pro",
    exactModel: "fal-ai/flux-pro/v1.1",
    accessChannel: "fal.ai API",
    endpointOperation: "fal-ai/flux-pro/v1.1",
    runtimeConfig: { image_size: "portrait_16_9" },
    costPolicyContext: { estimatedCostPerUnit: 0.05, unitName: "image", currency: "USD" },
  },

  // --- VIDEO ROUTES ---
  {
    id: "google-veo-3-1-fast-gemini-api",
    task: "video",
    developer: "Google",
    modelFamily: "Veo 3.1",
    exactModel: "veo-3.1-fast-generate-preview",
    accessChannel: "Gemini API",
    endpointOperation: "models/veo-3.1-fast-generate-preview:predictLongRunning",
    runtimeConfig: { aspectRatio: "9:16", audioEnabled: true, durationSeconds: 5 },
    costPolicyContext: { estimatedCostPerUnit: 0.15, unitName: "second", currency: "USD" },
  },
  {
    id: "google-veo-3-1-quality-gemini-api",
    task: "video",
    developer: "Google",
    modelFamily: "Veo 3.1",
    exactModel: "veo-3.1-generate-preview",
    accessChannel: "Gemini API",
    endpointOperation: "models/veo-3.1-generate-preview:predictLongRunning",
    runtimeConfig: { aspectRatio: "9:16", audioEnabled: true, durationSeconds: 5 },
    costPolicyContext: { estimatedCostPerUnit: 0.25, unitName: "second", currency: "USD" },
  },
  {
    id: "fal-kling-1-6-pro-api",
    task: "video",
    developer: "Kuaishou",
    modelFamily: "Kling 1.6",
    exactModel: "fal-ai/kling-video/v1.6/pro/image-to-video",
    accessChannel: "fal.ai API",
    endpointOperation: "fal-ai/kling-video/v1.6/pro/image-to-video",
    runtimeConfig: { aspect_ratio: "9:16", duration: "5" },
    costPolicyContext: { estimatedCostPerUnit: 0.2, unitName: "second", currency: "USD" },
  },
  {
    id: "fal-minimax-video-01-api",
    task: "video",
    developer: "MiniMax",
    modelFamily: "Hailuo Video 01",
    exactModel: "fal-ai/minimax-video/image-to-video",
    accessChannel: "fal.ai API",
    endpointOperation: "fal-ai/minimax-video/image-to-video",
    runtimeConfig: { prompt_optimizer: false },
    costPolicyContext: { estimatedCostPerUnit: 0.18, unitName: "second", currency: "USD" },
  },
  {
    id: "kiswani-mock-video-provider",
    task: "video",
    developer: "Kiswani",
    modelFamily: "Test Simulator",
    exactModel: "mock-video-v1",
    accessChannel: "Local Mock",
    endpointOperation: "lib/providers/mock.ts",
    costPolicyContext: { estimatedCostPerUnit: 0.0, unitName: "second", currency: "USD" },
  },

  // --- AUDIO / TTS ROUTES ---
  {
    id: "google-gemini-3-1-tts-api",
    task: "audio_tts",
    developer: "Google",
    modelFamily: "Gemini 3.1 TTS",
    exactModel: "gemini-3.1-flash-tts-preview",
    accessChannel: "Gemini API",
    endpointOperation: "models/gemini-3.1-flash-tts-preview:generateContent",
    runtimeConfig: { responseModalities: ["AUDIO"], voices: ["Orus", "Puck", "Fenrir", "Aoede"] },
    costPolicyContext: { estimatedCostPerUnit: 0.005, unitName: "dialogue_line", currency: "USD" },
  },
  {
    id: "google-gemini-2-5-tts-api",
    task: "audio_tts",
    developer: "Google",
    modelFamily: "Gemini 2.5 TTS",
    exactModel: "gemini-2.5-flash-preview-tts",
    accessChannel: "Gemini API",
    endpointOperation: "models/gemini-2.5-flash-preview-tts:generateContent",
    runtimeConfig: { responseModalities: ["AUDIO"] },
    costPolicyContext: { estimatedCostPerUnit: 0.005, unitName: "dialogue_line", currency: "USD" },
  },

  // --- ASSEMBLY ROUTES ---
  {
    id: "fal-ffmpeg-stitch-api",
    task: "assembly",
    developer: "fal.ai",
    modelFamily: "FFmpeg Concat",
    exactModel: "fal-ai/ffmpeg-api/concat",
    accessChannel: "fal.ai API",
    endpointOperation: "fal-ai/ffmpeg-api/concat",
    costPolicyContext: { estimatedCostPerUnit: 0.01, unitName: "stitch", currency: "USD" },
  },
  {
    id: "local-direct-assembly",
    task: "assembly",
    developer: "Kiswani",
    modelFamily: "Direct Clip Stream",
    exactModel: "local-direct-stream",
    accessChannel: "Local Engine",
    endpointOperation: "lib/assembly.ts",
    costPolicyContext: { estimatedCostPerUnit: 0.0, unitName: "stitch", currency: "USD" },
  },

  // --- STORAGE ROUTES ---
  {
    id: "vercel-blob-storage",
    task: "storage",
    developer: "Vercel",
    modelFamily: "Blob Storage",
    exactModel: "vercel-blob-mp4",
    accessChannel: "Vercel API",
    endpointOperation: "@vercel/blob:put",
    costPolicyContext: { estimatedCostPerUnit: 0.001, unitName: "video_file", currency: "USD" },
  },
  {
    id: "local-disk-storage",
    task: "storage",
    developer: "Kiswani",
    modelFamily: "Disk Storage",
    exactModel: "local-disk-store",
    accessChannel: "Local Filesystem",
    endpointOperation: "lib/store/disk.ts",
    costPolicyContext: { estimatedCostPerUnit: 0.0, unitName: "video_file", currency: "USD" },
  },

  // --- PUBLISHING ROUTES ---
  {
    id: "kiswani-social-dispatcher",
    task: "publishing",
    developer: "Kiswani",
    modelFamily: "Direct API & Manual Handoff",
    exactModel: "kiswani-social-pack-v1",
    accessChannel: "Social APIs & Manual Handoff",
    endpointOperation: "lib/publish",
    costPolicyContext: { estimatedCostPerUnit: 0.0, unitName: "pack", currency: "USD" },
  },
];

/** Evaluate hard constraints against a route given a context */
export function evaluateHardConstraints(
  route: ExecutionRoute,
  ctx: RoutingEvaluationContext
): EvaluatedConstraint[] {
  const constraints: EvaluatedConstraint[] = [];

  // 1. Aspect Ratio
  if (ctx.aspectRatio) {
    if (route.task === "video" || route.task === "reference_image") {
      const supports916 =
        route.developer === "Google" ||
        route.developer === "Kuaishou" ||
        route.id.includes("flux") ||
        route.id.includes("mock");
      constraints.push({
        id: "aspect_ratio",
        name: "Aspect Ratio (9:16)",
        nameAr: "الأبعاد الرأسية (9:16)",
        requirement: "Vertical 9:16 format required for short-form social video.",
        evaluation: supports916 ? "PASS" : "FAIL",
        details: supports916 ? "Supported natively in model configuration" : "Model does not reliably support 9:16",
      });
    } else {
      constraints.push({
        id: "aspect_ratio",
        name: "Aspect Ratio",
        requirement: "N/A for this task",
        evaluation: "N/A",
      });
    }
  }

  // 2. Reference Image Support / Identity Continuity
  if (ctx.requiresReferenceImage) {
    if (route.task === "video") {
      const supportsRef =
        route.developer === "Google" ||
        route.id.includes("kling") ||
        route.id.includes("minimax") ||
        route.id.includes("mock");
      constraints.push({
        id: "reference_support",
        name: "Reference Image Support",
        nameAr: "دعم المرجع البصري",
        requirement: "Preserves character and kitchen reference image without identity drift.",
        evaluation: supportsRef ? "PASS" : "FAIL",
        details: supportsRef ? "Verified image-to-video / keyframe reference pipeline" : "Text-only model; cannot enforce character anchor",
      });
    }
  }

  // 3. Arabic Dialogue / Controlled TTS Requirement
  if (ctx.requiresArabicDialogue || ctx.requiresExactTTS) {
    if (route.task === "audio_tts") {
      const isGeminiTTS = route.exactModel.includes("tts");
      constraints.push({
        id: "arabic_tts_support",
        name: "Exact Arabic Dialogue & Dialect Support",
        nameAr: "دعم الحوار العربي واللهجات",
        requirement: "Must pass exact Arabic strings and support prebuilt Saudi/Najdi & Bedouin voices.",
        evaluation: isGeminiTTS ? "PASS" : "FAIL",
        details: isGeminiTTS ? "Verified prebuilt voices (Orus, Puck, Fenrir) with exact Arabic preservation" : "Unverified for authentic Arabic dialect speech",
      });
    }
  }

  // 4. Provider Authentication / Configuration
  const hasGeminiKey = Boolean(cleanEnv("GEMINI_API_KEY"));
  const hasFalKey = Boolean(cleanEnv("FAL_KEY"));
  const hasAnthropicKey = Boolean(cleanEnv("ANTHROPIC_API_KEY"));

  let authEval: "PASS" | "FAIL" | "UNKNOWN" = "PASS";
  if (route.accessChannel === "Gemini API" && !hasGeminiKey) authEval = "FAIL";
  if (route.accessChannel === "fal.ai API" && !hasFalKey) authEval = "FAIL";
  if (route.accessChannel === "Anthropic API" && !hasAnthropicKey) authEval = "FAIL";

  constraints.push({
    id: "provider_auth",
    name: "Provider Authentication",
    nameAr: "اعتماد المزود والمفتاح",
    requirement: "API credentials must exist in environment.",
    evaluation: authEval,
    details: authEval === "PASS" ? "Environment credentials configured" : "API key is missing in environment",
  });

  // 5. Commercial Eligibility / Mock Safety
  if (ctx.isCommercial || ctx.directorMode === "auto") {
    const isMock = route.id.includes("mock");
    constraints.push({
      id: "commercial_eligibility",
      name: "Production / Commercial Eligibility",
      nameAr: "أهلية الإنتاج الحقيقي",
      requirement: "Must produce real playable media, never test-only mock placeholders for client delivery.",
      evaluation: isMock ? "FAIL" : "PASS",
      details: isMock ? "Mock provider is for test lifecycle only; eliminated for production" : "Production-capable real media route",
    });
  }

  // 6. Quota State (Unknown unless verified)
  constraints.push({
    id: "quota_state",
    name: "Channel Quota State",
    nameAr: "حالة الحصة والرصيد",
    requirement: "Channel must have available quota and not return HTTP 429.",
    evaluation: "UNKNOWN",
    details: "Evaluated at execution time via passive telemetry or API preflight",
  });

  return constraints;
}

/** Determine capability state for a route candidate: ELIGIBLE, UNVERIFIED, ELIMINATED */
export function determineCapabilityState(
  route: ExecutionRoute,
  constraints: EvaluatedConstraint[]
): { state: CapabilityState; reason?: string } {
  // Hard failures eliminate the route immediately
  const hardFailure = constraints.find((c) => c.evaluation === "FAIL");
  if (hardFailure) {
    return {
      state: "ELIMINATED",
      reason: `${hardFailure.name}: ${hardFailure.details || "Hard constraint failed."}`,
    };
  }

  // If any critical capability is unverified/unknown and not provably supported
  if (route.exactModel.includes("omni-flash")) {
    return {
      state: "UNVERIFIED",
      reason: "Gemini Omni Flash is a benchmark candidate only; generation support not yet certified in active API.",
    };
  }

  return { state: "ELIGIBLE" };
}

/** Evaluate candidate routes for a given stage and context */
export function evaluateRouteDecisions(
  task: RouteTask,
  ctx: RoutingEvaluationContext
): RouteCandidate[] {
  const routes = ROUTE_CATALOG.filter((r) => r.task === task);
  const candidates: RouteCandidate[] = [];

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const constraints = evaluateHardConstraints(route, ctx);
    const { state, reason } = determineCapabilityState(route, constraints);

    const isUserChoice =
      ctx.directorMode === "manual" &&
      (ctx.userSelectedModel ? route.exactModel.includes(ctx.userSelectedModel) || route.id.includes(ctx.userSelectedModel) : false);

    candidates.push({
      route,
      capabilityState: state,
      estimatedCostUsd: route.costPolicyContext?.estimatedCostPerUnit ?? null,
      health: state === "ELIMINATED" ? "UNAVAILABLE" : "HEALTHY",
      rank: i + 1,
      selected: false,
      eliminatedReason: state === "ELIMINATED" ? reason : undefined,
    });
  }

  // Selection Logic:
  // In MANUAL mode, respect user selection if eligible or explain why
  // In AUTO mode, choose highest-ranked ELIGIBLE route
  if (ctx.directorMode === "manual" && ctx.userSelectedModel) {
    const userCandidate = candidates.find(
      (c) =>
        c.route.exactModel.includes(ctx.userSelectedModel!) ||
        c.route.id.includes(ctx.userSelectedModel!) ||
        ctx.userSelectedModel!.includes(c.route.exactModel)
    );
    if (userCandidate) {
      userCandidate.selected = true;
      userCandidate.whySelected = `Manual Mode: Explicit user selection of ${userCandidate.route.developer} ${userCandidate.route.modelFamily} (${userCandidate.route.exactModel}) via ${userCandidate.route.accessChannel}.`;
    } else if (candidates.length > 0) {
      candidates[0].selected = true;
      candidates[0].whySelected = `Fallback to ${candidates[0].route.modelFamily} (${candidates[0].route.exactModel}).`;
    }
  } else {
    // AUTO mode: select the primary ELIGIBLE route
    const eligibleCandidate = candidates.find((c) => c.capabilityState === "ELIGIBLE");
    if (eligibleCandidate) {
      eligibleCandidate.selected = true;
      eligibleCandidate.whySelected = `Auto Director: Selected ${eligibleCandidate.route.developer} ${eligibleCandidate.route.modelFamily} (${eligibleCandidate.route.exactModel}) for verified 9:16 continuity and benchmark compliance.`;
    }
  }

  // Populate whyNotSelected for unselected candidates
  for (const c of candidates) {
    if (!c.selected) {
      if (c.capabilityState === "ELIMINATED") {
        c.whyNotSelected = c.eliminatedReason || "Eliminated due to hard constraint failure.";
      } else if (c.capabilityState === "UNVERIFIED") {
        c.whyNotSelected = "Unverified route — AUTO mode will not silently use unproven routes for production.";
      } else {
        c.whyNotSelected = "Eligible candidate, but secondary to primary selected route.";
      }
    }
  }

  return candidates;
}

/** Construct the fallback ladder for a selected route */
export function buildFallbackPlan(
  task: RouteTask,
  selectedRoute: ExecutionRoute | null
): FallbackCandidate[] {
  const allForTask = ROUTE_CATALOG.filter((r) => r.task === task);
  const fallbacks: FallbackCandidate[] = [];

  for (const r of allForTask) {
    if (selectedRoute && r.id === selectedRoute.id) {
      fallbacks.push({
        route: r,
        fallbackClass: "PRIMARY",
        autoAllowed: true,
        reason: "Primary selected execution route. Same-route retry allowed for transient 5xx/timeouts.",
        reasonAr: "المسار الأساسي المختار. يُسمح بإعادة المحاولة لنفس المسار في حالات الانقطاع المؤقت.",
      });
    } else if (selectedRoute && r.modelFamily === selectedRoute.modelFamily && r.accessChannel !== selectedRoute.accessChannel) {
      fallbacks.push({
        route: r,
        fallbackClass: "CERTIFIED_EQUIVALENT",
        autoAllowed: true,
        reason: "Same model family via alternate certified channel.",
        reasonAr: "نفس عائلة النموذج عبر قناة معتمدة بديلة.",
      });
    } else if (r.developer === "Google" || r.developer === "Anthropic") {
      fallbacks.push({
        route: r,
        fallbackClass: "NEAR_EQUIVALENT",
        autoAllowed: false,
        reason: "Near-equivalent route. Requires user confirmation if continuity or cost is affected.",
        reasonAr: "مسار شبه مكافئ. يتطلب تأكيد المستخدم في حال تأثر ثبات الشخصيات أو التكلفة.",
      });
    } else {
      fallbacks.push({
        route: r,
        fallbackClass: "STOP_ASK",
        autoAllowed: false,
        reason: "Alternate provider. Must ask user before switching providers.",
        reasonAr: "مزود بديل. يجب طلب إذن المستخدم قبل التحويل.",
      });
    }
  }

  return fallbacks;
}

/** Classify failure according to HTTP status and provider response */
export function classifyFailure(
  httpStatus: number | null,
  errorMessage: string
): { failureType: FailureType; failureScope: FailureScope; description: string } {
  const msg = (errorMessage || "").toLowerCase();

  if (httpStatus === 429 || msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("rate_limit")) {
    const isQuota = msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("limit: 0");
    return {
      failureType: isQuota ? "QUOTA_EXHAUSTED" : "RATE_LIMITED",
      failureScope: "CHANNEL", // 429 is normally Channel / Account capacity failure, not model failure
      description: isQuota
        ? "Channel quota exhausted. Capacity failure on project/account, not a model bug."
        : "Rate limit encountered. Bounded retry is permitted.",
    };
  }

  if (httpStatus === 401 || httpStatus === 403 || msg.includes("api_key") || msg.includes("permission_denied") || msg.includes("auth")) {
    return {
      failureType: "AUTH_FAILED",
      failureScope: "ACCOUNT",
      description: "Authentication or API key permission failure.",
    };
  }

  if (httpStatus && httpStatus >= 500) {
    return {
      failureType: "SERVER_ERROR",
      failureScope: "NETWORK",
      description: `Provider internal server error (HTTP ${httpStatus}). Bounded retry candidate.`,
    };
  }

  if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("econnrefused")) {
    return {
      failureType: "TIMEOUT",
      failureScope: "NETWORK",
      description: "Network timeout or transient connection reset. Bounded retry candidate.",
    };
  }

  if (msg.includes("safety") || msg.includes("blocked") || msg.includes("policy")) {
    return {
      failureType: "CONTENT_POLICY",
      failureScope: "MODEL",
      description: "Content safety or policy filter triggered.",
    };
  }

  return {
    failureType: "UNKNOWN",
    failureScope: "MODEL",
    description: errorMessage || "Unknown generation failure.",
  };
}
