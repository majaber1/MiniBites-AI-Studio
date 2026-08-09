import Link from "next/link";
import { CREATIVE_TEMPLATES } from "@/lib/templates";

export const metadata = { title: "Templates — MiniBites Studio" };

export default function TemplatesPage() {
  return <main className="wrap">
    <section className="hero" style={{ paddingBottom: 12 }}>
      <div className="eyebrow">Start faster</div>
      <h1>Creative templates</h1>
      <p className="lede">Choose a proven tiny-food story, then make every detail yours before generation.</p>
    </section>
    {["Saudi & Arab", "Global", "Seasonal"].map((region) => <section className="template-section" key={region}>
      <h2>{region}</h2>
      <div className="template-grid">
        {CREATIVE_TEMPLATES.filter((template) => template.region === region).map((template) => <article className="card template-card" key={template.id}>
          <span className="template-icon" aria-hidden>{template.icon}</span>
          <div><h3>{template.dish}</h3><p className="dim">{template.description}</p><small>{template.style} · {template.durationPreset}</small></div>
          <Link className="button" href={`/studio?template=${template.id}`}>Use template</Link>
        </article>)}
      </div>
    </section>)}
  </main>;
}
