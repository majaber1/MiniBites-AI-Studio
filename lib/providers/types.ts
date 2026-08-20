// ---------------------------------------------------------------------------
// Provider-independent video generation contract.
// All keys stay server-side. Never import these modules in client components.
// ---------------------------------------------------------------------------

export interface ShotInput {
  prompt: string;
  negativePrompt: string;
  seconds: number;
  aspectRatio: "9:16";
  resolution?: string;
  referenceImageUrl?: string;
}

export type ProviderShotStatus =
  | { state: "in_queue"; queuePosition?: number; logs?: string[] }
  | { state: "generating"; logs?: string[] }
  | { state: "completed"; logs?: string[] }
  | { state: "failed"; error: string; logs?: string[] };

export interface ShotResult {
  videoUrl: string;
  durationSeconds?: number;
  resolution?: string;
}

export interface ProviderCapabilities {
  video: true;
  imageReference: boolean;
  nativeAudio: boolean;
  negativePrompt: boolean;
  aspectRatios: readonly string[];
  minSeconds: number;
  maxSeconds: number;
}

export interface VideoProvider {
  readonly name: string;
  /** True only for the testing provider. The UI must label mock output. */
  readonly isMock: boolean;
  readonly configured: boolean;
  readonly configurationHint: string;
  readonly capabilities: ProviderCapabilities;
  estimateCostUsd(input: ShotInput): number | null;
  submitShot(input: ShotInput): Promise<{ providerJobId: string }>;
  getShotStatus(providerJobId: string): Promise<ProviderShotStatus>;
  getShotResult(providerJobId: string): Promise<ShotResult>;
  cancelShot(providerJobId: string): Promise<void>;
}
