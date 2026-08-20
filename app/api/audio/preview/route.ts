import { NextResponse } from "next/server";
import { generateGeminiSpeech, DEFAULT_CHARACTER_VOICES } from "@/lib/audio/tts";
import { requireAuth } from "@/lib/security";

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as {
      characterId?: string;
      textAr?: string;
      exactText?: string;
      voiceName?: string;
      direction?: string;
      dialect?: string;
    };

    const characterId = body.characterId?.toLowerCase();
    const defaultVoice = characterId ? DEFAULT_CHARACTER_VOICES[characterId] : undefined;
    const exactText = body.exactText || body.textAr || (characterId === "fhaid" ? "هذي أصول الكرم يا ذيبان، سَمّ بالله." : characterId === "manfoosha" ? "لو كثرتوا حكي بتبرد السالفة، خلصونا!" : "يا فهيد، وش السالفة هذي؟");
    const voiceName = body.voiceName || defaultVoice?.voiceName || "Fenrir";
    const direction = body.direction || defaultVoice?.direction;

    const result = await generateGeminiSpeech({
      exactText,
      voiceName,
      direction,
      language: "ar",
      dialect: body.dialect || defaultVoice?.dialect,
    });

    return NextResponse.json({
      audioUrl: result.audioUrl,
      voiceUsed: result.voiceUsed,
      exactText,
      durationSeconds: result.durationSeconds ?? 2,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Voice preview generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
