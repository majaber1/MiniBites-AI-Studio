"use client";
import { AGENT_DEFS } from "@/lib/agents/defs";
import { useLocale } from "@/components/LocaleProvider";

export default function AgentsPage() {
  const { locale } = useLocale(); const ar = locale === "ar";
  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>{ar ? "مسار وكلاء الذكاء" : "The agent pipeline"}</h1>
        <p className="lede">
          {ar ? "يعمل عشرة وكلاء ضمن آلة حالات محفوظة. الترتيب مهم—من فهم الطبق حتى حزمة جاهزة للنشر، ولا تصبح أي مرحلة خضراء إلا بعد اكتمال عملها الحقيقي." : <>Ten agents run in a persisted state machine. Order matters — this really is a sequence, from
          understanding the dish to a publish-ready package — and each stage only turns green when its real
          work completed.</>}
        </p>
      </section>
      <div className="ruler" aria-hidden />
      <table>
        <thead>
          <tr><th>{ar ? "المرحلة" : "Stage"}</th><th>{ar ? "الوكيل" : "Agent"}</th><th>{ar ? "المسؤولية" : "Responsibility"}</th></tr>
        </thead>
        <tbody>
          {AGENT_DEFS.map((a, i) => (
            <tr key={a.id}>
              <td className="mono" style={{ color: "var(--yolk)" }}>{String(i + 1).padStart(2, "0")}</td>
              <td><strong>{a.name}</strong></td>
              <td className="dim">{a.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="note" style={{ marginTop: 20 }}>
        {ar ? "ملاحظة شفافية: يفرض وكيلا الاستمرارية والجودة عقد الأسلوب والتعليمات السلبية ونتائج كل لقطة على الخادم. التقييم البصري على مستوى الإطار يحتاج نموذج رؤية أو مراجعتك، لذلك يبقى الاعتماد النهائي يدويًا." : <>Honesty note: Continuity and Quality agents enforce the style contract, negative prompts and per-shot
        results server-side. Frame-level visual judging needs a vision-model pass or your eyes — which is why
        final approval is always manual in phase one.</>}
      </div>
    </main>
  );
}
