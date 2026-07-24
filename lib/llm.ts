// ---------------------------------------------------------------------------
// Planning LLM. Uses Anthropic (ANTHROPIC_API_KEY) or Gemini (GEMINI_API_KEY).
// If neither key is set, agents fall back to a deterministic template plan
// that is clearly labeled "template" in the UI. Keys are server-side only.
// ---------------------------------------------------------------------------

export interface ShotPlan {
  recipeSummary: string;
  miniatureBrief: string;
  shots: Array<{ seconds: number; action: string; camera: string; sound: string }>;
  title: string;
  caption: string;
  hashtags: string[];
}

export function llmConfigured(): "anthropic" | "gemini" | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

const PLAN_INSTRUCTIONS = (dish: string, language: string) =>
  `You are the planning team for MiniBites, a miniature-cooking channel. Plan a real miniature-cooking short for: ${dish}.
Rules: real human hands, real dollhouse-scale working tools, real edible ingredients in tiny quantities, continuous physical cooking motion, macro close-up, shallow depth of field, vertical 9:16, cooking ASMR. Absolutely no cartoon chefs, toy characters, miniature people, or slideshow stills. Preserve the authentic ingredients and cooking order of ${dish}. Caption language: ${language === "ar" ? "Arabic" : "English"}.
Return ONLY valid JSON: {"recipeSummary": string, "miniatureBrief": string (ingredients, tools, 1:12 scale notes), "shots": [{"seconds": number (3-6), "action": string, "camera": string, "sound": string}] (6-9 shots, total 30-45s, first shot is a strong hook), "title": string, "caption": string, "hashtags": string[]}`;

export async function createShotPlan(dish: string, language: string): Promise<{ plan: ShotPlan; source: "llm" | "template" }> {
  const which = llmConfigured();
  try {
    if (which === "anthropic") return { plan: await viaAnthropic(dish, language), source: "llm" };
    if (which === "gemini") return { plan: await viaGemini(dish, language), source: "llm" };
  } catch {
    // fall through to template so a planning-LLM outage never kills the job
  }
  return { plan: templatePlan(dish), source: "template" };
}

async function viaAnthropic(dish: string, language: string): Promise<ShotPlan> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
      max_tokens: 2000,
      messages: [{ role: "user", content: PLAN_INSTRUCTIONS(dish, language) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as ShotPlan;
}

async function viaGemini(dish: string, language: string): Promise<ShotPlan> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? "gemini-2.5-flash"}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY!)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PLAN_INSTRUCTIONS(dish, language) }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no plan");
  return JSON.parse(text) as ShotPlan;
}

/** Deterministic fallback so the pipeline is testable with no LLM key. */
export function templatePlan(dish: string): ShotPlan {
  return {
    recipeSummary: `A tiny but real ${dish}: authentic core ingredients scaled to a 1:12 kitchen, cooked start to finish.`,
    miniatureBrief: `1:12 scale working stove, 3cm steel pan, doll-scale knife and board, edible ingredients in gram quantities. Hands in frame at all times.`,
    shots: [
      { seconds: 4, action: `Hook: finished mini ${dish} lifted toward the lens, steam rising`, camera: "macro push-in, shallow DOF", sound: "sizzle + soft clink" },
      { seconds: 5, action: "Tiny ingredients laid out and prepped by hand", camera: "top-down macro", sound: "cutting board taps" },
      { seconds: 5, action: "Knife work: real cutting of miniature portions", camera: "45° macro close-up", sound: "crisp knife cuts" },
      { seconds: 5, action: "Mixing and seasoning in a doll-scale bowl", camera: "side macro, hands visible", sound: "whisk + sprinkle" },
      { seconds: 6, action: "Cooking on the tiny working stove, continuous motion", camera: "low-angle macro on the pan", sound: "real frying ASMR" },
      { seconds: 5, action: "Folding / shaping the dish with miniature tools", camera: "macro follow", sound: "gentle pan scrape" },
      { seconds: 5, action: "Plating and garnish on a doll-scale plate", camera: "overhead macro", sound: "garnish sprinkle" },
      { seconds: 4, action: "Hero reveal: a real bite-size serving presented", camera: "slow macro orbit", sound: "soft room tone" },
    ],
    title: `Real Miniature ${dish} — Tiny Kitchen ASMR`,
    caption: `We cooked a real ${dish} in a 1:12 kitchen. Every ingredient is edible.`,
    hashtags: ["#miniaturecooking", "#minifood", "#asmr", "#tinykitchen", `#${dish.toLowerCase().replace(/[^a-z0-9]/g, "")}`],
  };
}
