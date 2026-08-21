// ---------------------------------------------------------------------------
// Kiswani AI Studio — Backend Observatory Telemetry & Tracker
// ---------------------------------------------------------------------------

import type { Production } from "../types";
import { sanitizeObject } from "./sanitize";
import {
  buildFallbackPlan,
  evaluateHardConstraints,
  evaluateRouteDecisions,
  ROUTE_CATALOG,
} from "./router";
import type {
  ObservatoryEvent,
  ObservatoryEventType,
  ObservatoryRun,
  QualityReviewRecord,
  RouteAttempt,
  RouteTask,
  StageGraphNode,
} from "./types";

// Persistent in-memory map of attempts and events by production ID
declare global {
  // eslint-disable-next-line no-var
  var __kiswaniObservatoryAttempts: Map<string, RouteAttempt[]> | undefined;
  // eslint-disable-next-line no-var
  var __kiswaniObservatoryEvents: Map<string, ObservatoryEvent[]> | undefined;
  // eslint-disable-next-line no-var
  var __kiswaniQualityReviews: Map<string, QualityReviewRecord> | undefined;
}

if (!globalThis.__kiswaniObservatoryAttempts) globalThis.__kiswaniObservatoryAttempts = new Map();
if (!globalThis.__kiswaniObservatoryEvents) globalThis.__kiswaniObservatoryEvents = new Map();
if (!globalThis.__kiswaniQualityReviews) globalThis.__kiswaniQualityReviews = new Map();

export function recordAttempt(prodId: string, attempt: Omit<RouteAttempt, "id">): RouteAttempt {
  const attempts = globalThis.__kiswaniObservatoryAttempts!.get(prodId) ?? [];
  const fullAttempt: RouteAttempt = {
    ...attempt,
    id: `att_${Date.now().toString(36)}_${attempts.length + 1}`,
  };
  attempts.push(fullAttempt);
  globalThis.__kiswaniObservatoryAttempts!.set(prodId, attempts);
  return fullAttempt;
}

export function getAttempts(prodId: string): RouteAttempt[] {
  return globalThis.__kiswaniObservatoryAttempts!.get(prodId) ?? [];
}

export function recordEvent(
  prodId: string,
  eventType: ObservatoryEventType,
  stage: string,
  severity: ObservatoryEvent["severity"],
  message: string,
  messageAr?: string,
  metadata?: Record<string, unknown>
): ObservatoryEvent {
  const events = globalThis.__kiswaniObservatoryEvents!.get(prodId) ?? [];
  const event: ObservatoryEvent = {
    id: `evt_${Date.now().toString(36)}_${events.length + 1}`,
    timestamp: new Date().toISOString(),
    eventType,
    stage,
    severity,
    message,
    messageAr,
    metadata: metadata ? (sanitizeObject(metadata) as Record<string, unknown>) : undefined,
  };
  events.push(event);
  globalThis.__kiswaniObservatoryEvents!.set(prodId, events);
  return event;
}

export function getEvents(prodId: string): ObservatoryEvent[] {
  return globalThis.__kiswaniObservatoryEvents!.get(prodId) ?? [];
}

export function setQualityReview(prodId: string, review: QualityReviewRecord) {
  globalThis.__kiswaniQualityReviews!.set(prodId, review);
}

export function getQualityReview(prodId: string): QualityReviewRecord {
  return (
    globalThis.__kiswaniQualityReviews!.get(prodId) ?? {
      technicalValidation: {
        assetExists: false,
        durationSeconds: null,
        resolution: null,
        aspectRatio: "9:16",
        audioPresent: false,
        playable: false,
      },
      humanQualityState: "NOT_REVIEWED",
    }
  );
}

/** Build Stage Graph Nodes for a Production */
export function buildStageGraph(p: Production): StageGraphNode[] {
  const statusMap = {
    planning: (p.status === "planning" ? "PLANNING" : "SUCCESS") as StageGraphNode["status"],
    reference_image: (p.status === "planning"
      ? "NOT_STARTED"
      : p.kitchenReference?.imageUrl || p.projectBible?.referenceImageUrls?.[0]
      ? "SUCCESS"
      : "PREFLIGHT") as StageGraphNode["status"],
    audio_tts: (p.status === "planning"
      ? "NOT_STARTED"
      : p.audioMode === "hybrid" || p.audioMode === "exact_tts"
      ? "SUCCESS"
      : "SKIPPED") as StageGraphNode["status"],
    video: (p.status === "planning" || p.status === "planned"
      ? "PREFLIGHT"
      : p.status === "generating"
      ? "RUNNING"
      : p.status === "failed"
      ? "FAILED"
      : "SUCCESS") as StageGraphNode["status"],
    assembly: (p.status === "assembling"
      ? "RUNNING"
      : p.assembled
      ? "SUCCESS"
      : ["awaiting_approval", "approved", "completed"].includes(p.status)
      ? "SUCCESS"
      : "NOT_STARTED") as StageGraphNode["status"],
    quality: (p.status === "review"
      ? "RUNNING"
      : ["awaiting_approval", "approved", "completed"].includes(p.status)
      ? "SUCCESS"
      : "NOT_STARTED") as StageGraphNode["status"],
    approval: (p.approved
      ? "SUCCESS"
      : p.status === "awaiting_approval"
      ? "WAITING_FOR_APPROVAL"
      : "NOT_STARTED") as StageGraphNode["status"],
  };

  return [
    { id: "planning", label: "Plan & Script", labelAr: "التخطيط والسيناريو", status: statusMap.planning, order: 1 },
    {
      id: "reference_image",
      label: "Visual Reference",
      labelAr: "المرجع البصري",
      status: statusMap.reference_image,
      order: 2,
      selectedModel: p.selectedImageModel || "gemini-3.1-flash-image",
    },
    {
      id: "audio_tts",
      label: "Arabic Speech (TTS)",
      labelAr: "الدبلجة الصوتية",
      status: statusMap.audio_tts,
      order: 3,
      selectedModel: p.selectedTTSModel || "gemini-3.1-flash-tts-preview",
    },
    {
      id: "video",
      label: "Video Generation",
      labelAr: "توليد الفيديو",
      status: statusMap.video,
      order: 4,
      selectedModel: p.selectedVideoModel || p.provider,
    },
    { id: "assembly", label: "Assembly & Sync", labelAr: "المونتاج والتجميع", status: statusMap.assembly, order: 5 },
    { id: "approval", label: "Quality Review & Approval", labelAr: "المراجعة والاعتماد", status: statusMap.approval, order: 6 },
  ];
}

/** Convert a production into a complete ObservatoryRun */
export function productionToObservatoryRun(p: Production): ObservatoryRun {
  const attempts = getAttempts(p.id);
  const events = getEvents(p.id);
  const quality = getQualityReview(p.id);

  // If no events recorded yet, initialize baseline lifecycle events
  if (events.length === 0) {
    events.push({
      id: `evt_init_1`,
      timestamp: p.createdAt,
      stage: "planning",
      severity: "INFO",
      eventType: "REQUEST_RECEIVED",
      message: `Production request received for "${p.episodeTitle ?? p.dish}" in ${p.projectName ?? "Studio"}.`,
      messageAr: `تم استلام طلب الإنتاج لحلقة «${p.episodeTitle ?? p.dish}» في مشروع ${p.projectName ?? "الاستوديو"}.`,
    });
    if (p.projectBible) {
      events.push({
        id: `evt_init_2`,
        timestamp: p.createdAt,
        stage: "planning",
        severity: "INFO",
        eventType: "PROJECT_BIBLE_LOADED",
        message: `Project Bible loaded: ${p.projectBible.concept.slice(0, 100)}...`,
        messageAr: `تم تحميل دليل المشروع الإرشادي وثبات الشخصيات.`,
      });
    }
  }

  // Selected vs Actual
  const selectedRoute =
    ROUTE_CATALOG.find((r) => r.exactModel === p.selectedVideoModel || r.id.includes(p.providerChoice ?? "")) ??
    ROUTE_CATALOG.find((r) => r.task === "video" && r.developer === "Google") ??
    null;

  // Actual model starts null or 'NOT RUN YET' before real execution
  const completedShotWithRealMedia = p.shots.find((s) => s.status === "completed" && s.videoUrl && !p.providerIsMock);
  const actualModel = completedShotWithRealMedia ? selectedRoute?.exactModel ?? p.selectedVideoModel ?? p.provider : null;
  const actualRoute = completedShotWithRealMedia ? selectedRoute : null;
  const realExecution = Boolean(completedShotWithRealMedia) || attempts.some((a) => a.realExecution && a.result === "SUCCESS");

  const ctx = {
    task: "video" as RouteTask,
    aspectRatio: "9:16" as const,
    durationSeconds: p.durationSeconds || 30,
    requiresReferenceImage: Boolean(p.projectKind === "character_series" || p.kitchenReference),
    requiresArabicDialogue: p.language === "ar",
    requiresExactTTS: p.audioMode === "hybrid" || p.audioMode === "exact_tts",
    continuityCritical: p.projectKind === "character_series",
    directorMode: p.directorMode ?? "auto",
    userSelectedModel: p.selectedVideoModel,
    userSelectedProvider: p.providerChoice,
    projectId: p.projectId,
  };

  // Decisions & constraints across stages
  const routeDecisions = {
    reference_image: evaluateRouteDecisions("reference_image", { ...ctx, task: "reference_image" }),
    video: evaluateRouteDecisions("video", ctx),
    audio_tts: evaluateRouteDecisions("audio_tts", { ...ctx, task: "audio_tts" }),
  };

  const hardConstraints = {
    reference_image: selectedRoute ? evaluateHardConstraints(selectedRoute, { ...ctx, task: "reference_image" }) : [],
    video: selectedRoute ? evaluateHardConstraints(selectedRoute, ctx) : [],
    audio_tts: selectedRoute ? evaluateHardConstraints(selectedRoute, { ...ctx, task: "audio_tts" }) : [],
  };

  const fallbackPlans = {
    reference_image: buildFallbackPlan("reference_image", ROUTE_CATALOG.find((r) => r.exactModel === (p.selectedImageModel || "gemini-3.1-flash-image")) ?? null),
    video: buildFallbackPlan("video", selectedRoute),
    audio_tts: buildFallbackPlan("audio_tts", ROUTE_CATALOG.find((r) => r.exactModel === (p.selectedTTSModel || "gemini-3.1-flash-tts-preview")) ?? null),
  };

  const now = Date.now();
  const createdTime = new Date(p.createdAt).getTime();
  const elapsedTimeMs = Math.max(0, now - createdTime);

  const costTrace = {
    estimatedPrimaryCostUsd: p.usage?.estimatedCostUsd ?? 0.15,
    estimatedFallbackCostUsd: 0.25,
    estimatedExposureUsd: (p.usage?.estimatedCostUsd ?? 0.15) * 1.5,
    actualSpendUsd: realExecution ? p.usage?.estimatedCostUsd ?? 0.15 : 0.0,
    failedAttemptSpendUsd: attempts.filter((a) => a.result === "FAILED").reduce((sum, a) => sum + (a.actualCostUsd || 0), 0),
    ttsCostUsd: p.audioMode === "hybrid" || p.audioMode === "exact_tts" ? 0.01 : 0.0,
    videoCostUsd: realExecution ? p.usage?.estimatedCostUsd ?? 0.15 : 0.0,
    assemblyCostUsd: 0.0,
  };

  return sanitizeObject({
    runId: `run_${p.id}`,
    productionId: p.id,
    projectId: p.projectId ?? "future-gahwa",
    projectName: p.projectName ?? "Future Gahwa",
    projectKind: p.projectKind ?? "character_series",
    episodeTitle: p.episodeTitle ?? p.dish,
    episodeNumber: p.episodeNumber ?? 1,
    task: "Future Gahwa V1 Real Proof Generation",
    mode: (p.directorMode ?? "auto").toUpperCase() as "AUTO" | "MANUAL",
    currentStage: p.status,
    status: p.status.toUpperCase(),
    startedAt: p.createdAt,
    updatedAt: p.updatedAt,
    elapsedTimeMs,
    costTrace,
    realExecution,
    directorChoice: p.directorMode ?? "auto",
    selectedRoute,
    selectedModel: p.selectedVideoModel || p.provider,
    actualRoute,
    actualModel,
    stageGraph: buildStageGraph(p),
    routeDecisions,
    hardConstraints,
    fallbackPlans,
    attempts,
    events,
    quality: {
      technicalValidation: {
        assetExists: Boolean(p.finalVideoUrl || completedShotWithRealMedia?.videoUrl),
        durationSeconds: p.durationSeconds ?? null,
        resolution: p.resolution ?? "1080x1920 (9:16)",
        aspectRatio: "9:16",
        audioPresent: Boolean(p.audioMode !== "native" || completedShotWithRealMedia),
        playable: Boolean(p.finalVideoUrl || completedShotWithRealMedia?.videoUrl),
      },
      humanQualityState: p.approved ? "ACCEPT" : quality.humanQualityState,
      rejectionReasons: quality.rejectionReasons,
      notes: p.approvalNote || quality.notes,
      reviewedAt: p.approvedAt || quality.reviewedAt,
    },
    providerHealth: [],
  });
}
