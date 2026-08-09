import test from "node:test";
import assert from "node:assert/strict";

const { environmentReport } = await import("../lib/config.ts");

const managedNames = [
  "APP_ACCESS_PASSWORD", "SESSION_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "VIDEO_PROVIDER", "FAL_KEY", "GEMINI_API_KEY", "WAN_VIDEO_ENDPOINT",
];

function withEnvironment(values, run) {
  const previous = Object.fromEntries(managedNames.map((name) => [name, process.env[name]]));
  for (const name of managedNames) delete process.env[name];
  Object.assign(process.env, values);
  try {
    return run();
  } finally {
    for (const name of managedNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test("environment report exposes configuration state but never secret values", () => {
  withEnvironment({
    VIDEO_PROVIDER: "fal",
    APP_ACCESS_PASSWORD: "do-not-leak-password",
    SESSION_SECRET: "do-not-leak-session",
    UPSTASH_REDIS_REST_URL: "https://private.example",
    UPSTASH_REDIS_REST_TOKEN: "do-not-leak-token",
    FAL_KEY: "do-not-leak-fal-key",
  }, () => {
    const report = environmentReport();
    assert.equal(report.productionReady, true);
    assert.deepEqual(report.missingRequired, []);
    assert.equal(JSON.stringify(report).includes("do-not-leak"), false);
    assert.equal(JSON.stringify(report).includes("private.example"), false);
    assert.ok(report.entries.every((entry) => Object.keys(entry).sort().join(",") === "category,configured,name,required"));
  });
});

test("mock provider is never reported as production ready", () => {
  withEnvironment({
    VIDEO_PROVIDER: "mock",
    APP_ACCESS_PASSWORD: "configured",
    SESSION_SECRET: "configured",
    UPSTASH_REDIS_REST_URL: "configured",
    UPSTASH_REDIS_REST_TOKEN: "configured",
  }, () => {
    assert.equal(environmentReport().productionReady, false);
  });
});

test("Google video reports both Gemini and fal storage as required", () => {
  withEnvironment({ VIDEO_PROVIDER: "google" }, () => {
    const report = environmentReport();
    assert.ok(report.missingRequired.includes("GEMINI_API_KEY"));
    assert.ok(report.missingRequired.includes("FAL_KEY"));
  });
});
