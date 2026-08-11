"use client";
import Link from "next/link";
import { CREATIVE_TEMPLATES } from "@/lib/templates";
import { useLocale } from "@/components/LocaleProvider";

export default function TemplatesPage() {
  const { locale } = useLocale(); const ar = locale === "ar";
  return <main className="wrap">
    <section className="hero" style={{ paddingBottom: 12 }}>
      <div className="eyebrow">{ar ? "ابدأ أسرع" : "Start faster"}</div>
      <h1>{ar ? "القوالب الإبداعية" : "Creative templates"}</h1>
      <p className="lede">{ar ? "اختر قصة طعام مصغّر مجرّبة، ثم خصّص كل التفاصيل قبل التوليد." : "Choose a proven tiny-food story, then make every detail yours before generation."}</p>
    </section>
    {["Saudi & Arab", "Global", "Seasonal"].map((region) => <section className="template-section" key={region}>
      <h2>{ar ? ({"Saudi & Arab":"سعودي وعربي",Global:"عالمي",Seasonal:"موسمي"} as Record<string,string>)[region] : region}</h2>
      <div className="template-grid">
        {CREATIVE_TEMPLATES.filter((template) => template.region === region).map((template) => <article className="card template-card" key={template.id}>
          <span className="template-icon" aria-hidden>{template.icon}</span>
          <div><h3>{template.dish}</h3><p className="dim">{template.description}</p><small>{template.style} · {template.durationPreset}</small></div>
          <Link className="button" href={`/studio?template=${template.id}`}>{ar ? "استخدم القالب" : "Use template"}</Link>
        </article>)}
      </div>
    </section>)}
  </main>;
}
