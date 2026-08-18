import test from "node:test";
import assert from "node:assert";

process.env.VIDEO_PROVIDER = "mock";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;

test("Kiswani ships MiniBites and Iyal Al Halal as separate projects", async () => {
  const { builtinProjects } = await import("../lib/projects.ts");
  const projects = builtinProjects("owner-1");
  assert.deepEqual(projects.map((p) => p.id), ["minibites", "iyal-al-halal"]);
  const iyal = projects.find((p) => p.id === "iyal-al-halal");
  assert.equal(iyal.kind, "character_series");
  assert.deepEqual(iyal.bible.characters.map((c) => c.id), ["dheeban", "fhaid", "manfoosha"]);
  assert.ok(iyal.bible.continuityRules.some((rule) => rule.includes("ذيبان")));
});

test("character-series fallback plan is a valid short and does not become miniature cooking", async () => {
  const { builtinProjects } = await import("../lib/projects.ts");
  const { projectTemplatePlan } = await import("../lib/studio-planner.ts");
  const { validateShotPlan } = await import("../lib/llm.ts");
  const iyal = builtinProjects("owner-1").find((p) => p.id === "iyal-al-halal");
  const plan = projectTemplatePlan({ id: iyal.id, name: iyal.name, kind: iyal.kind, bible: iyal.bible }, "ذيبان أول مرة يجرب الكبسة", "ar", "standard");
  assert.equal(validateShotPlan(plan, "standard").shots.length, 8);
  assert.match(plan.miniatureBrief, /ثبات الشخصيات/);
  assert.doesNotMatch(plan.miniatureBrief, /1:12/);
});

test("project-aware production snapshots the bible and uses character prompts", async () => {
  const { builtinProjects } = await import("../lib/projects.ts");
  const { createProduction, advanceProduction } = await import("../lib/agents/pipeline.ts");
  const iyal = builtinProjects("owner-2").find((p) => p.id === "iyal-al-halal");
  let p = createProduction("فهيد في عزيمة منسف", "ar", "owner-2", undefined, undefined, {
    projectId: iyal.id,
    projectName: iyal.name,
    projectKind: iyal.kind,
    projectBible: iyal.bible,
    style: "playful",
    storyMode: "funny",
  });
  assert.equal(p.projectId, "iyal-al-halal");
  assert.notEqual(p.projectBible, iyal.bible, "episode keeps its own Project Bible snapshot");
  p = await advanceProduction(p);
  assert.equal(p.status, "planned");
  assert.ok(p.shots.length >= 6);
  assert.match(p.shots[0].prompt, /Preserve exact recurring character identity/);
  assert.match(p.shots[0].prompt, /Iyal Al Halal/);
  assert.doesNotMatch(p.shots[0].prompt, /real miniature/);
});

test("legacy MiniBites creation remains backward compatible", async () => {
  const { createProduction, advanceProduction } = await import("../lib/agents/pipeline.ts");
  let p = createProduction("Kabsa", "en", "legacy-owner");
  assert.equal(p.projectId, "minibites");
  assert.equal(p.projectKind, "mini_food");
  p = await advanceProduction(p);
  assert.equal(p.status, "planned");
  assert.match(p.shots[0].prompt, /real miniature/i);
});

test("memory store persists projects separately from productions", async () => {
  const { MemoryStore } = await import("../lib/store/memory.ts");
  const { builtinProjects } = await import("../lib/projects.ts");
  const store = new MemoryStore();
  const project = builtinProjects("owner-3")[1];
  await store.saveProject(project);
  assert.equal((await store.getProject("iyal-al-halal")).name, "Iyal Al Halal");
  assert.equal((await store.listProjects("owner-3")).length, 1);
});
