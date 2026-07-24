// ---------------------------------------------------------------------------
// Authentication, rate limiting and cost protection.
// - Access: APP_ACCESS_PASSWORD gates every production API. Without it the
//   API refuses generation entirely (no unlimited anonymous video spend).
// - Rate limits: per-IP request limit + daily production cap via the store.
// ---------------------------------------------------------------------------
import { createHmac, timingSafeEqual } from "crypto";
import { getStore } from "./store";

const COOKIE = "mb_session";

function secret(): string {
  return process.env.SESSION_SECRET || process.env.APP_ACCESS_PASSWORD || "";
}

export function signSession(): string {
  return createHmac("sha256", secret()).update("minibites-session-v1").digest("hex");
}

export function passwordConfigured(): boolean {
  return Boolean(process.env.APP_ACCESS_PASSWORD);
}

export function verifyPassword(candidate: string): boolean {
  const expected = process.env.APP_ACCESS_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthed(req: Request): boolean {
  if (!passwordConfigured()) return false;
  const cookies = req.headers.get("cookie") ?? "";
  const match = cookies.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return false;
  const value = match.slice(COOKIE.length + 1);
  const expected = signSession();
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookie(): string {
  return `${COOKIE}=${signSession()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
}

/** Stable non-secret identity for scoping productions and limits. */
export function ownerKey(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return createHmac("sha256", secret() || "mb").update(ip).digest("hex").slice(0, 16);
}

export async function rateLimit(req: Request, bucket: string, max: number, windowSeconds: number): Promise<string | null> {
  const store = getStore();
  const n = await store.incrCounter(`${bucket}:${ownerKey(req)}`, windowSeconds);
  if (n > max) return `Rate limit exceeded (${max} per ${windowSeconds}s). Try again later.`;
  return null;
}

export async function dailyProductionCap(req: Request): Promise<string | null> {
  const max = Number(process.env.MAX_PRODUCTIONS_PER_DAY ?? 5);
  const store = getStore();
  const day = new Date().toISOString().slice(0, 10);
  const n = await store.incrCounter(`prods:${day}:${ownerKey(req)}`, 60 * 60 * 24);
  if (n > max) return `Daily production limit reached (${max}/day) to protect video-generation credit.`;
  return null;
}

export function requireAuth(req: Request): Response | null {
  if (!passwordConfigured()) {
    return Response.json(
      {
        error:
          "Generation is locked: set APP_ACCESS_PASSWORD (and SESSION_SECRET) in the server environment. This prevents unlimited anonymous video generation.",
      },
      { status: 503 }
    );
  }
  if (!isAuthed(req)) {
    return Response.json({ error: "Sign in required. Enter the studio password." }, { status: 401 });
  }
  return null;
}
