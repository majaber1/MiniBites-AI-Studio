import { passwordConfigured, rateLimit, sessionCookie, verifyPassword } from "@/lib/security";

export async function POST(req: Request) {
  const limited = await rateLimit(req, "login", 10, 60);
  if (limited) return Response.json({ error: limited }, { status: 429 });
  if (!passwordConfigured()) {
    return Response.json({ error: "Studio access is not configured yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || typeof body.password !== "string" || body.password.length > 200) {
    return Response.json({ error: "Enter the studio password." }, { status: 400 });
  }
  if (!verifyPassword(body.password)) {
    return Response.json({ error: "The password is not correct." }, { status: 401 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store", "set-cookie": sessionCookie() },
  });
}
