import { clearSessionCookie } from "@/lib/security";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store", "set-cookie": clearSessionCookie() } });
}
