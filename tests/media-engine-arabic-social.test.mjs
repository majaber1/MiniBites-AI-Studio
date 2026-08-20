import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_ACCESS_PASSWORD = "test-password-123";
process.env.SESSION_SECRET = "test-session-secret-456";
process.env.VIDEO_PROVIDER = "mock";

test("MiniBites includes 1:12 master kitchen reference with snapshot isolation", async () => {
  const { builtinProjects } = await import("../lib/projects.ts");
  const { createProduction, duplicateProduction } = await import("../lib/agents/pipeline.ts");

  const minibites = builtinProjects("user-1").find((p) => p.id === "minibites");
  assert.ok(minibites);
  assert.equal(minibites.kind, "mini_food");
  assert.ok(minibites.bible.kitchenReference, "MiniBites must have a kitchenReference in bible");
  assert.match(minibites.bible.kitchenReference.scale, /1:12/);
  assert.ok(minibites.bible.kitchenReference.approved);

  // Snapshot into production
  const prod = createProduction("Mini Shawarma", "ar", "user-1", "google", undefined, {
    projectId: minibites.id,
    projectName: minibites.name,
    projectKind: minibites.kind,
    projectBible: minibites.bible,
  });

  assert.equal(prod.audioMode, "native");
  assert.ok(prod.kitchenReference);
  assert.equal(prod.kitchenReference.scale, "1:12 miniature scale");

  // Duplicate carries over kitchen reference and audio mode
  const dupe = await duplicateProduction(prod);
  assert.equal(dupe.audioMode, "native");
  assert.ok(dupe.kitchenReference);
  assert.equal(dupe.kitchenReference.id, prod.kitchenReference.id);
});

test("Iyal Al Halal characters have stable voice profiles, wardrobe, and dialect specifications", async () => {
  const { builtinProjects } = await import("../lib/projects.ts");
  const iyal = builtinProjects("user-1").find((p) => p.id === "iyal-al-halal");
  assert.ok(iyal);
  assert.equal(iyal.bible.defaultAudioMode, "hybrid");

  const dheeban = iyal.bible.characters.find((c) => c.id === "dheeban");
  const fhaid = iyal.bible.characters.find((c) => c.id === "fhaid");
  const manfoosha = iyal.bible.characters.find((c) => c.id === "manfoosha");

  assert.ok(dheeban && fhaid && manfoosha);
  assert.equal(dheeban.voiceProfile.voiceName, "Fenrir");
  assert.match(dheeban.voiceProfile.dialect, /Jordanian Bedouin/);
  assert.ok(dheeban.wardrobe);
  assert.ok(dheeban.continuityInstructions?.length > 0);

  assert.equal(fhaid.voiceProfile.voiceName, "Puck");
  assert.match(fhaid.voiceProfile.dialect, /Saudi/);

  assert.equal(manfoosha.voiceProfile.voiceName, "Aoede");
});

test("Exact Arabic dialogue is preserved verbatim without alteration in planning", async () => {
  const { builtinProjects } = await import("../lib/projects.ts");
  const { projectTemplatePlan } = await import("../lib/studio-planner.ts");
  const { validateShotPlan } = await import("../lib/llm.ts");

  const iyal = builtinProjects("user-1").find((p) => p.id === "iyal-al-halal");
  const plan = projectTemplatePlan(
    { id: iyal.id, name: iyal.name, kind: iyal.kind, bible: iyal.bible },
    "ذيبان أول مرة يجرب الكبسة",
    "ar",
    "standard"
  );

  const validated = validateShotPlan(plan, "standard");
  assert.equal(validated.shots.length, 8);

  const shot1 = validated.shots[0];
  assert.ok(shot1.dialogue && shot1.dialogue.length > 0);
  assert.equal(shot1.dialogue[0].exactText, "يا فهيد، وش السالفة هذي؟");
  assert.equal(shot1.dialogue[0].speakerId, "dheeban");
  assert.equal(shot1.dialogue[0].voiceName, "Fenrir");

  const shot2 = validated.shots[1];
  assert.ok(shot2.dialogue && shot2.dialogue.length > 0);
  assert.equal(shot2.dialogue[0].exactText, "هذي أصولها عندنا يا ذيبان، سَمّ بالله ولا تستعجل.");
  assert.equal(shot2.dialogue[0].speakerId, "fhaid");
  assert.equal(shot2.dialogue[0].voiceName, "Puck");
});

test("Explicit Google provider choice never falls back silently to fal", async () => {
  const { getVideoProvider } = await import("../lib/providers/index.ts");
  const { GoogleVeoProvider } = await import("../lib/providers/google.ts");

  const prov = getVideoProvider("google");
  assert.ok(prov instanceof GoogleVeoProvider);
  assert.match(prov.name, /Google \(Veo/);
});

test("Integration status truthfulness: Snapchat is manual_only and media engines are classified", async () => {
  const { integrationStatuses } = await import("../lib/status.ts");
  const list = integrationStatuses();

  const snap = list.find((i) => i.key === "snapchat");
  assert.ok(snap);
  assert.equal(snap.status, "manual_only");
  assert.match(snap.detail, /MANUAL ONLY/);

  const googleImage = list.find((i) => i.key === "google-image");
  assert.ok(googleImage);
  assert.equal(googleImage.category, "media");

  const googleVeo = list.find((i) => i.key === "google-veo");
  assert.ok(googleVeo);
  assert.equal(googleVeo.category, "media");

  const googleTTS = list.find((i) => i.key === "google-tts");
  assert.ok(googleTTS);
  assert.equal(googleTTS.category, "media");
});

test("Gemini TTS module supports prebuilt voices and exact Arabic string passing", async () => {
  const { DEFAULT_CHARACTER_VOICES, PREBUILT_VOICES } = await import("../lib/audio/tts.ts");

  assert.ok(PREBUILT_VOICES.length >= 5);
  assert.ok(PREBUILT_VOICES.some((v) => v.name === "Fenrir"));
  assert.ok(PREBUILT_VOICES.some((v) => v.name === "Puck"));
  assert.ok(PREBUILT_VOICES.some((v) => v.name === "Aoede"));

  assert.equal(DEFAULT_CHARACTER_VOICES.dheeban.voiceName, "Fenrir");
  assert.equal(DEFAULT_CHARACTER_VOICES.fhaid.voiceName, "Puck");
  assert.equal(DEFAULT_CHARACTER_VOICES.manfoosha.voiceName, "Aoede");
});
