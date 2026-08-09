"use client";
import { useState } from "react";
import { api } from "@/components/api";

interface Overview {
  store: { name: string; durable: boolean };
  environment: { productionReady: boolean; missingRequired: string[] };
  metrics: { projectsToday: number; submittedShotsToday: number; completedShotsToday: number; failedShotsToday: number; estimatedCostUsd: number | null; activeJobs: number; recentFailures: Array<{ id: string; dish: string; status: string; updatedAt: string; message: string }> };
}

export default function OperationsPage() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try { setData(await api<Overview>("/api/admin/overview", { method: "POST", body: JSON.stringify({ password }) })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Operations status could not be loaded."); }
  }
  return <main className="wrap">
    <section className="hero" style={{ paddingBottom: 12 }}><div className="eyebrow">Restricted</div><h1>Operations</h1><p className="lede">Real production health and usage. This page is intentionally absent from creator navigation.</p></section>
    {!data && <div className="ticket" style={{ maxWidth: 460 }}><label>Operations password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} /></label><button onClick={load} disabled={!password} style={{ marginTop: 12 }}>Open operations</button>{error && <p className="warn">{error}</p>}</div>}
    {data && <><div className={data.environment.productionReady && data.store.durable ? "note" : "warn"}>{data.environment.productionReady && data.store.durable ? "Core production services are ready." : `Needs attention: ${data.environment.missingRequired.join(", ") || "durable project storage"}`}</div><div className="ops-grid">{[
      ["Projects today", data.metrics.projectsToday], ["Active jobs", data.metrics.activeJobs], ["Shots submitted", data.metrics.submittedShotsToday], ["Shots completed", data.metrics.completedShotsToday], ["Shots failed", data.metrics.failedShotsToday], ["Estimated cost", data.metrics.estimatedCostUsd === null ? "Unknown" : `$${data.metrics.estimatedCostUsd.toFixed(2)}`],
    ].map(([label, value]) => <article className="card" key={label}><span className="dim">{label}</span><h2>{value}</h2></article>)}</div><section className="card" style={{ marginTop: 18 }}><h3>Recent failures</h3>{data.metrics.recentFailures.length === 0 ? <p className="dim">No recent failures in the stored projects.</p> : data.metrics.recentFailures.map((failure) => <div key={failure.id} className="ops-failure"><strong>{failure.dish}</strong><span className="dim">{failure.message}</span><small>{new Date(failure.updatedAt).toLocaleString()}</small></div>)}</section></>}
  </main>;
}
