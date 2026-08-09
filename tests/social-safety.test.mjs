import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.APP_ACCESS_PASSWORD = "social-test-password";
process.env.SESSION_SECRET = "social-test-session-secret";
process.env.VIDEO_PROVIDER = "mock";

test("YouTube uploads default to private", async () => {
  process.env.YOUTUBE_CLIENT_ID = "client";
  process.env.YOUTUBE_CLIENT_SECRET = "secret";
  process.env.YOUTUBE_REFRESH_TOKEN = "refresh";
  delete process.env.YOUTUBE_PRIVACY;
  const originalFetch = globalThis.fetch;
  let uploadBody = "";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com")) return Response.json({ access_token: "access" });
    if (url === "https://media.example/final.mp4") return new Response(new Uint8Array([0, 1, 2]), { status: 200 });
    if (url.includes("upload/youtube")) {
      uploadBody = Buffer.from(init.body).toString("utf8");
      return Response.json({ id: "private-video" });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const { uploadShort } = await import("../lib/publish/youtube.ts");
    const result = await uploadShort({ videoUrl: "https://media.example/final.mp4", title: "Mini Kabsa", description: "Ready", tags: ["#mini"] });
    assert.equal(result.videoId, "private-video");
    assert.match(uploadBody, /"privacyStatus":"private"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unapproved content cannot enter the publishing workflow", async () => {
  const { MemoryStore } = await import("../lib/store/memory.ts");
  const { createProduction } = await import("../lib/agents/pipeline.ts");
  const { ownerKey, signSession } = await import("../lib/security.ts");
  const { POST } = await import("../app/api/productions/[id]/publish/route.ts");
  const store = new MemoryStore();
  globalThis.__minibitesStore = store;
  const request = new Request("https://minibites.test/api/productions/mb_social_safety/publish", {
    method: "POST", headers: { cookie: `mb_session=${signSession()}` },
  });
  const prod = createProduction("Kunafa", "en", ownerKey(request));
  prod.id = "mb_social_safety";
  prod.status = "awaiting_approval";
  prod.approved = false;
  await store.saveProduction(prod);
  const response = await POST(request, { params: Promise.resolve({ id: prod.id }) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Approve/);
});

test("manual TikTok and Instagram handoff remains honest and usable", () => {
  const source = readFileSync(new URL("../app/library/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Download MP4/);
  assert.match(source, /Copy caption/);
  assert.match(source, /tiktok\.com\/upload/);
  assert.match(source, /instagram\.com/);
  assert.doesNotMatch(source, /Publish to TikTok/);
  assert.doesNotMatch(source, /Publish to Instagram/);
});

test("creator can request changes without granting publish approval", async () => {
  const { MemoryStore } = await import("../lib/store/memory.ts");
  const { createProduction } = await import("../lib/agents/pipeline.ts");
  const { ownerKey, signSession } = await import("../lib/security.ts");
  const { POST } = await import("../app/api/productions/[id]/approve/route.ts");
  const store = new MemoryStore();
  globalThis.__minibitesStore = store;
  const request = new Request("https://minibites.test/api/productions/mb_changes/approve", { method: "POST", headers: { "content-type": "application/json", cookie: `mb_session=${signSession()}` }, body: JSON.stringify({ action: "request_changes", note: "Remake the final reveal" }) });
  const production = createProduction("Kunafa", "en", ownerKey(request));
  production.id = "mb_changes";
  production.status = "awaiting_approval";
  production.providerIsMock = false;
  await store.saveProduction(production);
  const response = await POST(request, { params: Promise.resolve({ id: production.id }) });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.production.status, "changes_requested");
  assert.equal(result.production.approved, false);
  assert.equal(result.production.approvalNote, "Remake the final reveal");
});
