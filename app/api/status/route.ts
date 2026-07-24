import { integrationStatuses } from "@/lib/status";
import { isAuthed, passwordConfigured } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return Response.json({
    authRequired: true,
    authConfigured: passwordConfigured(),
    signedIn: isAuthed(req),
    integrations: integrationStatuses(),
  });
}
