"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import type { Production } from "@/lib/types";

export default function LibraryPage() {
  const [productions, setProductions] = useState<Production[] | null>(null);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const { productions: list } = await api<{ productions: Production[] }>("/api/productions");
      setProductions(list);
      setAuthStatus(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503)) setAuthStatus(e.status);
      else setError(e instanceof Error ? e.message : "Could not load the library.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, path: string, body?: unknown) {
    setError("");
    setNotice("");
    try {
      const res = await api<{ production: Production; note?: string }>(`/api/productions/${id}${path}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : "{}",
      });
      if (res.note) setNotice(res.note);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
  }

  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 8 }}>
        <h1>Content Library</h1>
        <p className="lede">Every production, its real status, and its publishing state.</p>
      </section>

      {authStatus !== null && <AccessGate status={authStatus} onUnlocked={load} />}
      {error && <p className="warn">{error}</p>}
      {notice && <p className="note">{notice}</p>}

      {productions && productions.length === 0 && (
        <div className="card">
          <h3>No productions yet</h3>
          <p className="dim">
            Start your first production in the Creator Studio. (The old manually-assembled Omelette demo from
            v1 was removed — it was still images with camera movement, not a real generated video.)
          </p>
        </div>
      )}

      {productions && productions.length > 0 && (
        <div className="grid">
          {productions.map((p) => (
            <div className="card" key={p.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <h3 style={{ marginRight: "auto" }}>Mini {p.dish}</h3>
                <StatusBadge status={p.status} />
                {p.providerIsMock && <span className="badge b-fail">mock — not real</span>}
              </div>
              <p className="dim mono">
                {p.id} · {new Date(p.createdAt).toLocaleString()} · {p.provider}
                {p.durationSeconds ? ` · ~${p.durationSeconds}s` : ""}{p.resolution ? ` · ${p.resolution}` : ""}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {p.finalVideoUrl && !p.providerIsMock && (
                  <>
                    <a href={p.finalVideoUrl} target="_blank" rel="noreferrer"><button className="ghost">Preview</button></a>
                    <a href={p.finalVideoUrl} download><button className="ghost">Download MP4</button></a>
                  </>
                )}
                {p.status === "awaiting_approval" && !p.providerIsMock && (
                  <button onClick={() => act(p.id, "/approve")}>Approve</button>
                )}
                {(p.status === "approved") && (
                  <button onClick={() => act(p.id, "/publish")}>Prepare publish</button>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                {p.publish.map((pub) => (
                  <div key={pub.platform} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0" }}>
                    <span className="mono" style={{ minWidth: 70 }}>{pub.platform}</span>
                    <StatusBadge status={pub.status} />
                    {pub.url && <a className="mono" href={pub.url} target="_blank" rel="noreferrer" style={{ color: "var(--yolk)" }}>{pub.url}</a>}
                    {pub.requiredAction && pub.status !== "published" && <span className="dim" style={{ fontSize: "0.82rem" }}>{pub.requiredAction}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
