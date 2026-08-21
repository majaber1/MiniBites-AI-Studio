import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_ACCESS_PASSWORD = "future-test-password";
process.env.SESSION_SECRET = "future-test-session-secret";
process.env.VIDEO_PROVIDER = "mock";

test("Future Gahwa is registered as a distinct character series with Abu Nasser and Barq", async () => {
  const { builtinProjects } = await import("../lib/projects.ts");
  const projects = builtinProjects("owner-gahwa");
  const gahwa = projects.find((p) => p.id === "future-gahwa");
  assert.ok(gahwa, "Future Gahwa must exist in builtin projects");
  assert.equal(gahwa.kind, "character_series");
  assert.equal(gahwa.bible.defaultAudioMode, "hybrid");

  // Verify characters
  assert.equal(gahwa.bible.characters?.length, 2);
  const abuNasser = gahwa.bible.characters.find((c) => c.id === "abu-nasser");
  const barq = gahwa.bible.characters.find((c) => c.id === "barq");

  assert.ok(abuNasser && barq);
  assert.equal(abuNasser.voiceProfile?.voiceName, "Orus");
  assert.match(abuNasser.voiceProfile?.dialect, /Najdi/);
  assert.match(abuNasser.wardrobe, /Saudi thobe/);

  assert.equal(barq.voiceProfile?.voiceName, "Puck");
  assert.match(barq.voiceProfile?.direction, /robotic/);
  assert.match(barq.wardrobe, /pearl white/);

  // Separation check: No MiniBites kitchen assets, no animal characters
  assert.equal(gahwa.bible.kitchenReference, undefined);
  assert.ok(!gahwa.bible.characters.some((c) => c.id === "dheeban"));
});

test("Future Gahwa shot planning produces exact Arabic dialogue for Barq & Abu Nasser", async () => {
  const { builtinProjects } = await import("../lib/projects.ts");
  const { projectTemplatePlan } = await import("../lib/studio-planner.ts");
  const { validateShotPlan } = await import("../lib/llm.ts");

  const gahwa = builtinProjects("owner-gahwa").find((p) => p.id === "future-gahwa");
  const plan = projectTemplatePlan(
    { id: gahwa.id, name: gahwa.name, kind: gahwa.kind, bible: gahwa.bible },
    "برق يتعلم يصب القهوة",
    "ar",
    "standard"
  );

  const validated = validateShotPlan(plan, "standard");
  assert.ok(validated.shots.length >= 6);

  // Check exact Arabic dialogue lines
  const lines = validated.shots.flatMap((s) => s.dialogue?.map((d) => d.exactText) ?? []);
  assert.ok(lines.includes("أبو ناصر، حسبت زاوية الصب المثالية: سبعة وثلاثين فاصلة اثنين درجة."));
  assert.ok(lines.includes("يا ولدي، صب القهوة بس."));
  assert.ok(lines.includes("لكن الخوارزمية تقول—"));
  assert.ok(lines.includes("والضيف يقول عطشان."));
  assert.ok(lines.includes("تم التحديث: الكرم يتفوق على الخوارزمية!"));
});

test("Auto Director vs Manual mode initialization and Generation Monitor transparency", async () => {
  const { createProduction } = await import("../lib/agents/pipeline.ts");
  const { builtinProjects } = await import("../lib/projects.ts");

  const gahwa = builtinProjects("owner-gahwa").find((p) => p.id === "future-gahwa");

  // 1. Auto mode
  const autoProd = createProduction("برق يتعلم يصب القهوة", "ar", "owner-gahwa", "google", undefined, {
    projectId: gahwa.id,
    projectName: gahwa.name,
    projectKind: gahwa.kind,
    projectBible: gahwa.bible,
    directorMode: "auto",
  });

  assert.equal(autoProd.directorMode, "auto");
  assert.equal(autoProd.audioMode, "hybrid");
  assert.ok(autoProd.generationMonitor);
  assert.equal(autoProd.generationMonitor.length, 7);

  const planEntry = autoProd.generationMonitor.find((m) => m.stage === "planning");
  const videoEntry = autoProd.generationMonitor.find((m) => m.stage === "video");
  const imgEntry = autoProd.generationMonitor.find((m) => m.stage === "reference_image");

  assert.ok(planEntry && videoEntry && imgEntry);
  assert.equal(planEntry.fallbackUsed, false);
  assert.match(planEntry.whySelected, /Auto Director/);

  // 2. Manual mode
  const manualProd = createProduction("برق يتعلم يصب القهوة", "ar", "owner-gahwa", "google", undefined, {
    projectId: gahwa.id,
    projectName: gahwa.name,
    projectKind: gahwa.kind,
    projectBible: gahwa.bible,
    directorMode: "manual",
    selectedImageModel: "imagen-3.0-generate-002",
    selectedVideoModel: "veo-3.1-generate-preview",
    selectedTTSModel: "gemini-3.1-flash-tts-preview",
  });

  assert.equal(manualProd.directorMode, "manual");
  assert.equal(manualProd.selectedImageModel, "imagen-3.0-generate-002");
  assert.equal(manualProd.selectedVideoModel, "veo-3.1-generate-preview");
});

test("Abu Nasser and Barq prebuilt voice previews are configured in Gemini TTS", async () => {
  const { DEFAULT_CHARACTER_VOICES } = await import("../lib/audio/tts.ts");
  assert.equal(DEFAULT_CHARACTER_VOICES["abu-nasser"].voiceName, "Orus");
  assert.equal(DEFAULT_CHARACTER_VOICES.barq.voiceName, "Puck");
});

test("Creates test episodes across all projects (Future Gahwa, Iyal Al Halal, MiniBites)", async () => {
  const { getStore } = await import("../lib/store/index.ts");
  const { createProduction, advanceProduction } = await import("../lib/agents/pipeline.ts");
  const { builtinProjects } = await import("../lib/projects.ts");

  const store = getStore();
  const projects = builtinProjects("test-creator");
  for (const p of projects) {
    await store.saveProject(p);
  }

  const gahwa = projects.find((p) => p.id === "future-gahwa");
  const iyal = projects.find((p) => p.id === "iyal-al-halal");
  const mini = projects.find((p) => p.id === "minibites");

  assert.ok(gahwa && iyal && mini);

  // 1. Future Gahwa episode: "برق يتعلم يصب القهوة"
  let ep1 = createProduction("برق يتعلم يصب القهوة", "ar", "test-creator", "mock", undefined, {
    projectId: gahwa.id,
    projectName: gahwa.name,
    projectKind: gahwa.kind,
    projectBible: gahwa.bible,
    directorMode: "auto",
    style: "playful",
    storyMode: "funny",
    durationPreset: "standard",
    audioMode: "hybrid",
  });
  ep1 = await advanceProduction(ep1);
  await store.saveProduction(ep1);

  assert.equal(ep1.status, "planned");
  assert.ok(ep1.shots.length >= 6);
  assert.equal(ep1.directorMode, "auto");
  assert.equal(ep1.audioMode, "hybrid");
  assert.ok(ep1.generationMonitor?.length === 7);

  // 2. Future Gahwa episode: "برق ومسألة التمر السكري"
  let ep2 = createProduction("برق ومسألة التمر السكري", "ar", "test-creator", "mock", undefined, {
    projectId: gahwa.id,
    projectName: gahwa.name,
    projectKind: gahwa.kind,
    projectBible: gahwa.bible,
    directorMode: "auto",
    style: "traditional",
    storyMode: "funny",
    durationPreset: "quick",
    audioMode: "hybrid",
  });
  ep2 = await advanceProduction(ep2);
  await store.saveProduction(ep2);

  assert.equal(ep2.status, "planned");
  assert.ok(ep2.shots.length >= 3);

  // 3. Iyal Al Halal episode: "ذيبان أول مرة يجرب الكبسة"
  let ep3 = createProduction("ذيبان أول مرة يجرب الكبسة", "ar", "test-creator", "mock", undefined, {
    projectId: iyal.id,
    projectName: iyal.name,
    projectKind: iyal.kind,
    projectBible: iyal.bible,
    directorMode: "auto",
    style: "playful",
    storyMode: "funny",
    durationPreset: "standard",
    audioMode: "hybrid",
  });
  ep3 = await advanceProduction(ep3);
  await store.saveProduction(ep3);

  assert.equal(ep3.status, "planned");
  assert.ok(ep3.shots.length >= 6);

  // 4. MiniBites episode: "Mini Saudi Kabsa"
  let ep4 = createProduction("Mini Saudi Kabsa", "en", "test-creator", "mock", undefined, {
    projectId: mini.id,
    projectName: mini.name,
    projectKind: mini.kind,
    projectBible: mini.bible,
    directorMode: "auto",
    style: "cinematic",
    storyMode: "satisfying",
    durationPreset: "standard",
    audioMode: "native",
  });
  ep4 = await advanceProduction(ep4);
  await store.saveProduction(ep4);

  assert.equal(ep4.status, "planned");
  assert.ok(ep4.shots.length >= 6);
  assert.ok(ep4.kitchenReference);

  const stored = await store.listProductions("test-creator");
  assert.ok(stored.length >= 4);
});
