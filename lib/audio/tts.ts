import { cleanEnv } from "@/lib/env";
import type { CharacterVoiceProfile } from "@/lib/types";

const G_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface TTSRequest {
  exactText: string;
  voiceName: string;
  direction?: string;
  language?: string;
  dialect?: string;
}

export interface TTSResult {
  audioUrl: string;
  audioBase64?: string;
  mimeType: string;
  durationSeconds?: number;
  voiceUsed: string;
}

export const PREBUILT_VOICES = [
  { id: "Fenrir", name: "Fenrir", gender: "male", persona: "Warm, resonant, slightly gravelly — ideal for Bedouin and storytelling" },
  { id: "Puck", name: "Puck", gender: "male", persona: "Relaxed, friendly, upbeat, quick comedic timing — ideal for Gulf/Saudi" },
  { id: "Aoede", name: "Aoede", gender: "female", persona: "Expressive, bright, sharp comedic delivery — ideal for scene-stealing banter" },
  { id: "Charon", name: "Charon", gender: "male", persona: "Calm, deep, authoritative and grounded" },
  { id: "Kore", name: "Kore", gender: "female", persona: "Firm, clear, confident and natural" },
  { id: "Orus", name: "Orus", gender: "male", persona: "Mature, rustic, warm and traditional" },
  { id: "Zephyr", name: "Zephyr", gender: "male", persona: "Smooth, modern, conversational" },
];

export const DEFAULT_CHARACTER_VOICES: Record<string, CharacterVoiceProfile> = {
  dheeban: {
    voiceName: "Fenrir",
    direction: "Jordanian Bedouin direction, male, warm, slightly gravelly, confident, natural humor, moderate pace",
    language: "ar",
    dialect: "Jordanian Bedouin Arabic",
  },
  fhaid: {
    voiceName: "Puck",
    direction: "Saudi direction, male, relaxed, friendly, intelligent comedic timing, natural delivery",
    language: "ar",
    dialect: "Saudi Arabic",
  },
  manfoosha: {
    voiceName: "Aoede",
    direction: "Arabic direction, female, expressive, fast comic timing, natural delivery",
    language: "ar",
    dialect: "Arabic",
  },
};

export function isGeminiTTSConfigured(): boolean {
  return Boolean(cleanEnv("GEMINI_API_KEY"));
}

export async function generateGeminiSpeech(req: TTSRequest): Promise<TTSResult> {
  const apiKey = cleanEnv("GEMINI_API_KEY");
  const model = cleanEnv("GOOGLE_TTS_MODEL") ?? "gemini-2.5-flash";
  const exactText = req.exactText.trim();
  if (!exactText) throw new Error("TTS request text cannot be empty.");

  if (!apiKey) {
    // Honest mock / fallback when no API key is configured
    return {
      audioUrl: "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==",
      mimeType: "audio/wav",
      durationSeconds: 2,
      voiceUsed: req.voiceName || "Fenrir",
    };
  }

  // Exact Arabic text passed unchanged. Voice direction is passed in a system-style prompt constraint.
  const promptText = req.direction
    ? `Please speak the following text aloud exactly as written without translating, altering, or adding words. Use this vocal style: ${req.direction}. Text: "${exactText}"`
    : exactText;

  const res = await fetch(`${G_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: req.voiceName || "Fenrir",
            },
          },
        },
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Gemini TTS generation failed (HTTP ${res.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: {
            mimeType?: string;
            data?: string;
          };
        }>;
      };
    }>;
  };

  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    throw new Error("Gemini TTS returned no audio data.");
  }

  const mimeType = part.inlineData.mimeType ?? "audio/mp3";
  const base64Data = part.inlineData.data;
  const audioDataUrl = `data:${mimeType};base64,${base64Data}`;

  return {
    audioUrl: audioDataUrl,
    audioBase64: base64Data,
    mimeType,
    voiceUsed: req.voiceName || "Fenrir",
  };
}
