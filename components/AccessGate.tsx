"use client";
import { useState } from "react";
import { api } from "./api";
import { useLocale } from "./LocaleProvider";

/** Password gate shown when the API returns 401/503. */
export default function AccessGate({ status, onUnlocked }: { status: number; onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { locale } = useLocale();
  const ar = locale === "ar";

  if (status === 503) {
    return (
      <div className="warn">
        {ar ? <>
          التوليد مقفل. أضف <span className="mono">APP_ACCESS_PASSWORD</span> و <span className="mono">SESSION_SECRET</span> في بيئة الخادم (Vercel ← الإعدادات ← متغيرات البيئة)، ثم أعد النشر. يحمي ذلك رصيد التوليد من الاستخدام المجهول.
        </> : <>
          Generation is locked. Set <span className="mono">APP_ACCESS_PASSWORD</span> and <span className="mono">SESSION_SECRET</span> in the server environment (Vercel → Settings → Environment Variables), then redeploy. This protects your video-generation credit from anonymous use.
        </>}
      </div>
    );
  }
  return (
    <div className="ticket" style={{ maxWidth: 420 }}>
      <div className="ticket-head">{ar ? "دخول الاستوديو" : "Studio access"}</div>
      <div className="dish-row">
        <input
          type="password"
          placeholder={ar ? "كلمة مرور الاستوديو" : "Studio password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          aria-label={ar ? "كلمة مرور الاستوديو" : "Studio password"}
        />
        <button onClick={submit} disabled={busy || !password}>
          {busy ? (ar ? "جارٍ التحقق…" : "Checking…") : (ar ? "دخول" : "Sign in")}
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
      setError(e instanceof Error ? e.message : (ar ? "تعذر تسجيل الدخول." : "Sign-in failed."));
    } finally {
      setBusy(false);
    }
  }
}
