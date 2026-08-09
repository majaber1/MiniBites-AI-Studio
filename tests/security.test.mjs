import test from "node:test";
import assert from "node:assert/strict";

const security = await import("../lib/security.ts");
const { MemoryStore } = await import("../lib/store/memory.ts");

function requestWithCookie(value) {
  return new Request("https://minibites.test/api/status", { headers: { cookie: `mb_session=${value}` } });
}

test("studio access requires separate password and session secrets", () => {
  process.env.APP_ACCESS_PASSWORD = "correct horse battery staple";
  delete process.env.SESSION_SECRET;
  assert.equal(security.passwordConfigured(), false);
  process.env.SESSION_SECRET = "a-different-long-session-secret";
  assert.equal(security.passwordConfigured(), true);
  assert.equal(security.verifyPassword("correct horse battery staple"), true);
  assert.equal(security.verifyPassword("wrong"), false);
});

test("signed sessions expire and reject tampering", () => {
  process.env.APP_ACCESS_PASSWORD = "studio-password";
  process.env.SESSION_SECRET = "session-secret-that-is-not-the-password";
  const valid = security.signSession(Math.floor(Date.now() / 1000) + 60);
  assert.equal(security.isAuthed(requestWithCookie(valid)), true);
  assert.equal(security.isAuthed(requestWithCookie(`${valid}tampered`)), false);
  assert.equal(security.isAuthed(requestWithCookie(security.signSession(Math.floor(Date.now() / 1000) - 1))), false);
});

test("only a lock owner can release a production lock", async () => {
  const store = new MemoryStore();
  const owner = await store.acquireLock("paid-job", 60);
  assert.ok(owner);
  await store.releaseLock("paid-job", "not-the-owner");
  assert.equal(await store.acquireLock("paid-job", 60), null);
  await store.releaseLock("paid-job", owner);
  assert.ok(await store.acquireLock("paid-job", 60));
});

test("operations access uses a separate admin password", async () => {
  process.env.ADMIN_ACCESS_PASSWORD = "separate-operations-password";
  const { verifyAdminPassword } = await import("../lib/security.ts");
  assert.equal(verifyAdminPassword("separate-operations-password"), true);
  assert.equal(verifyAdminPassword(process.env.APP_ACCESS_PASSWORD), false);
});
