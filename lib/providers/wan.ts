import { cleanEnv } from "@/lib/env";
import type { ProviderShotStatus, ShotInput, ShotResult, VideoProvider } from "./types";

/**
 * Self-hosted / open-source Wan adapter (lowest-cost path when you control a
 * GPU — RunPod, your own machine, Colab tunnel, etc.). Your worker must expose:
 *   POST   {WAN_VIDEO_ENDPOINT}/jobs            -> { jobId }
 *   GET    {WAN_VIDEO_ENDPOINT}/jobs/:id        -> { status, queuePosition?, error?, videoUrl?, seconds? }
 *   DELETE {WAN_VIDEO_ENDPOINT}/jobs/:id
 * status: queued | running | done | error
 */
export class WanSelfHostedProvider implements VideoProvider {
  readonly isMock = false;
  readonly name = "Wan (self-hosted GPU worker)";
  readonly configurationHint = "Set WAN_VIDEO_ENDPOINT (and optional WAN_VIDEO_TOKEN) to your GPU worker URL.";
  readonly capabilities = { video: true as const, imageReference: false, nativeAudio: false, negativePrompt: true, aspectRatios: ["9:16"] as const, minSeconds: 3, maxSeconds: 8 };
  private endpoint = cleanEnv("WAN_VIDEO_ENDPOINT") ?? "";
  private token = cleanEnv("WAN_VIDEO_TOKEN") ?? "";
  get configured() {
    return Boolean(this.endpoint);
  }
  estimateCostUsd() { return null; }

  private headers() {
    return {
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async submitShot(input: ShotInput) {
    const res = await fetch(`${this.endpoint}/jobs`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Wan worker HTTP ${res.status}`);
    const data = (await res.json()) as { jobId: string };
    return { providerJobId: data.jobId };
  }

  async getShotStatus(id: string): Promise<ProviderShotStatus> {
    const res = await fetch(`${this.endpoint}/jobs/${id}`, { headers: this.headers(), cache: "no-store" });
    if (!res.ok) return { state: "failed", error: `Wan worker HTTP ${res.status}` };
    const data = (await res.json()) as { status: string; queuePosition?: number; error?: string };
    if (data.status === "queued") return { state: "in_queue", queuePosition: data.queuePosition };
    if (data.status === "running") return { state: "generating" };
    if (data.status === "done") return { state: "completed" };
    return { state: "failed", error: data.error ?? "Wan worker error" };
  }

  async getShotResult(id: string): Promise<ShotResult> {
    const res = await fetch(`${this.endpoint}/jobs/${id}`, { headers: this.headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`Wan worker HTTP ${res.status}`);
    const data = (await res.json()) as { videoUrl?: string; seconds?: number };
    if (!data.videoUrl) throw new Error("Wan worker returned no video URL");
    return { videoUrl: data.videoUrl, durationSeconds: data.seconds };
  }

  async cancelShot(id: string) {
    await fetch(`${this.endpoint}/jobs/${id}`, { method: "DELETE", headers: this.headers() }).catch(() => undefined);
  }
}
