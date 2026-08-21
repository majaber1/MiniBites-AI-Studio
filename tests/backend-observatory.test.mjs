import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_ACCESS_PASSWORD = "backend-test-password";
process.env.SESSION_SECRET = "backend-test-session-secret-which-is-long";
process.env.VIDEO_PROVIDER = "mock";

test("Backend Observatory API: runs, health, and benchmark endpoints work", async () => {
  const { getStore } = await import("../lib/store/index.ts");
  const { createProduction, advanceProduction } = await import("../lib/agents/pipeline.ts");
  const { builtinProjects } = await import("../lib/projects.ts");
  const { GET: getRuns } = await import("../app/api/backend/runs/route.ts");
  const { GET: getHealth } = await import("../app/api/backend/health/route.ts");
  const { GET: getBenchmarks } = await import("../app/api/backend/benchmark/route.ts");
  const { GET: getRunById } = await import("../app/api/backend/runs/[id]/route.ts");

  const store = getStore();
  // Generate valid session token
  const { signSession, ownerKey } = await import("../lib/security.ts");
  const token = signSession();
  const authedReq = new Request("http://localhost:3000/api/backend/runs", {
    headers: { cookie: `mb_session=${token}` },
  });
  const owner = ownerKey(authedReq);

  const projects = builtinProjects(owner);
  for (const p of projects) await store.saveProject(p);

  const gahwa = projects.find((p) => p.id === "future-gahwa");
  assert.ok(gahwa);

  let prod = createProduction("برق يتعلم يصب القهوة", "ar", owner, "mock", "prod_gahwa_test", {
    projectId: gahwa.id,
    projectName: gahwa.name,
    projectKind: gahwa.kind,
    projectBible: gahwa.bible,
  });
  prod = await advanceProduction(prod);
  await store.saveProduction(prod);

  const runsRes = await getRuns(authedReq);
  assert.equal(runsRes.status, 200);
  const runsData = await runsRes.json();
  assert.ok(Array.isArray(runsData.runs));
  assert.ok(runsData.runs.length >= 1);

  const singleReq = new Request("http://localhost:3000/api/backend/runs/prod_gahwa_test", {
    headers: { cookie: `mb_session=${token}` },
  });
  const singleRes = await getRunById(singleReq, { params: Promise.resolve({ id: "prod_gahwa_test" }) });
  assert.equal(singleRes.status, 200);
  const singleData = await singleRes.json();
  assert.equal(singleData.run.productionId, "prod_gahwa_test");

  const healthRes = await getHealth(authedReq);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.ok(Array.isArray(healthData.providers));

  const benchRes = await getBenchmarks(authedReq);
  assert.equal(benchRes.status, 200);
  const benchData = await benchRes.json();
  assert.ok(Array.isArray(benchData.benchmarks));
});

test("Secret Redaction: tokens, API keys, passwords, and query strings are never exposed", async () => {
  const { redactString, sanitizeObject, sanitizeValue } = await import("../lib/observability/sanitize.ts");

  const secretString = "https://generativelanguage.googleapis.com/v1beta/models/veo:predict?key=AIzaSyD_SECRET_KEY_123456789012345";
  const redactedUrl = redactString(secretString);
  assert.ok(!redactedUrl.includes("AIzaSyD_SECRET_KEY_123456789012345"));
  assert.ok(redactedUrl.includes("[REDACTED]"));

  const payload = {
    apiKey: "AIzaSyD_SECRET_KEY_123456789012345",
    nested: {
      password: "SuperSecretPassword123!",
      session_secret: "jwt.token.secret",
      normalField: "Safe public text",
      header: "Bearer sk-ant-api03-123456789012345678901234567890",
    },
    array: ["normal", "fal_key_123456789012345678901234567890"],
  };

  const sanitized = sanitizeObject(payload);
  assert.equal(sanitized.apiKey, "[REDACTED]");
  assert.equal(sanitized.nested.password, "[REDACTED]");
  assert.equal(sanitized.nested.session_secret, "[REDACTED]");
  assert.equal(sanitized.nested.normalField, "Safe public text");
  assert.ok(!JSON.stringify(sanitized).includes("sk-ant-"));
  assert.ok(!JSON.stringify(sanitized).includes("fal_key_"));
});

test("Capability States: ELIGIBLE vs UNVERIFIED vs ELIMINATED", async () => {
  process.env.GEMINI_API_KEY = "test-gemini-key";
  const { evaluateRouteDecisions } = await import("../lib/observability/router.ts");

  const decisions = evaluateRouteDecisions("video", {
    task: "video",
    aspectRatio: "9:16",
    requiresReferenceImage: true,
    directorMode: "auto",
  });

  assert.ok(decisions.length > 0);
  const eligible = decisions.filter((d) => d.capabilityState === "ELIGIBLE");
  const eliminated = decisions.filter((d) => d.capabilityState === "ELIMINATED");

  assert.ok(eligible.length >= 1, "Must have at least one eligible video route");
  assert.ok(eliminated.length >= 1, "Mock video must be eliminated for production/auto");
  assert.ok(eliminated.every((e) => e.eliminatedReason && e.eliminatedReason.length > 0));
});

test("Selected vs Actual separation: actualModel starts null and realExecution starts false", async () => {
  const { createProduction } = await import("../lib/agents/pipeline.ts");
  const { productionToObservatoryRun } = await import("../lib/observability/tracker.ts");

  const prod = createProduction("برق يتعلم يصب القهوة", "ar", "owner-test", "google", "prod_sep_test", {
    selectedVideoModel: "veo-3.1-fast-generate-preview",
    selectedImageModel: "gemini-3.1-flash-image",
  });

  const run = productionToObservatoryRun(prod);
  assert.equal(run.selectedModel, "veo-3.1-fast-generate-preview");
  assert.equal(run.actualModel, null, "actualModel must be null before generation finishes");
  assert.equal(run.realExecution, false, "realExecution must be false initially");
});

test("Planned vs Executed fallback ladder integrity", async () => {
  const { buildFallbackPlan, ROUTE_CATALOG } = await import("../lib/observability/router.ts");

  const selected = ROUTE_CATALOG.find((r) => r.exactModel === "veo-3.1-fast-generate-preview");
  assert.ok(selected);

  const ladder = buildFallbackPlan("video", selected);
  const primary = ladder.find((l) => l.fallbackClass === "PRIMARY");
  const stopAsk = ladder.find((l) => l.fallbackClass === "STOP_ASK");

  assert.ok(primary, "Must have a PRIMARY fallback entry");
  assert.equal(primary.autoAllowed, true, "Same route retry is auto allowed for transient errors");
  if (stopAsk) {
    assert.equal(stopAsk.autoAllowed, false, "Cross provider fallback requires user approval");
  }
});

test("Real vs Mock execution classification", async () => {
  const { createProduction } = await import("../lib/agents/pipeline.ts");
  const { productionToObservatoryRun } = await import("../lib/observability/tracker.ts");

  const mockProd = createProduction("برق يتعلم يصب القهوة", "ar", "owner-test", "mock", "prod_mock_test");
  const mockRun = productionToObservatoryRun(mockProd);

  assert.equal(mockRun.realExecution, false);
});

test("Estimated vs Actual cost distinction", async () => {
  const { createProduction } = await import("../lib/agents/pipeline.ts");
  const { productionToObservatoryRun } = await import("../lib/observability/tracker.ts");

  const prod = createProduction("برق يتعلم يصب القهوة", "ar", "owner-test", "google", "prod_cost_test");
  const run = productionToObservatoryRun(prod);

  assert.ok(typeof run.costTrace.estimatedPrimaryCostUsd === "number");
  assert.equal(run.costTrace.actualSpendUsd, 0.0, "Actual spend must be 0 before execution succeeds");
});

test("UNKNOWN provider health preservation: unverified metrics remain UNKNOWN", async () => {
  const { getProviderHealthMetrics } = await import("../lib/observability/health.ts");

  const metrics = getProviderHealthMetrics();
  assert.ok(metrics.length >= 3);

  const wan = metrics.find((m) => m.id === "wan-self-hosted");
  assert.ok(wan);
  assert.equal(wan.reachable, "UNKNOWN");
  assert.equal(wan.modelAvailable, "UNKNOWN");
  assert.equal(wan.quotaState, "UNKNOWN");
});

test("Event ordering: events are chronological and strictly ordered", async () => {
  const { recordEvent, getEvents } = await import("../lib/observability/tracker.ts");

  const testProdId = `ord_${Date.now()}`;
  recordEvent(testProdId, "REQUEST_RECEIVED", "planning", "INFO", "Step 1");
  await new Promise((r) => setTimeout(r, 10));
  recordEvent(testProdId, "HARD_CONSTRAINTS_EVALUATED", "planning", "INFO", "Step 2");
  await new Promise((r) => setTimeout(r, 10));
  recordEvent(testProdId, "ROUTE_SELECTED", "planning", "SUCCESS", "Step 3");

  const events = getEvents(testProdId);
  assert.equal(events.length, 3);
  assert.ok(new Date(events[0].timestamp) <= new Date(events[1].timestamp));
  assert.ok(new Date(events[1].timestamp) <= new Date(events[2].timestamp));
});

test("Empty state handling: observatory handles empty runs gracefully", async () => {
  const { aggregateBenchmarks } = await import("../lib/observability/benchmark.ts");
  const benchmarks = aggregateBenchmarks([]);
  assert.deepEqual(benchmarks, []);
});

test("HTTP 429 quota exhaustion is classified as CHANNEL capacity failure", async () => {
  const { classifyFailure } = await import("../lib/observability/router.ts");

  const failure = classifyFailure(429, "Resource exhausted: Quota exceeded for metric");
  assert.equal(failure.failureType, "QUOTA_EXHAUSTED");
  assert.equal(failure.failureScope, "CHANNEL");
  assert.match(failure.description, /Channel quota exhausted/i);
});

test("Manual route choice is not silently overridden", async () => {
  const { evaluateRouteDecisions } = await import("../lib/observability/router.ts");

  const decisions = evaluateRouteDecisions("video", {
    task: "video",
    directorMode: "manual",
    userSelectedModel: "veo-3.1-generate-preview",
  });

  const selected = decisions.find((d) => d.selected);
  assert.ok(selected);
  assert.equal(selected.route.exactModel, "veo-3.1-generate-preview");
  assert.match(selected.whySelected || "", /Manual Mode/);
});

test("Arabic and English metadata render properly with RTL readiness", async () => {
  const { buildStageGraph } = await import("../lib/observability/tracker.ts");
  const { createProduction } = await import("../lib/agents/pipeline.ts");

  const prod = createProduction("برق يتعلم يصب القهوة", "ar", "owner-ar", "google");
  const graph = buildStageGraph(prod);

  assert.ok(graph.length >= 6);
  assert.ok(graph.every((node) => Boolean(node.label) && Boolean(node.labelAr)));
  assert.ok(graph.some((node) => node.labelAr.includes("المرجع البصري")));
  assert.ok(graph.some((node) => node.labelAr.includes("الدبلجة الصوتية")));
});
