// ---------------------------------------------------------------------------
// Kiswani AI Studio — core domain types
// Backward-compatible with MiniBites productions.
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

export type ProjectKind = "mini_food" | "character_series" | "commercial_campaign" | "general_video";
export type ProjectStatus = "active" | "paused" | "archived";

export interface CharacterVoiceProfile {
  voiceName: string; // Prebuilt voice name e.g. "Fenrir", "Puck", "Orus", "Charon", "Kore", "Aoede", "Zephyr"
  direction: string; // e.g. "Jordanian Bedouin direction, male, warm, slightly gravelly, confident, natural humor"
  language: string; // "ar" | "en"
  dialect?: string; // "Jordanian Bedouin Arabic" | "Saudi Arabic"
  pitch?: string;
  speed?: string;
}

export interface CharacterReferenceAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  label?: string;
  approved: boolean;
  approvedAt?: string;
  prompt?: string;
}

export interface ProjectCharacter {
  id: string;
  name: string;
  displayNameAr?: string;
  role: string;
  dialect?: string;
  voiceStyle?: string;
  voiceProfile?: CharacterVoiceProfile;
  visualNotes: string;
  wardrobe?: string;
  personality?: string;
  catchphrases?: string[];
  referenceImageUrls?: string[];
  referenceAssets?: CharacterReferenceAsset[];
  continuityInstructions?: string[];
}

export interface ProjectKitchenReference {
  id: string;
  name: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  prompt?: string;
  approved: boolean;
  approvedAt?: string;
  scale?: string; // "1:12 miniature scale"
  environment?: string; // "real working miniature kitchen, same stove, same counter, same utensils..."
  lighting?: string;
  palette?: string;
  notes?: string;
}

export type AudioMode = "native" | "exact_tts" | "hybrid";

export interface ProjectBible {
  concept: string;
  language: "ar" | "en" | "mixed";
  dialects?: string[];
  visualStyle: string;
  aspectRatio: "9:16" | "16:9" | "1:1";
  defaultDurationSeconds: number;
  locations?: string[];
  tone?: string;
  continuityRules?: string[];
  negativeRules?: string[];
  characters?: ProjectCharacter[];
  kitchenReference?: ProjectKitchenReference;
  referenceImageUrls?: string[];
  referenceNotes?: string;
  defaultAudioMode?: AudioMode;
}

export interface StudioProject {
  id: string;
  slug: string;
  name: string;
  nameAr?: string;
  icon?: string;
  kind: ProjectKind;
  status: ProjectStatus;
  description: string;
  descriptionAr?: string;
  bible: ProjectBible;
  defaultProvider?: ProviderChoice;
  createdAt: string;
  updatedAt: string;
  ownerKey: string;
  systemPreset?: boolean;
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

export interface ShotDialogueItem {
  speakerId: string;
  speakerName?: string;
  exactText: string;
  textAr?: string;
  language?: "ar" | "en" | "mixed";
  dialect?: string;
  voiceName?: string;
  voiceDirection?: string;
  audioUrl?: string;
  startOffset?: number;
  duration?: number;
  approved?: boolean;
}

export interface ShotAudioPlan {
  audioMode: AudioMode;
  ambient?: string;
  soundEffects?: string[];
  dialogue?: ShotDialogueItem[];
  musicPolicy?: "none" | "subtle_background" | "dramatic_sting" | "cultural_acoustic";
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
  audioUrl?: string;
  audioPlan?: ShotAudioPlan;
  referenceImageUrl?: string;
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

export type PublishPlatform = "youtube" | "tiktok" | "instagram" | "x" | "snapchat";

export interface PublishState {
  platform: PublishPlatform;
  status: "not_connected" | "ready" | "published" | "failed" | "processing" | "auth_required" | "review_required" | "manual_only";
  url?: string;
  externalId?: string;
  requiredAction?: string;
}

export type DirectorMode = "auto" | "manual";

export interface StageMonitorEntry {
  stage: "planning" | "reference_image" | "video" | "audio" | "assembly" | "storage" | "publishing";
  provider: string;
  selectedModel: string;
  actualModel: string | null;
  whySelected?: string;
  selectionReason?: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  realExecution?: boolean;
  mediaUrl?: string | null;
  referenceAssets?: string[];
  audioMode?: AudioMode;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  providerJobId?: string | null;
  startedAt?: string;
  finishedAt?: string;
  completedAt?: string;
  error?: string | null;
  fallbackUsed: boolean;
}

export interface Production {
  id: string;
  // Legacy field kept for full backward compatibility. For non-food projects it
  // stores the episode/video working title.
  dish: string;
  episodeTitle?: string;
  episodeNumber?: number;
  projectId?: string;
  projectName?: string;
  projectKind?: ProjectKind;
  // Immutable snapshot used to keep an episode stable even if the Project Bible changes later.
  projectBible?: ProjectBible;
  description?: string;
  style: CreativeStyle;
  storyMode: StoryMode;
  durationPreset: DurationPreset;
  language: "en" | "ar";
  directorMode?: DirectorMode;
  audioMode?: AudioMode;
  kitchenReference?: ProjectKitchenReference;
  selectedImageModel?: string;
  selectedVideoModel?: string;
  selectedTTSModel?: string;
  generationMonitor?: StageMonitorEntry[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  status: ProductionStatus;
  provider: string;
  providerIsMock: boolean;
  providerChoice?: ProviderChoice;
  planSource: "llm" | "template";
  // Legacy names used by MiniBites. In character/general projects these map to
  // story summary and production brief respectively.
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
  assembled?: boolean;
  assemblyJobId?: string;
  publishTitle?: string;
  publishCaption?: string;
  publishHashtags?: string[];
  socialPack?: {
    tiktokCaption: string;
    instagramCaption: string;
    youtubeTitle: string;
    youtubeDescription: string;
    xTweet: string;
    snapchatCaption: string;
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
  ownerKey: string;
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
  category?: "media" | "social" | "core";
  configured: boolean;
  status?: "connected" | "ready" | "not_connected" | "auth_required" | "review_required" | "manual_only" | "error";
  detail: string;
  requiredEnv: string[];
}
