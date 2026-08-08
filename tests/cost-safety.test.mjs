import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_ACCESS_PASSWORD = "cost-test-password";
process.env.SESSION_SECRET = "cost-test-session-secret";
process.env.VIDEO_PROVIDER = "mock";

const { signSession } = await import("../lib/security.ts");
const { MemoryStore } = await import("../lib/store/memory.ts");
const { POST } = await import("../app/api/productions/route.ts");

function create(body) {
  return POST(new Request("https://minibites.test/api/productions", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `mb_session=${signSession()}`, "x-forwarded-for": "203.0.113.8" },
    body: JSON.stringify(body),
  }));
}

test("invalid creation does not consume the paid-production cap", async () => {
  globalThis.__minibitesStore = new MemoryStore();
  process.env.MAX_PRODUCTIONS_PER_DAY = "1";
  assert.equal((await create({ dish: "", language: "en", provider: "mock", clientRequestId: "invalid-001" })).status, 400);
  assert.equal((await create({ dish: "Kabsa", language: "en", provider: "mock", clientRequestId: "valid-0001" })).status, 201);
});

test("a repeated client request returns one production and consumes quota once", async () => {
  globalThis.__minibitesStore = new MemoryStore();
  process.env.MAX_PRODUCTIONS_PER_DAY = "2";
  const body = { dish: "Kabsa", language: "en", provider: "mock", clientRequestId: "same-request-001" };
  const first = await create(body);
  const repeated = await create(body);
  const secondUnique = await create({ ...body, clientRequestId: "unique-request-02" });
  assert.equal(first.status, 201);
  assert.equal(repeated.status, 200);
  assert.equal(secondUnique.status, 201, "duplicate request must not consume the second quota slot");
  const a = await first.json();
  const b = await repeated.json();
  assert.equal(a.production.id, b.production.id);
  assert.equal(b.duplicatePrevented, true);
  assert.equal((await globalThis.__minibitesStore.listProductions(a.production.ownerKey)).length, 2);
});

