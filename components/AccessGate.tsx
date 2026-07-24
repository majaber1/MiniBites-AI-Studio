"use client";
import { useState } from "react";
import { api } from "./api";

/** Password gate shown when the API returns 401/503. */
export default function AccessGate({ status, onUnlocked }: { status: number; onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === 503) {
    return (
      <div className="warn">
        Generation is locked. Set <span className="mono">APP_ACCESS_PASSWORD</span> and{" "}
        <span className="mono">SESSION_SECRET</span> in the server environment (Vercel → Settings → Environment
        Variables), then redeploy. This protects your video-generation credit from anonymous use.
      </div>
    );
  }
  return (
    <div className="ticket" style={{ maxWidth: 420 }}>
      <div className="ticket-head">Studio access</div>
      <div className="dish-row">
        <input
          type="password"
          placeholder="Studio password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          aria-label="Studio password"
        />
        <button onClick={submit} disabled={busy || !password}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </div>
      {error && <p className="dim" style={{ color: "var(--coral)" }}>{error}</p>}
    </div>
  );

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      onUnlocked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
}
