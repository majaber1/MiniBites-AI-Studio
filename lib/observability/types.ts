// ---------------------------------------------------------------------------
// Kiswani AI Studio — Backend Observatory & Routing Architecture Types
// ---------------------------------------------------------------------------

export type RouteTask =
  | "planning"
  | "reference_image"
  | "video"
  | "audio_tts"
  | "assembly"
  | "storage"
  | "publishing";

export type CapabilityState = "ELIGIBLE" | "UNVERIFIED" | "ELIMINATED";

export type ConstraintEvaluation = "PASS" | "FAIL" | "UNKNOWN" | "N/A";

export type FallbackClass =
  | "PRIMARY"
  | "CERTIFIED_EQUIVALENT"
  | "NEAR_EQUIVALENT"
  | "DEGRADED"
  | "STOP_ASK";

export type FailureType =
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMITED"
  | "AUTH_FAILED"
  | "TIMEOUT"
  | "SERVER_ERROR"
  | "CONTENT_POLICY"
  | "CLIENT_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export type FailureScope = "CHANNEL" | "ACCOUNT" | "PROJECT" | "MODEL" | "NETWORK";

export interface ExecutionRoute {
  id: string;
  task: RouteTask;
  developer: string;
  modelFamily: string;
  exactModel: string;
  accessChannel: string;
  endpointOperation: string;
  runtimeConfig?: Record<string, unknown>;
  costPolicyContext?: {
    estimatedCostPerUnit?: number;
    unitName?: string;
    currency?: string;
  };
}

export interface RouteCandidate {
  route: ExecutionRoute;
  capabilityState: CapabilityState;
  estimatedCostUsd: number | null;
  health: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
  rank: number;
  selected: boolean;
  whySelected?: string;
  whyNotSelected?: string;
  eliminatedReason?: string;
}

export interface EvaluatedConstraint {
  id: string;
  name: string;
  nameAr?: string;
  requirement: string;
  evaluation: ConstraintEvaluation;
  details?: string;
}

export interface FallbackCandidate {
  route: ExecutionRoute;
  fallbackClass: FallbackClass;
  autoAllowed: boolean;
  reason: string;
  reasonAr?: string;
}

export interface RouteAttempt {
  id: string;
  attemptNumber: number;
  stage: RouteTask;
  provider: string;
  channel: string;
  selectedModel: string;
  actualModel: string | null;
  httpStatus: number | null;
  providerJobId: string | null;
  realExecution: boolean;
  result: "SUCCESS" | "FAILED" | "IN_PROGRESS";
  failureType?: FailureType | null;
  failureScope?: FailureScope | null;
  fallbackExecuted: boolean;
  error?: string | null;
  timestamp: string;
  durationMs?: number | null;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
}

export type ObservatoryEventType =
  | "REQUEST_RECEIVED"
  | "PROJECT_BIBLE_LOADED"
  | "STAGE_STARTED"
  | "HARD_CONSTRAINTS_EVALUATED"
  | "ROUTES_FILTERED"
  | "ROUTE_SELECTED"
  | "PREFLIGHT_STARTED"
  | "PREFLIGHT_PASSED"
  | "PREFLIGHT_BLOCKED"
  | "PROVIDER_REQUEST_SUBMITTED"
  | "PROVIDER_RESPONSE_RECEIVED"
  | "PROVIDER_ERROR"
  | "FAILURE_CLASSIFIED"
  | "FALLBACK_EVALUATED"
  | "FALLBACK_EXECUTED"
  | "ASSET_CREATED"
  | "QUALITY_REVIEWED"
  | "RUN_COMPLETED";

export interface ObservatoryEvent {
  id: string;
  timestamp: string;
  severity: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  stage: string;
  eventType: ObservatoryEventType;
  message: string;
  messageAr?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderHealthMetrics {
  id: string;
  name: string;
  channel: string;
  configured: boolean;
  authenticated: boolean | "UNKNOWN";
  reachable: boolean | "UNKNOWN";
  modelAvailable: boolean | "UNKNOWN";
  quotaState: "NORMAL" | "EXHAUSTED" | "RATE_LIMITED" | "UNKNOWN";
  creditsState: "AVAILABLE" | "LOW" | "EXHAUSTED" | "UNKNOWN";
  circuitBreaker: "CLOSED" | "OPEN" | "HALF_OPEN" | "UNKNOWN";
  recentSuccessRate: number | null;
  rate429: number | null;
  rate5xx: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  lastSuccess: string | null;
  lastFailure: string | null;
  lastVerified: string | null;
}

export interface CostTrace {
  estimatedPrimaryCostUsd: number | null;
  estimatedFallbackCostUsd: number | null;
  estimatedExposureUsd: number | null;
  actualSpendUsd: number | null;
  failedAttemptSpendUsd: number | null;
  ttsCostUsd: number | null;
  videoCostUsd: number | null;
  assemblyCostUsd: number | null;
}

export type HumanQualityState = "NOT_REVIEWED" | "ACCEPT" | "ACCEPTABLE" | "REJECT";

export type QualityRejectionReason =
  | "character_drift"
  | "wrong_clothing"
  | "wrong_environment"
  | "bad_hands"
  | "bad_physics"
  | "bad_coffee_liquid"
  | "bad_arabic"
  | "bad_lip_sync"
  | "reference_mismatch"
  | "visual_artifact"
  | "other";

export interface QualityReviewRecord {
  technicalValidation: {
    assetExists: boolean;
    durationSeconds?: number | null;
    resolution?: string | null;
    aspectRatio?: string | null;
    audioPresent: boolean;
    playable: boolean;
  };
  humanQualityState: HumanQualityState;
  rejectionReasons?: QualityRejectionReason[];
  notes?: string;
  reviewedAt?: string;
}

export interface BenchmarkEntry {
  project: string;
  task: string;
  route: string;
  model: string;
  channel: string;
  attempts: number;
  technicalSuccessPercent: number;
  acceptedPercent: number;
  rejectedPercent: number;
  averageLatencyMs: number | null;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  costPerAcceptedOutputUsd: number | null;
}

export type StageGraphStatus =
  | "NOT_STARTED"
  | "PLANNING"
  | "PREFLIGHT"
  | "SELECTING_ROUTE"
  | "SUBMITTING"
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "BLOCKED"
  | "WAITING_FOR_APPROVAL"
  | "SKIPPED";

export interface StageGraphNode {
  id: RouteTask | "approval";
  label: string;
  labelAr: string;
  status: StageGraphStatus;
  order: number;
  selectedModel?: string;
  actualModel?: string | null;
  provider?: string;
  error?: string | null;
}

export interface ObservatoryRun {
  runId: string;
  productionId: string;
  projectId: string;
  projectName: string;
  projectKind: string;
  episodeTitle: string;
  episodeNumber?: number;
  task: string;
  mode: "AUTO" | "MANUAL";
  currentStage: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  elapsedTimeMs: number;
  costTrace: CostTrace;
  realExecution: boolean;
  directorChoice: "auto" | "manual";
  selectedRoute: ExecutionRoute | null;
  selectedModel: string;
  actualRoute: ExecutionRoute | null;
  actualModel: string | null;
  stageGraph: StageGraphNode[];
  routeDecisions: Record<string, RouteCandidate[]>;
  hardConstraints: Record<string, EvaluatedConstraint[]>;
  fallbackPlans: Record<string, FallbackCandidate[]>;
  attempts: RouteAttempt[];
  events: ObservatoryEvent[];
  quality: QualityReviewRecord;
  providerHealth: ProviderHealthMetrics[];
}
