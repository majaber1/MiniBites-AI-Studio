"use client";
import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import type { IntegrationStatus } from "@/lib/types";

interface EnvironmentEntry { name: string; category: "core" | "provider" | "optional"; configured: boolean; required: boolean }

export default function IntegrationsPage() {
  const [data, setData] = useState<{
    integrations: IntegrationStatus[];
    authConfigured: boolean;
    environment: { productionReady: boolean; entries: EnvironmentEntry[]; missingRequired: string[] };
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Could not load integration status."));
  }, []);

  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 8 }}>
        <h1>Integrations</h1>
        <p className="lede">
          Live server-side status. Only presence booleans are reported — secret values never leave the server.
        </p>
      </section>
      {error && <p className="warn">{error}</p>}
      {data && (
        <>
        <div className={data.environment.productionReady ? "note" : "warn"} style={{ marginBottom: 20 }}>
          <strong>{data.environment.productionReady ? "Production environment ready" : "Production environment needs attention"}</strong>
          <div style={{ marginTop: 6 }}>
            {data.environment.productionReady
              ? "All required core and selected-provider variables are configured."
              : `Missing: ${data.environment.missingRequired.join(", ") || "select a real video provider"}.`}
            {" "}Only names and configured/not-configured flags are shown; secret values never reach this page.
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Integration</th><th>Status</th><th>Detail</th><th>Environment variables</th></tr>
          </thead>
          <tbody>
            {data.integrations.map((i) => (
              <tr key={i.key}>
                <td><strong>{i.label}</strong></td>
                <td><StatusBadge status={i.configured ? "ready" : "not_connected"} /></td>
                <td className="dim">{i.detail}</td>
                <td className="mono dim">{i.requiredEnv.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </>
      )}
      <div className="note" style={{ marginTop: 20 }}>
        Configure these in Vercel → Project → Settings → Environment Variables, then redeploy. The full list
        with descriptions lives in <span className="mono">.env.example</span>.
      </div>
    </main>
  );
}
