import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

process.env.VIDEO_PROVIDER = "mock";

test("template plan produces a valid 30-45s shot list", async () => {
  const { templatePlan, validateShotPlan } = await import("../lib/llm.ts");
  const plan = templatePlan("Omelette");
  assert.ok(plan.shots.length >= 6 && plan.shots.length <= 9, "6-9 shots");
  const total = plan.shots.reduce((s, x) => s + x.seconds, 0);
  assert.ok(total >= 30 && total <= 45, `total ${total}s within 30-45`);
  assert.ok(plan.hashtags.length > 0);
  assert.deepEqual(validateShotPlan(plan), plan);
  assert.throws(() => validateShotPlan({ ...plan, shots: plan.shots.slice(0, 2) }), /6–9 shots/);
  assert.throws(() => validateShotPlan({ ...plan, title: "" }), /title/);
});

test("length presets produce meaningfully different validated plans", async () => {
  const { templatePlan, validateShotPlan } = await import("../lib/llm.ts");
  const quick = templatePlan("Pizza", "en", "quick");
  const standard = templatePlan("Pizza", "en", "standard");
  const extended = templatePlan("Pizza", "en", "extended");
  assert.equal(validateShotPlan(quick, "quick").shots.length, 6);
  assert.equal(validateShotPlan(standard, "standard").shots.length, 8);
  assert.equal(validateShotPlan(extended, "extended").shots.length, 9);
  assert.ok(quick.shots.reduce((sum, shot) => sum + shot.seconds, 0) < extended.shots.reduce((sum, shot) => sum + shot.seconds, 0));
});

test("mock provider is clearly labeled and completes a lifecycle", async () => {
  const { MockProvider } = await import("../lib/providers/mock.ts");
  const p = new MockProvider();
  assert.equal(p.isMock, true);
  assert.match(p.name, /MOCK/);
  const { providerJobId } = await p.submitShot({ prompt: "x", negativePrompt: "y", seconds: 4, aspectRatio: "9:16" });
  const st = await p.getShotStatus(providerJobId);
  assert.ok(["in_queue", "generating", "completed"].includes(st.state));
});

test("production pipeline requires creator confirmation, generates (mock) and never fakes publish", async () => {
  const { createProduction, advanceProduction, reviseShotPlan, startGeneration } = await import("../lib/agents/pipeline.ts");
  let prod = createProduction("Omelette", "en", "test-owner");
  assert.equal(prod.status, "planning");
  prod = await advanceProduction(prod);
  assert.equal(prod.status, "planned", "planning must stop before paid generation");
  assert.equal(prod.usage.submittedShots, 0, "planning cannot submit a paid shot");
  const reordered = [...prod.shots].reverse().map(({ id, seconds, action, camera, sound }) => ({ id, seconds, action, camera, sound }));
  const previousLastAction = prod.shots.at(-1).action;
  prod = await reviseShotPlan(prod, reordered);
  assert.equal(prod.shots[0].action, previousLastAction, "creator can reorder the plan before generation");
  await assert.rejects(() => reviseShotPlan(prod, reordered.slice(0, 2)), /3 and 9 shots/);
  prod = await startGeneration(prod);
  assert.equal(prod.status, "generating");
  assert.ok(prod.shots.length >= 6);
  // advance until terminal (mock completes shots after ~15s wall-clock;
  // simulate by rewriting job ids to look old)
  for (const s of prod.shots) {
    if (s.providerJobId) s.providerJobId = `mock-0-old`;
  }
  for (let i = 0; i < 40 && ["generating", "review", "assembling"].includes(prod.status); i++) {
    prod = await advanceProduction(prod);
    for (const s of prod.shots) if (s.providerJobId) s.providerJobId = `mock-0-old`;
  }
  assert.equal(prod.status, "awaiting_approval");
  assert.equal(prod.approved, false, "manual approval required");
  for (const pub of prod.publish) assert.notEqual(pub.status, "published");
});

test("clip review preserves completed versions and requires acceptance before assembly", async () => {
  const { createProduction, regenerateShot, setShotAcceptance, startAssembly } = await import("../lib/agents/pipeline.ts");
  let prod = createProduction("Kabsa", "en", "review-owner");
  prod.providerIsMock = false;
  prod.status = "review";
  prod.shots = [{
    id: "shot_1", index: 1, seconds: 5, action: "Reveal", camera: "Macro", sound: "Sizzle",
    prompt: "safe prompt", negativePrompt: "safe negative", status: "completed", attempts: 1,
    videoUrl: "https://media.example/shot-v1.mp4", accepted: false,
    versions: [{ version: 1, videoUrl: "https://media.example/shot-v1.mp4", prompt: "safe prompt", createdAt: new Date().toISOString(), accepted: false }],
  }];
  await assert.rejects(() => startAssembly(prod), /Accept every completed clip/);
  prod = await setShotAcceptance(prod, "shot_1", true);
  assert.equal(prod.shots[0].accepted, true);
  prod = await regenerateShot(prod, "shot_1");
  assert.equal(prod.status, "generating");
  assert.equal(prod.shots[0].videoUrl, undefined);
  assert.equal(prod.shots[0].versions.length, 1, "the accepted v1 URL remains recoverable");
  assert.equal(prod.shots[0].versions[0].videoUrl, "https://media.example/shot-v1.mp4");
});

test("project duplication reuses the editable plan but never paid media or jobs", async () => {
  const { createProduction, duplicateProduction } = await import("../lib/agents/pipeline.ts");
  const source = createProduction("Mandi", "ar", "duplicate-owner");
  source.status = "approved";
  source.shots = [{ id: "shot_1", index: 1, seconds: 5, action: "Reveal", camera: "Macro", sound: "Sizzle", prompt: "prompt", negativePrompt: "negative", status: "completed", attempts: 2, providerJobId: "paid-job", videoUrl: "https://media.example/paid.mp4", accepted: true, versions: [{ version: 1, videoUrl: "https://media.example/paid.mp4", prompt: "prompt", createdAt: new Date().toISOString(), accepted: true }] }];
  source.finalVideoUrl = "https://media.example/final.mp4";
  const copy = await duplicateProduction(source);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.status, "planned");
  assert.equal(copy.shots[0].status, "planned");
  assert.equal(copy.shots[0].attempts, 0);
  assert.equal(copy.shots[0].videoUrl, undefined);
  assert.equal(copy.shots[0].providerJobId, undefined);
  assert.equal(copy.shots[0].versions, undefined);
  assert.equal(copy.finalVideoUrl, undefined);
});

test(".env.example documents every required area and contains no secrets", () => {
  const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  for (const key of [
    "APP_ACCESS_PASSWORD", "SESSION_SECRET", "UPSTASH_REDIS_REST_URL", "VIDEO_PROVIDER", "FAL_KEY",
    "WAN_VIDEO_ENDPOINT", "YOUTUBE_CLIENT_ID", "YOUTUBE_PRIVACY", "TIKTOK_CLIENT_KEY", "MAX_PRODUCTIONS_PER_DAY",
  ]) assert.ok(env.includes(key), `${key} documented`);
  assert.ok(!/=(sk-|key_|ghp_|github_pat_)/.test(env), "no real secrets");
});
