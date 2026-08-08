import type { ProviderShotStatus, ShotInput, ShotResult, VideoProvider } from "./types";

/**
 * MOCK PROVIDER — FOR AUTOMATED TESTING ONLY.
 * Produces no real video. Every result is labeled as mock and the UI shows a
 * warning banner. Enabled only when VIDEO_PROVIDER=mock.
 */
export class MockProvider implements VideoProvider {
  readonly isMock = true;
  readonly name = "MOCK (testing only — not real video)";
  readonly configured = true;
  readonly configurationHint = "Set VIDEO_PROVIDER=fal or VIDEO_PROVIDER=wan for real generation.";
  readonly capabilities = { video: true as const, imageReference: false, nativeAudio: false, negativePrompt: true, aspectRatios: ["9:16"] as const, minSeconds: 3, maxSeconds: 8 };
  estimateCostUsd() { return 0; }

  async submitShot(_input: ShotInput) {
    return { providerJobId: `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` };
  }
  async getShotStatus(id: string): Promise<ProviderShotStatus> {
    // Deterministic: queued for ~5s after submission, generating for ~10s, then complete.
    const born = parseInt(id.split("-")[1] ?? "0", 36);
    const age = Date.now() - born;
    if (age < 5_000) return { state: "in_queue", queuePosition: 1, logs: ["[mock] queued"] };
    if (age < 15_000) return { state: "generating", logs: ["[mock] rendering placeholder"] };
    return { state: "completed", logs: ["[mock] done"] };
  }
  async getShotResult(_id: string): Promise<ShotResult> {
    return {
      videoUrl: "about:blank#mock-video-not-real",
      durationSeconds: 4,
      resolution: "1080x1920",
    };
  }
  async cancelShot(_id: string) {}
}
