import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

process.env.VIDEO_PROVIDER = "mock";

test("template plan produces a valid 30-45s shot list", async () => {
  const { templatePlan } = await import("../lib/llm.ts");
  const plan = templatePlan("Omelette");
  assert.ok(plan.shots.length >= 6 && plan.shots.length <= 9, "6-9 shots");
  const total = plan.shots.reduce((s, x) => s + x.seconds, 0);
  assert.ok(total >= 30 && total <= 45, `total ${total}s within 30-45`);
  assert.ok(plan.hashtags.length > 0);
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

test("production pipeline plans, generates (mock) and never fakes publish", async () => {
  const { createProduction, advanceProduction } = await import("../lib/agents/pipeline.ts");
  let prod = createProduction("Omelette", "en", "test-owner");
  assert.equal(prod.status, "planning");
  prod = await advanceProduction(prod);
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

test(".env.example documents every required area and contains no secrets", () => {
  const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  for (const key of [
    "APP_ACCESS_PASSWORD", "SESSION_SECRET", "UPSTASH_REDIS_REST_URL", "VIDEO_PROVIDER", "FAL_KEY",
    "WAN_VIDEO_ENDPOINT", "YOUTUBE_CLIENT_ID", "TIKTOK_CLIENT_KEY", "MAX_PRODUCTIONS_PER_DAY", "ASSEMBLY_WEBHOOK_URL",
  ]) assert.ok(env.includes(key), `${key} documented`);
  assert.ok(!/=(sk-|key_|ghp_|github_pat_)/.test(env), "no real secrets");
});
