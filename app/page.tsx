"use client";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

const STEPS = [
  ["01", "Share your idea", "Name a dish or start with an editable creative template."],
  ["02", "Let MiniBites create", "Review a simple shot plan, then start generation when you're ready."],
  ["03", "Keep only the best", "Accept each clip or remake one without losing the rest."],
  ["04", "Share everywhere", "Publish to YouTube or download the ready-to-post social pack."],
];

export default function Home() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const steps = ar ? [
    ["01", "شارك فكرتك", "اكتب اسم الطبق أو ابدأ من قالب إبداعي قابل للتعديل."],
    ["02", "دع MiniBites ينشئ", "راجع خطة اللقطات البسيطة ثم ابدأ التوليد عندما تكون جاهزًا."],
    ["03", "احتفظ بالأفضل", "اعتمد كل مقطع أو أعد واحدًا دون فقد بقية العمل."],
    ["04", "انشر في كل مكان", "انشر على YouTube أو نزّل حزمة النشر الجاهزة للمنصات."],
  ] : STEPS;
  return <main className="wrap">
    <section className="hero home-hero">
      <div className="eyebrow"><span className="live-dot" /> {ar ? "قصص مصغّرة جاهزة للمشاركة" : "Miniature stories, ready to share"}</div>
      <h1>{ar ? "طبق صغير." : "One tiny dish."}<br /><span>{ar ? "لحظة كبيرة." : "One big moment."}</span></h1>
      <p className="lede">{ar ? "أنشئ فيديوهات طبخ مصغّرة حقيقية بنسبة 9:16، بمكونات صالحة للأكل وتفاصيل ماكرو ومسار نشر يمكنك الوثوق به." : "Create real 9:16 miniature-cooking videos with real hands, edible ingredients, macro detail, and a publishing workflow you can trust."}</p>
      <div className="hero-actions"><Link className="button" href="/studio">{ar ? "إنشاء فيديو" : "Create a video"} <span>→</span></Link><Link className="text-link" href="/dashboard">{ar ? "فتح لوحة التحكم" : "Open dashboard"}</Link></div>
      <div className="hero-orbit" aria-hidden="true"><div className="orbit-card orbit-one">9:16<small>social ready</small></div><div className="orbit-card orbit-two">1:12<small>true scale</small></div><div className="orbit-card orbit-three">MP4<small>ready to share</small></div></div>
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">{ar ? "بساطة مقصودة" : "Simple by design"}</span><h2>{ar ? "من الطبق إلى المنشور في أربع خطوات" : "Dish to post in four steps"}</h2></div><p>{ar ? "لا جداول زمنية وهمية ولا محرر معقد. كل حالة مبنية على عمل حقيقي." : "No timelines to fake. No complicated editor. Every status comes from real work."}</p></div>
      <div className="steps-grid">{steps.map(([n,title,body]) => <article className="step-card" key={n}><span>{n}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>
    <section className="launch-card"><div><span className="eyebrow">{ar ? "مصمم لأقصر طريق" : "Built for the shortest route"}</span><h2>{ar ? "ولّد مرة. وانشر بثقة." : "Generate once. Publish with confidence."}</h2><p>{ar ? "رفع YouTube آلي. أما TikTok وInstagram فيحصلان على MP4 نظيف ونص جاهز للنسخ حتى اكتمال اعتماد المنصات." : "YouTube upload is automated. TikTok and Instagram get a clean MP4 plus one-click caption copy while platform approval is pending."}</p></div><Link className="button dark" href="/studio">{ar ? "ابدأ الإنشاء" : "Start creating"}</Link></section>
  </main>;
}
