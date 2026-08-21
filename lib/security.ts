// ---------------------------------------------------------------------------
// Authentication, rate limiting and cost protection.
// - Access: APP_ACCESS_PASSWORD gates every production API. Without it the
//   API refuses generation entirely (no unlimited anonymous video spend).
// - Rate limits: per-IP request limit + daily production cap via the store.
// ---------------------------------------------------------------------------
import { createHmac, timingSafeEqual } from "crypto";
import { getStore } from "./store";
import { cleanEnv } from "./env";

const COOKIE = "mb_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function secret(): string {
  return cleanEnv("SESSION_SECRET") ?? "";
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signSession(expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS): string {
  const payload = `v1.${expiresAt}`;
  return `${payload}.${signature(payload)}`;
}

export function passwordConfigured(): boolean {
  return Boolean(cleanEnv("APP_ACCESS_PASSWORD") && cleanEnv("SESSION_SECRET"));
}

export function verifyPassword(candidate: string): boolean {
  const expected = cleanEnv("APP_ACCESS_PASSWORD") ?? "";
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthed(req: Request): boolean {
  if (!passwordConfigured()) return false;
  const cookies = req.headers.get("cookie") ?? "";
  const match = cookies.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`) || c.startsWith("ks_session="));
  if (!match) return false;
  const value = match.includes("=") ? match.split("=").slice(1).join("=") : "";
  const [version, expiresRaw, suppliedSignature] = value.split(".");
  const expiresAt = Number(expiresRaw);
  if (version !== "v1" || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const expected = signature(`${version}.${expiresAt}`);
  const a = Buffer.from(suppliedSignature ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${signSession()}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = cleanEnv("ADMIN_ACCESS_PASSWORD") ?? "";
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
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
          "Studio access is not configured. Add APP_ACCESS_PASSWORD and SESSION_SECRET, then redeploy.",
      },
      { status: 503 }
    );
  }
  if (!isAuthed(req)) {
    return Response.json({ error: "Sign in required. Enter the studio password." }, { status: 401 });
  }
  return null;
}
