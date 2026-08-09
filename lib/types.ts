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

export interface ShotVersion {
  version: number;
  videoUrl: string;
  prompt: string;
  providerJobId?: string;
  createdAt: string;
  accepted: boolean;
}

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
  estimatedCostUsd?: number;
  accepted?: boolean;
  versions?: ShotVersion[];
}

export type ProviderChoice = "fal" | "wan" | "mock" | "google";
export type CreativeStyle = "realistic" | "cinematic" | "cozy" | "luxury" | "street" | "traditional" | "playful" | "macro" | "workshop" | "asmr";
export type StoryMode = "satisfying" | "educational" | "funny" | "cinematic" | "asmr" | "luxury" | "viral_hook";
export type DurationPreset = "quick" | "standard" | "extended";

export type ProductionStatus =
  | "planning"
  | "planned"
  | "generating"
  | "review"
  | "assembling"
  | "awaiting_approval"
  | "changes_requested"
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
  description?: string;
  style: CreativeStyle;
  storyMode: StoryMode;
  durationPreset: DurationPreset;
  language: "en" | "ar";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  status: ProductionStatus;
  provider: string;
  providerIsMock: boolean;
  providerChoice?: ProviderChoice; // per-production override of VIDEO_PROVIDER
  planSource: "llm" | "template";
  recipeSummary?: string;
  miniatureBrief?: string;
  visualBible?: {
    environment: string;
    scale: string;
    lighting: string;
    camera: string;
    palette: string;
    hands: string;
    props: string;
  };
  agents: AgentState[];
  shots: Shot[];
  finalVideoUrl?: string;
  providerFinalVideoUrl?: string;
  mediaStorage?: { status: "not_configured" | "archived" | "failed"; provider: "vercel_blob" | "provider"; archivedAt?: string; note?: string };
  assembled?: boolean; // true only when a real merged single MP4 exists
  assemblyJobId?: string;
  publishTitle?: string;
  publishCaption?: string;
  publishHashtags?: string[];
  socialPack?: {
    tiktokCaption: string;
    instagramCaption: string;
    youtubeTitle: string;
    youtubeDescription: string;
    hashtags: string[];
  };
  durationSeconds?: number;
  resolution?: string;
  thumbnailUrl?: string;
  approved: boolean;
  approvalNote?: string;
  approvedAt?: string;
  publish: PublishState[];
  error?: string;
  ownerKey: string; // hashed access identity (never a secret)
  usage: {
    submittedShots: number;
    completedShots: number;
    failedShots: number;
    estimatedCostUsd: number | null;
  };
}

export interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
  requiredEnv: string[];
}
