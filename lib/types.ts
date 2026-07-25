// ---------------------------------------------------------------------------
// MiniBites AI Studio — core domain types
// ---------------------------------------------------------------------------

export type AgentId =
  | "orchestrator"
  | "recipe"
  | "miniature_director"
  | "shot_director"
  | "prompt"
  | "video"
  | "continuity"
  | "quality"
  | "assembly"
  | "publishing";

export type AgentStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface AgentState {
  id: AgentId;
  name: string;
  status: AgentStatus;
  startedAt?: string;
  finishedAt?: string;
  note?: string;
  logs: string[];
}

export type ShotStatus =
  | "planned"
  | "submitted"
  | "in_queue"
  | "generating"
  | "completed"
  | "rejected"
  | "failed"
  | "cancelled";

export interface Shot {
  id: string;
  index: number;
  seconds: number;
  action: string;
  camera: string;
  sound: string;
  prompt: string;
  negativePrompt: string;
  status: ShotStatus;
  providerJobId?: string;
  queuePosition?: number;
  videoUrl?: string;
  error?: string;
  attempts: number;
}

export type ProviderChoice = "fal" | "wan" | "mock";

export type ProductionStatus =
  | "planning"
  | "generating"
  | "review"
  | "assembling"
  | "awaiting_approval"
  | "approved"
  | "completed"
  | "failed"
  | "cancelled";

export interface PublishState {
  platform: "youtube" | "tiktok";
  status: "not_connected" | "ready" | "published" | "failed";
  url?: string;
  requiredAction?: string;
}

export interface Production {
  id: string;
  dish: string;
  language: "en" | "ar";
  createdAt: string;
  updatedAt: string;
  status: ProductionStatus;
  provider: string;
  providerIsMock: boolean;
  providerChoice?: ProviderChoice; // per-production override of VIDEO_PROVIDER
  planSource: "llm" | "template";
  recipeSummary?: string;
  miniatureBrief?: string;
  agents: AgentState[];
  shots: Shot[];
  finalVideoUrl?: string;
  assembled?: boolean; // true only when a real merged single MP4 exists
  assemblyJobId?: string;
  publishTitle?: string;
  publishCaption?: string;
  publishHashtags?: string[];
  durationSeconds?: number;
  resolution?: string;
  thumbnailUrl?: string;
  approved: boolean;
  publish: PublishState[];
  error?: string;
  ownerKey: string; // hashed access identity (never a secret)
}

export interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
  requiredEnv: string[];
}
