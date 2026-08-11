"use client";
import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import type { IntegrationStatus } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";

interface EnvironmentEntry { name: string; category: "core" | "provider" | "optional"; configured: boolean; required: boolean }

export default function IntegrationsPage() {
  const { locale } = useLocale(); const ar = locale === "ar";
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

  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 8 }}>
        <h1>{ar ? "التكاملات" : "Integrations"}</h1>
        <p className="lede">
          {ar ? "حالة مباشرة من الخادم. لا تظهر إلا حالة الإعداد—ولا تغادر القيم السرية الخادم أبدًا." : "Live server-side status. Only presence booleans are reported — secret values never leave the server."}
        </p>
      </section>
      {error && <p className="warn">{error}</p>}
      {data && (
        <>
        <div className={data.environment.productionReady ? "note" : "warn"} style={{ marginBottom: 20 }}>
          <strong>{data.environment.productionReady ? (ar ? "بيئة الإنتاج جاهزة" : "Production environment ready") : (ar ? "بيئة الإنتاج تحتاج اهتمامًا" : "Production environment needs attention")}</strong>
          <div style={{ marginTop: 6 }}>
            {data.environment.productionReady
              ? (ar ? "جميع متغيرات الأساس والمزود المختار مضبوطة." : "All required core and selected-provider variables are configured.")
              : `${ar ? "المفقود" : "Missing"}: ${data.environment.missingRequired.join(", ") || (ar ? "اختر مزود فيديو حقيقيًا" : "select a real video provider")}.`}
            {" "}{ar ? "تظهر الأسماء وحالة الإعداد فقط؛ ولا تصل القيم السرية إلى هذه الصفحة." : "Only names and configured/not-configured flags are shown; secret values never reach this page."}
          </div>
        </div>
        <table>
          <thead>
            <tr><th>{ar ? "التكامل" : "Integration"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "التفاصيل" : "Detail"}</th><th>{ar ? "متغيرات البيئة" : "Environment variables"}</th></tr>
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
        {ar ? "اضبطها في Vercel ← المشروع ← الإعدادات ← متغيرات البيئة، ثم أعد النشر. القائمة الكاملة مع الوصف موجودة في " : "Configure these in Vercel → Project → Settings → Environment Variables, then redeploy. The full list with descriptions lives in "}<span className="mono">.env.example</span>.
      </div>
    </main>
  );
}
