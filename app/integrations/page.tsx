"use client";
import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import type { IntegrationStatus } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";

interface EnvironmentEntry { name: string; category: "core" | "provider" | "optional"; configured: boolean; required: boolean }

export default function IntegrationsPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";
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
      .catch(() => setError(ar ? "تعذر تحميل حالة التكاملات." : "Could not load integration status."));
  }, [ar]);

  const coreList = data?.integrations.filter((i) => i.category === "core") ?? [];
  const mediaList = data?.integrations.filter((i) => i.category === "media") ?? [];
  const socialList = data?.integrations.filter((i) => i.category === "social") ?? [];

  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 8 }}>
        <h1>{ar ? "التكاملات ومحركات الوسائط" : "Integrations & Media Engines"}</h1>
        <p className="lede">
          {ar
            ? "حالة مباشرة من الخادم. لا تظهر إلا حالة الإعداد ومحركات الفيديو والصوت والنشر — ولا تغادر القيم السرية الخادم أبدًا."
            : "Live server-side verification. Inspect media engines (Google Veo, Gemini TTS, fal), database persistence, and social publishing pipelines."}
        </p>
      </section>

      {error && <p className="warn">{error}</p>}

      {data && (
        <>
          <div className={data.environment.productionReady ? "note" : "warn"} style={{ marginBottom: 20 }}>
            <strong>
              {data.environment.productionReady
                ? (ar ? "بيئة الإنتاج جاهزة" : "Production environment ready")
                : (ar ? "بيئة الإنتاج تحتاج اهتمامًا" : "Production environment needs attention")}
            </strong>
            <div style={{ marginTop: 6 }}>
              {data.environment.productionReady
                ? (ar ? "جميع متغيرات الأساس والمزود المختار مضبوطة." : "All required core and selected-provider variables are configured.")
                : `${ar ? "المفقود" : "Missing"}: ${data.environment.missingRequired.join(", ") || (ar ? "اختر مزود فيديو حقيقيًا" : "select a real video provider")}.`}
              {" "}
              {ar
                ? "تظهر الأسماء وحالة الإعداد فقط؛ ولا تصل القيم السرية إلى هذه الصفحة."
                : "Only environment names and presence booleans are displayed; secrets never leave the server."}
            </div>
          </div>

          {/* MEDIA ENGINES */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="dashboard-section-head">
              <div>
                <span className="eyebrow">{ar ? "محركات التوليد والصوت" : "Media Generation Engines"}</span>
                <h2>{ar ? "محركات الفيديو والصور والأصوات (Google & Providers)" : "Google Flow / Veo, Gemini TTS & Video Engines"}</h2>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "المحرك" : "Engine"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الوظيفة والتفاصيل" : "Capabilities & Details"}</th>
                  <th>{ar ? "متغيرات البيئة" : "Required Env"}</th>
                </tr>
              </thead>
              <tbody>
                {mediaList.map((i) => (
                  <tr key={i.key}>
                    <td><strong>{i.label}</strong></td>
                    <td><StatusBadge status={i.status ?? (i.configured ? "ready" : "not_connected")} /></td>
                    <td className="dim">{i.detail}</td>
                    <td className="mono dim">{i.requiredEnv.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SOCIAL PUBLISHING */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="dashboard-section-head">
              <div>
                <span className="eyebrow">{ar ? "منصات النشر" : "Social Publishing Pipelines"}</span>
                <h2>{ar ? "النشر المباشر واليدوي (YouTube, TikTok, Instagram, X, Snapchat)" : "Social Channels & Direct/Manual Publishing"}</h2>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "المنصة" : "Platform"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "طريقة النشر والتفاصيل" : "Publishing Method"}</th>
                  <th>{ar ? "متغيرات البيئة" : "Required Env"}</th>
                </tr>
              </thead>
              <tbody>
                {socialList.map((i) => (
                  <tr key={i.key}>
                    <td><strong>{i.label}</strong></td>
                    <td><StatusBadge status={i.status ?? (i.configured ? "connected" : "auth_required")} /></td>
                    <td className="dim">{i.detail}</td>
                    <td className="mono dim">{i.requiredEnv.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CORE & STORAGE */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="dashboard-section-head">
              <div>
                <span className="eyebrow">{ar ? "البنية التحتية" : "Infrastructure & Persistence"}</span>
                <h2>{ar ? "الحماية، قاعدة البيانات، وتخزين الوسائط الدائم" : "Security Gate, Durable Storage & Media Archive"}</h2>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الخدمة" : "Service"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "التفاصيل" : "Detail"}</th>
                  <th>{ar ? "متغيرات البيئة" : "Required Env"}</th>
                </tr>
              </thead>
              <tbody>
                {coreList.map((i) => (
                  <tr key={i.key}>
                    <td><strong>{i.label}</strong></td>
                    <td><StatusBadge status={i.status ?? (i.configured ? "ready" : "not_connected")} /></td>
                    <td className="dim">{i.detail}</td>
                    <td className="mono dim">{i.requiredEnv.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="note" style={{ marginTop: 20 }}>
        {ar
          ? "اضبطها في Vercel ← المشروع ← الإعدادات ← متغيرات البيئة، ثم أعد النشر. القائمة الكاملة مع الوصف موجودة في "
          : "Configure these in Vercel → Project → Settings → Environment Variables, then redeploy. The full list with descriptions lives in "}
        <span className="mono">.env.example</span>.
      </div>
    </main>
  );
}

