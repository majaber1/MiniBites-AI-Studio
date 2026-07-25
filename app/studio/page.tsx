"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/components/api";
import AccessGate from "@/components/AccessGate";
import StatusBadge from "@/components/StatusBadge";
import type { Production } from "@/lib/types";

const SUGGESTIONS = ["Omelette", "Pizza", "Maqluba", "Mansaf", "Cookies"];

interface ProviderOption {
  id: "fal" | "wan" | "mock";
  name: string;
  configured: boolean;
  isMock: boolean;
  isDefault: boolean;
}
const ACTIVE = ["planning", "generating", "review", "assembling"];

export default function StudioPage() {
  const [dish, setDish] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [provider, setProvider] = useState<string>("auto");
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [production, setProduction] = useState<Production | null>(null);
  const [error, setError] = useState("");
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async (id: string) => {
    try {
      const { production: p } = await api<{ production: Production }>(`/api/productions/${id}?advance=1`);
      setProduction(p);
      if (ACTIVE.includes(p.status)) {
        timer.current = setTimeout(() => poll(id), 4000);
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503)) setAuthStatus(e.status);
      else if (e instanceof ApiError && e.status === 404) {
        // The stored production no longer exists (expired or never persisted).
        // Forget it and return to a clean studio instead of erroring forever.
        window.localStorage.removeItem("mb_last_production");
        setProduction(null);
        setError("");
      } else setError(e instanceof Error ? e.message : "Polling failed.");
    }
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.providers) && setProviderOptions(d.providers))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // Resume an in-flight production after refresh (real persistence).
    const id = typeof window !== "undefined" ? window.localStorage.getItem("mb_last_production") : null;
    if (id) poll(id);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [poll]);

  async function startProduction() {
    setBusy(true);
    setError("");
    try {
      const { production: p } = await api<{ production: Production }>("/api/productions", {
        method: "POST",
        body: JSON.stringify({ dish, language, provider }),
      });
      setProduction(p);
      setAuthStatus(null);
      window.localStorage.setItem("mb_last_production", p.id);
      timer.current = setTimeout(() => poll(p.id), 2500);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503)) setAuthStatus(e.status);
      else setError(e instanceof Error ? e.message : "Could not start production.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!production) return;
    try {
      const { production: p } = await api<{ production: Production }>(`/api/productions/${production.id}`, { method: "DELETE" });
      setProduction(p);
      if (timer.current) clearTimeout(timer.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed.");
    }
  }

  async function retry(shotId: string) {
    if (!production) return;
    try {
      const { production: p } = await api<{ production: Production }>(`/api/productions/${production.id}/retry`, {
        method: "POST",
        body: JSON.stringify({ shotId }),
      });
      setProduction(p);
      timer.current = setTimeout(() => poll(p.id), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed.");
    }
  }

  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 8 }}>
        <h1>Creator Studio</h1>
        <p className="lede">One dish name in. A real, persisted production out.</p>
      </section>

      {authStatus !== null ? (
        <AccessGate status={authStatus} onUnlocked={() => { setAuthStatus(null); if (production) poll(production.id); }} />
      ) : (
        <div className="ticket">
          <div className="ticket-head">Order ticket — new production</div>
          <div className="dish-row">
            <input
              type="text"
              placeholder="Dish name, e.g. Maqluba"
              value={dish}
              maxLength={60}
              onChange={(e) => setDish(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && dish.trim().length >= 2 && startProduction()}
              aria-label="Dish name"
            />
            <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "ar")} aria-label="Caption language">
              <option value="en">English captions</option>
              <option value="ar">Arabic captions</option>
            </select>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Video provider">
              <option value="auto">
                {(() => { const d = providerOptions.find((o) => o.isDefault); return d ? `Auto — ${d.name}` : "Auto (server default)"; })()}
              </option>
              {providerOptions.map((o) => (
                <option key={o.id} value={o.id} disabled={!o.configured}>
                  {o.isMock ? `${o.name} — test only, no real video` : o.name}{o.configured ? "" : " (not configured)"}
                </option>
              ))}
            </select>
            <button onClick={startProduction} disabled={busy || dish.trim().length < 2}>
              {busy ? "Starting…" : "Start production"}
            </button>
          </div>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setDish(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="warn" style={{ marginTop: 14 }}>{error}</p>}

      {production && (
        <>
          <div className="ruler" aria-hidden />
          <ProductionView production={production} onCancel={cancel} onRetry={retry} />
        </>
      )}
    </main>
  );
}

function ProductionView({ production: p, onCancel, onRetry }: { production: Production; onCancel: () => void; onRetry: (shotId: string) => void }) {
  const active = ACTIVE.includes(p.status);
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2>Mini {p.dish}</h2>
        <StatusBadge status={p.status} />
        <span className="mono dim">{p.id}</span>
        {active && <button className="danger" onClick={onCancel}>Cancel production</button>}
      </div>
      <p className="dim">
        Provider: {p.provider} · Plan: {p.planSource === "llm" ? "LLM" : "template (no LLM key)"} · Created{" "}
        {new Date(p.createdAt).toLocaleString()}
      </p>
      {p.providerIsMock && (
        <p className="warn">MOCK provider active — this run is for testing only and produces no real video.</p>
      )}
      {p.error && <p className="warn">{p.error}</p>}

      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Agents</h3>
          {p.agents.map((a) => (
            <div key={a.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: "0.92rem" }}>{a.name}</strong>
                <StatusBadge status={a.status} />
              </div>
              {a.note && <p className="dim" style={{ margin: "4px 0 0" }}>{a.note}</p>}
              {a.logs.length > 0 && (
                <div className="logbox mono" style={{ marginTop: 6 }}>
                  {a.logs.slice(-6).map((l, i) => <div key={i}>{l}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Shots</h3>
          {p.shots.length === 0 ? (
            <p className="dim">The shot list appears once planning completes.</p>
          ) : (
            <div className="shots">
              {p.shots.map((s) => (
                <div className="shot" key={s.id}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="mono" style={{ color: "var(--yolk)" }}>SHOT {String(s.index).padStart(2, "0")} · {s.seconds}s</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p>{s.action}</p>
                  <p className="dim mono">{s.camera}</p>
                  {typeof s.queuePosition === "number" && <p className="dim">Queue position: {s.queuePosition}</p>}
                  {s.error && <p className="dim" style={{ color: "var(--coral)" }}>{s.error}</p>}
                  {s.videoUrl && !p.providerIsMock && (
                    <a href={s.videoUrl} target="_blank" rel="noreferrer"><button className="ghost" style={{ padding: "6px 12px" }}>Preview clip</button></a>
                  )}
                  {(s.status === "failed" || s.status === "rejected") && (
                    <button className="ghost" style={{ padding: "6px 12px", marginTop: 6 }} onClick={() => onRetry(s.id)}>
                      Retry shot ({s.attempts}/3)
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {p.status === "awaiting_approval" && (
        <div className="note" style={{ marginTop: 14 }}>
          Generation finished. Review the clips above, then approve and publish from the <a href="/library" style={{ color: "var(--yolk)" }}>Content Library</a>.
        </div>
      )}
    </section>
  );
}
