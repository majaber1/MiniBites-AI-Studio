// ---------------------------------------------------------------------------
// Google video & media provider:
//   1. Gemini / Imagen image model generates reference keyframes & master assets.
//   2. Veo animates with 9:16 aspect ratio, native audio, and reference image continuity.
//   3. Finished MP4 is re-hosted on fal/durable storage for browser playback + merge.
//   4. When Google is selected, generation is performed exclusively with Google.
// ---------------------------------------------------------------------------
import { cleanEnv } from "../env";
import type { ProviderShotStatus, ShotInput, ShotResult, VideoProvider } from "./types";

const G_BASE = "https://generativelanguage.googleapis.com/v1beta";

function gHeaders() {
  return {
    "x-goog-api-key": cleanEnv("GEMINI_API_KEY") ?? "",
    "Content-Type": "application/json",
  };
}

async function gFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...gHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Google API request failed (HTTP ${res.status}): ${errText.slice(0, 200)}`);
  }
  return res;
}

export interface GoogleImageOptions {
  aspectRatio?: "9:16" | "16:9" | "1:1";
  negativePrompt?: string;
  numberOfImages?: number;
}

export interface GoogleImageResult {
  imageUrl: string;
  base64Data: string;
  mimeType: string;
  modelUsed: string;
}

/** Generate a visual reference image (e.g. MiniBites Kitchen Master Reference or Character Reference) */
export async function generateGoogleImage(prompt: string, options: GoogleImageOptions = {}): Promise<GoogleImageResult> {
  const apiKey = cleanEnv("GEMINI_API_KEY");
  const model = cleanEnv("GOOGLE_IMAGE_MODEL") ?? "gemini-3.1-flash-image";
  const aspectRatio = options.aspectRatio ?? "9:16";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured for Google image generation.");
  }

  // Handle Imagen 3 predict endpoint
  if (model.startsWith("imagen-")) {
    try {
      const res = await gFetch(`${G_BASE}/models/${model}:predict`, {
        method: "POST",
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            aspectRatio: aspectRatio === "9:16" ? "9:16" : aspectRatio === "16:9" ? "16:9" : "1:1",
            sampleCount: options.numberOfImages ?? 1,
            negativePrompt: options.negativePrompt,
          },
        }),
      });
      const data = (await res.json()) as { predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> };
      const pred = data.predictions?.[0];
      if (pred?.bytesBase64Encoded) {
        const mimeType = pred.mimeType ?? "image/jpeg";
        const base64Data = pred.bytesBase64Encoded;
        return {
          imageUrl: `data:${mimeType};base64,${base64Data}`,
          base64Data,
          mimeType,
          modelUsed: model,
        };
      }
    } catch (err) {
      console.warn("Imagen predict call failed, trying multimodal generateContent fallback:", err);
    }
  }

  // Multimodal Gemini Image generation endpoint (gemini-3.1-flash-image / gemini-3-pro-image / Nano Banana 2)
  const res = await gFetch(`${G_BASE}/models/${model}:generateContent`, {
    method: "POST",
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}${options.negativePrompt ? ` Avoid: ${options.negativePrompt}` : ""}` }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
    }),
  });
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
  };
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    throw new Error(`Google image generation returned no image data from model: ${model}`);
  }
  const mimeType = part.inlineData.mimeType ?? "image/png";
  return {
    imageUrl: `data:${mimeType};base64,${part.inlineData.data}`,
    base64Data: part.inlineData.data,
    mimeType,
    modelUsed: model,
  };
}

/** Style-neutral first frame: the project prompt decides realism vs animation. */
async function generateKeyframe(input: ShotInput): Promise<{ data: string; mimeType: string } | null> {
  const model = cleanEnv("GOOGLE_IMAGE_MODEL") ?? "gemini-3.1-flash-image";
  try {
    const result = await generateGoogleImage(
      `First-frame reference keyframe for a vertical 9:16 video. Match the requested visual style exactly and preserve all identity/continuity instructions. ${input.prompt}`,
      { aspectRatio: "9:16", negativePrompt: input.negativePrompt }
    );
    return { data: result.base64Data, mimeType: result.mimeType };
  } catch (err) {
    console.warn(`Keyframe generation via ${model} was not completed; proceeding with text-only Veo prompt.`, err);
    return null;
  }
}

async function uploadToFalStorage(bytes: Uint8Array, fileName: string, contentType: string): Promise<string> {
  const falKey = cleanEnv("FAL_KEY");
  if (!falKey) {
    // If fal storage is not configured, encode as data URL
    const b64 = Buffer.from(bytes).toString("base64");
    return `data:${contentType};base64,${b64}`;
  }
  const initiate = await fetch("https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: contentType, file_name: fileName }),
    cache: "no-store",
  });
  if (!initiate.ok) throw new Error(`Video storage request failed (HTTP ${initiate.status}).`);
  const { upload_url, file_url } = (await initiate.json()) as { upload_url: string; file_url: string };
  const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes as unknown as BodyInit });
  if (!put.ok) throw new Error(`fal storage upload HTTP ${put.status}`);
  return file_url;
}

export class GoogleVeoProvider implements VideoProvider {
  readonly isMock = false;
  readonly capabilities = {
    video: true as const,
    imageReference: true,
    nativeAudio: true,
    negativePrompt: true,
    aspectRatios: ["9:16"] as const,
    minSeconds: 3,
    maxSeconds: 8,
  };
  readonly configurationHint = "Set GEMINI_API_KEY (Veo access). Optional: GOOGLE_VIDEO_MODEL, GOOGLE_IMAGE_MODEL, FAL_KEY (hosting).";
  private videoModel = cleanEnv("GOOGLE_VIDEO_MODEL") ?? "veo-3.1-generate-preview";

  get name() {
    return `Google (Veo: ${this.videoModel}, native audio)`;
  }
  get configured() {
    return Boolean(cleanEnv("GEMINI_API_KEY"));
  }

  estimateCostUsd(input: ShotInput) {
    const perSecond = Number(cleanEnv("GOOGLE_ESTIMATED_COST_PER_SECOND_USD"));
    return Number.isFinite(perSecond) && perSecond >= 0 ? perSecond * input.seconds : null;
  }

  async submitShot(input: ShotInput) {
    if (!this.configured) throw new Error("Google Veo is not configured (GEMINI_API_KEY missing).");
    let keyframe = await generateKeyframe(input);
    if (!keyframe && input.referenceImageUrl) {
      if (input.referenceImageUrl.startsWith("data:")) {
        const [header, b64] = input.referenceImageUrl.split(",");
        const mimeType = header.split(":")[1]?.split(";")[0] || "image/jpeg";
        if (b64) keyframe = { data: b64, mimeType };
      }
    }
    const seconds = [4, 5, 6, 8].reduce((best, d) => (Math.abs(d - input.seconds) < Math.abs(best - input.seconds) ? d : best), 8);
    const instance: Record<string, unknown> = { prompt: input.prompt };
    if (keyframe) {
      instance.image = { bytesBase64Encoded: keyframe.data, mimeType: keyframe.mimeType };
    }
    const res = await gFetch(`${G_BASE}/models/${this.videoModel}:predictLongRunning`, {
      method: "POST",
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          aspectRatio: "9:16",
          durationSeconds: seconds,
          negativePrompt: input.negativePrompt,
          audioEnabled: true,
        },
      }),
    });
    const data = (await res.json()) as { name?: string };
    if (!data.name) throw new Error("Veo returned no operation name");
    return { providerJobId: data.name };
  }

  async getShotStatus(operationName: string): Promise<ProviderShotStatus> {
    const res = await gFetch(`${G_BASE}/${operationName}`);
    const op = (await res.json()) as { done?: boolean; error?: { message?: string } };
    if (op.error) return { state: "failed", error: `Veo: ${op.error.message ?? "generation error"}` };
    if (!op.done) return { state: "generating" };
    return { state: "completed" };
  }

  async getShotResult(operationName: string): Promise<ShotResult> {
    const res = await gFetch(`${G_BASE}/${operationName}`);
    const op = (await res.json()) as {
      response?: {
        generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> };
        generatedVideos?: Array<{ video?: { uri?: string } }>;
      };
    };
    const uri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? op.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) throw new Error("Veo returned no video URI");
    const dl = await gFetch(uri);
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const url = await uploadToFalStorage(bytes, `kiswani_${Date.now().toString(36)}.mp4`, "video/mp4");
    return { videoUrl: url };
  }

  async cancelShot(operationName: string) {
    void operationName;
  }
}
