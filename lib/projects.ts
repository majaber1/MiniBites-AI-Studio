import type { ProjectBible, ProjectKind, ProviderChoice, StudioProject } from "./types";

const now = () => new Date().toISOString();

export function defaultBible(kind: ProjectKind): ProjectBible {
  if (kind === "character_series") {
    return {
      concept: "Recurring character-led short-form series.",
      language: "ar",
      visualStyle: "Polished cinematic 3D cartoon with stable character identity and consistent wardrobe.",
      aspectRatio: "9:16",
      defaultDurationSeconds: 50,
      tone: "Warm, funny and culturally respectful.",
      continuityRules: [
        "Keep the same face, wool, body proportions and wardrobe across every shot.",
        "Use the same voice profile and dialect for each recurring character.",
        "Preserve location, time-of-day and key props within a scene sequence.",
      ],
      negativeRules: ["No random costume changes", "No character face drift", "No subtitles burned into generated footage"],
    };
  }
  if (kind === "commercial_campaign") {
    return {
      concept: "Brand-safe short-form commercial campaign.",
      language: "mixed",
      visualStyle: "Premium commercial realism with clear brand-safe framing.",
      aspectRatio: "9:16",
      defaultDurationSeconds: 30,
      tone: "Clear, premium and conversion-aware.",
      continuityRules: ["Keep product appearance and brand assets stable across shots."],
      negativeRules: ["No unapproved logos", "No unsupported claims"],
    };
  }
  if (kind === "general_video") {
    return {
      concept: "General short-form AI video project.",
      language: "mixed",
      visualStyle: "Cinematic short-form video.",
      aspectRatio: "9:16",
      defaultDurationSeconds: 40,
      continuityRules: ["Maintain subject, wardrobe and environment continuity across shots."],
    };
  }
  return {
    concept: "Real miniature-cooking vertical videos using edible ingredients and working dollhouse-scale tools.",
    language: "mixed",
    visualStyle: "Ultra-realistic macro miniature cooking, soft natural light, shallow depth of field.",
    aspectRatio: "9:16",
    defaultDurationSeconds: 38,
    tone: "Satisfying, tactile and premium.",
    defaultAudioMode: "native",
    kitchenReference: {
      id: "minibites-master-kitchen",
      name: "MiniBites 1:12 Master Kitchen",
      scale: "1:12 miniature scale",
      environment: "Real working miniature kitchen with stainless steel mini stove, wooden prep counter, miniature cookware, tiny utensils, and macro studio staging.",
      lighting: "Soft warm natural daylight with gentle food-studio highlights",
      palette: "Warm wood, polished steel, terracotta and fresh food tones",
      approved: true,
      notes: "Permanent kitchen anchor. Maintain same stove, board, pan, and adult hands across all shots.",
      prompt: "Ultra-realistic macro photograph of a 1:12 scale real working miniature kitchen. Wooden countertop, miniature stainless steel burner stove, tiny copper pan, micro chef knife, mini ceramic plate, realistic edible ingredients in tiny portions, soft natural lighting, shallow depth of field, 9:16 vertical composition.",
    },
    continuityRules: [
      "Real adult hands only.",
      "Use the same 1:12 kitchen, stove, board, utensils and serving plate across the episode.",
      "All ingredients are real and edible.",
      "Maintain native kitchen ASMR: knife chops, sizzling, utensil taps, liquid bubbling.",
    ],
    negativeRules: ["No cartoon chefs", "No toy people", "No slideshow stills", "No normal-size cookware", "No voiceover narration"],
  };
}

export function builtinProjects(ownerKey: string): StudioProject[] {
  const stamp = now();
  return [
    {
      id: "minibites",
      slug: "minibites",
      name: "MiniBites",
      nameAr: "ميني بايتس",
      icon: "🍔",
      kind: "mini_food",
      status: "active",
      description: "Real miniature-cooking shorts. The original Kiswani production project.",
      descriptionAr: "مقاطع طبخ مصغّر واقعية — المشروع الأصلي داخل استوديو كسواني.",
      defaultProvider: "fal",
      bible: defaultBible("mini_food"),
      createdAt: stamp,
      updatedAt: stamp,
      ownerKey,
      systemPreset: true,
    },
    {
      id: "iyal-al-halal",
      slug: "iyal-al-halal",
      name: "Iyal Al Halal",
      nameAr: "عيال الحلال",
      icon: "🐑",
      kind: "character_series",
      status: "active",
      description: "Jordanian Bedouin × Saudi character comedy built for recurring vertical episodes.",
      descriptionAr: "كوميديا شخصيات أردنية بدوية × سعودية مصممة كسلسلة حلقات قصيرة متكررة.",
      defaultProvider: "google",
      bible: {
        ...defaultBible("character_series"),
        concept: "كوميديا يومية خفيفة تجمع شخصية أردنية بدوية وشخصية سعودية في مواقف خليجية/أردنية، مع احترام اللهجتين والثقافتين.",
        dialects: ["Jordanian Bedouin Arabic", "Saudi Arabic"],
        locations: ["Riyadh", "Jordanian desert", "Bedouin tent", "Saudi majlis", "farm", "city streets"],
        tone: "طقطقة محترمة، فزعة، كرم، مواقف يومية، بدون إساءة للشعوب أو القبائل.",
        defaultAudioMode: "hybrid",
        characters: [
          {
            id: "dheeban",
            name: "Dheeban",
            displayNameAr: "ذيبان",
            role: "Jordanian Bedouin lead",
            dialect: "Jordanian Bedouin",
            voiceStyle: "Warm gravelly male voice, confident, dry humor.",
            voiceProfile: {
              voiceName: "Fenrir",
              direction: "Jordanian Bedouin direction, male, warm, slightly gravelly, confident, natural humor, moderate pace",
              language: "ar",
              dialect: "Jordanian Bedouin Arabic",
            },
            visualNotes: "Anthropomorphic fluffy sheep, Jordanian Bedouin styling, stable face and body proportions, traditional red-and-white headscarf and desert details.",
            wardrobe: "Traditional Jordanian Bedouin red-and-white shemagh/keffiyeh with black agal, desert vest, natural textured wool.",
            personality: "فزعة، كريم، عنيد شوي، يرد بسرعة ويحب يثبت إن طريقته الصح.",
            continuityInstructions: [
              "Always maintain identical face, horn shape, wool texture, and Jordanian red-and-white shemagh across every shot.",
              "Never swap wardrobe with Saudi characters.",
              "Preserve Jordanian Bedouin dialect and dry comedic timing.",
            ],
          },
          {
            id: "fhaid",
            name: "Fhaid",
            displayNameAr: "فهيد",
            role: "Saudi lead",
            dialect: "Saudi Arabic",
            voiceStyle: "Friendly Saudi male voice, relaxed delivery, quick comedic timing.",
            voiceProfile: {
              voiceName: "Puck",
              direction: "Saudi direction, male, relaxed, friendly, intelligent comedic timing, natural delivery",
              language: "ar",
              dialect: "Saudi Arabic",
            },
            visualNotes: "Anthropomorphic fluffy sheep in clean Saudi thobe and shemagh, stable face, polished 3D character design.",
            wardrobe: "Crisp white Saudi thobe, red/white or white shemagh, neat agal, bright groomed wool.",
            personality: "هادي، ذكي، يطقطق بدون ما يرفع صوته ويعرف كيف يورط ذيبان بكلمة.",
            continuityInstructions: [
              "Always maintain identical face, clean white thobe, and neat shemagh across every shot.",
              "Never swap wardrobe with Jordanian characters.",
              "Preserve Saudi dialect, relaxed cadence, and calm comedic delivery.",
            ],
          },
          {
            id: "manfoosha",
            name: "Manfoosha",
            displayNameAr: "منفوشة",
            role: "Scene-stealing supporting character",
            dialect: "Arabic",
            voiceStyle: "Expressive female comic voice.",
            voiceProfile: {
              voiceName: "Aoede",
              direction: "Arabic direction, female, expressive, fast comic timing, natural delivery",
              language: "ar",
              dialect: "Arabic",
            },
            visualNotes: "Fluffy sheep with a distinctive feminine silhouette/accessory; never over-humanized; same face and wool every episode.",
            wardrobe: "Distinctive feminine accessory/scarf, neatly styled fluffy wool.",
            personality: "أذكى من الاثنين وغالبًا هي اللي تقفل النقاش بالنهاية.",
            continuityInstructions: [
              "Maintain consistent wool volume, feminine accessory, and expressive facial silhouette.",
              "Sharp, witty Arabic delivery.",
            ],
          },
        ],
        continuityRules: [
          "ذيبان يحافظ دائمًا على ملامحه ولبسه الأردني البدوي وصوته ولهجته.",
          "فهيد يحافظ دائمًا على ملامحه ولبسه السعودي وصوته ولهجته.",
          "منفوشة تبقى بنفس لون الصوف والوجه والإكسسوار المرجعي.",
          "الطقطقة تكون بين الشخصيات لا على الجنسية أو القبيلة.",
          "كل Shot يرث نفس Character References وWorld Bible قبل التوليد.",
        ],
        negativeRules: [
          "No identity drift",
          "No random human hands unless explicitly in the story",
          "No offensive national/tribal stereotypes",
          "No costume swapping between Jordanian and Saudi characters",
          "No text or watermark generated inside the scene",
        ],
      },
      createdAt: stamp,
      updatedAt: stamp,
      ownerKey,
      systemPreset: true,
    },
  ];
}

export function makeProject(input: {
  name: string;
  nameAr?: string;
  kind: ProjectKind;
  description?: string;
  defaultProvider?: ProviderChoice;
  ownerKey: string;
}): StudioProject {
  const stamp = now();
  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `project-${Date.now().toString(36)}`;
  return {
    id: `ks_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    slug,
    name: input.name.trim(),
    nameAr: input.nameAr?.trim() || undefined,
    kind: input.kind,
    status: "active",
    description: input.description?.trim() || "Kiswani AI Studio project",
    defaultProvider: input.defaultProvider,
    bible: defaultBible(input.kind),
    createdAt: stamp,
    updatedAt: stamp,
    ownerKey: input.ownerKey,
  };
}
