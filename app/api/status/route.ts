import { integrationStatuses } from "@/lib/status";
import { listProviderOptions } from "@/lib/providers";
import { isAuthed, passwordConfigured } from "@/lib/security";
import { environmentReport } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return Response.json({
    authRequired: true,
    authConfigured: passwordConfigured(),
    signedIn: isAuthed(req),
    integrations: integrationStatuses(),
    providers: listProviderOptions(),
    environment: environmentReport(),
  });
}
