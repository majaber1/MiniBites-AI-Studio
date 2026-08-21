import { cleanEnv } from "../env";
import type { CharacterVoiceProfile } from "../types";

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
  actualModel?: string;
  realExecution?: boolean;
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
  "abu-nasser": {
    voiceName: "Orus",
    direction: "Saudi Central/Najdi direction, mature male, calm, confident, warm, dry comedic timing, unhurried pace",
    language: "ar",
    dialect: "Saudi Najdi Arabic",
  },
  "abu_nasser": {
    voiceName: "Orus",
    direction: "Saudi Central/Najdi direction, mature male, calm, confident, warm, dry comedic timing, unhurried pace",
    language: "ar",
    dialect: "Saudi Najdi Arabic",
  },
  barq: {
    voiceName: "Puck",
    direction: "Fast, energetic, witty, slightly synthetic robotic modulation, enthusiastic Saudi cadence",
    language: "ar",
    dialect: "Saudi Arabic",
  },
};

/** Converts raw 16-bit PCM buffer into standard playable WAV buffer */
export function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // subchunk 1 size (16 for PCM)
  header.writeUInt16LE(1, 20); // audio format 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export function isGeminiTTSConfigured(): boolean {
  return Boolean(cleanEnv("GEMINI_API_KEY"));
}

export async function generateGeminiSpeech(req: TTSRequest): Promise<TTSResult> {
  const apiKey = cleanEnv("GEMINI_API_KEY");
  const model = cleanEnv("GOOGLE_TTS_MODEL") ?? "gemini-3.1-flash-tts-preview";
  const exactText = req.exactText.trim();
  if (!exactText) throw new Error("TTS request text cannot be empty.");

  if (!apiKey) {
    // Honest mock / test placeholder when no API key is configured
    return {
      audioUrl: "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==",
      mimeType: "audio/wav",
      durationSeconds: 2,
      voiceUsed: req.voiceName || "Fenrir",
      actualModel: "mock-tts",
      realExecution: false,
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

  let mimeType = part.inlineData.mimeType ?? "audio/mp3";
  let base64Data = part.inlineData.data;

  // Convert raw PCM L16 to standard browser-playable WAV
  if (mimeType.includes("audio/l16") || mimeType.includes("rate=24000")) {
    const rawPcm = Buffer.from(base64Data, "base64");
    const wavBuffer = pcmToWav(rawPcm, 24000, 1);
    base64Data = wavBuffer.toString("base64");
    mimeType = "audio/wav";
  }

  const audioDataUrl = `data:${mimeType};base64,${base64Data}`;
  const approxDuration = Math.max(1, Math.round(exactText.split(/\s+/).length * 0.45));

  return {
    audioUrl: audioDataUrl,
    audioBase64: base64Data,
    mimeType,
    durationSeconds: approxDuration,
    voiceUsed: req.voiceName || "Fenrir",
    actualModel: model,
    realExecution: true,
  };
}
