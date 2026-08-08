import { cleanEnv } from "@/lib/env";
import type { ProviderShotStatus, ShotInput, ShotResult, VideoProvider } from "./types";

/**
 * fal.ai queue adapter (paid). Works with any fal text-to-video model that
 * accepts { prompt, negative_prompt, aspect_ratio } — e.g. Wan 2.x, Kling,
 * or Veo models hosted on fal. Set FAL_MODEL_ID to the model route from the
 * fal model page (verify the current id in the fal docs before production).
 */
export class FalProvider implements VideoProvider {
  readonly isMock = false;
  readonly configurationHint = "Set FAL_KEY (and optionally FAL_MODEL_ID) in server environment variables.";
  readonly capabilities = { video: true as const, imageReference: false, nativeAudio: false, negativePrompt: true, aspectRatios: ["9:16"] as const, minSeconds: 3, maxSeconds: 8 };
  private key = cleanEnv("FAL_KEY") ?? "";
  private model = cleanEnv("FAL_MODEL_ID") ?? "fal-ai/wan/v2.2-a14b/text-to-video";
  /**
   * fal queue rule: submit uses the full model path (including subpath),
   * but request status/result/cancel endpoints use only the base
   * "{namespace}/{model}" id. E.g. submit to fal-ai/wan/v2.2-a14b/text-to-video,
   * then poll fal-ai/wan/requests/{id}/status.
   */
  private get requestBase() {
    return this.model.split("/").slice(0, 2).join("/");
  }
  get name() {
    return `fal.ai (${this.model})`;
  }
  get configured() {
    return Boolean(this.key);
  }
  estimateCostUsd(input: ShotInput) {
    const perSecond = Number(cleanEnv("FAL_ESTIMATED_COST_PER_SECOND_USD"));
    return Number.isFinite(perSecond) && perSecond >= 0 ? perSecond * input.seconds : null;
  }

  private async req(path: string, init?: RequestInit) {
    const res = await fetch(`https://queue.fal.run/${path}`, {
      ...init,
      headers: {
        Authorization: `Key ${this.key}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`fal.ai request failed (HTTP ${res.status}).`);
    }
    return res.json();
  }

  async submitShot(input: ShotInput) {
    const data = (await this.req(this.model, {
      method: "POST",
      body: JSON.stringify({
        prompt: input.prompt,
        negative_prompt: input.negativePrompt,
        aspect_ratio: input.aspectRatio,
      }),
    })) as { request_id: string };
    return { providerJobId: data.request_id };
  }

  async getShotStatus(id: string): Promise<ProviderShotStatus> {
    const data = (await this.req(`${this.requestBase}/requests/${id}/status?logs=1`)) as {
      status: string;
      queue_position?: number;
      logs?: Array<{ message: string }>;
    };
    const logs = data.logs?.map((l) => l.message);
    if (data.status === "IN_QUEUE") return { state: "in_queue", queuePosition: data.queue_position, logs };
    if (data.status === "IN_PROGRESS") return { state: "generating", logs };
    if (data.status === "COMPLETED") return { state: "completed", logs };
    return { state: "failed", error: `Provider status: ${data.status}`, logs };
  }

  async getShotResult(id: string): Promise<ShotResult> {
    const data = (await this.req(`${this.requestBase}/requests/${id}`)) as {
      video?: { url: string };
      videos?: Array<{ url: string }>;
      seconds?: number;
    };
    const url = data.video?.url ?? data.videos?.[0]?.url;
    if (!url) throw new Error("fal.ai returned no video URL");
    return { videoUrl: url, durationSeconds: data.seconds };
  }

  async cancelShot(id: string) {
    await this.req(`${this.requestBase}/requests/${id}/cancel`, { method: "PUT" }).catch(() => undefined);
  }
}
