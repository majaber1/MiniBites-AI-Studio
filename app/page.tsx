import Link from "next/link";

const STEPS = [
  ["01", "Share your idea", "Name a dish or start with an editable creative template."],
  ["02", "Let MiniBites create", "Review a simple shot plan, then start generation when you're ready."],
  ["03", "Keep only the best", "Accept each clip or remake one without losing the rest."],
  ["04", "Share everywhere", "Publish to YouTube or download the ready-to-post social pack."],
];

export default function Home() {
  return <main className="wrap">
    <section className="hero home-hero">
      <div className="eyebrow"><span className="live-dot" /> Miniature stories, ready to share</div>
      <h1>One tiny dish.<br /><span>One big moment.</span></h1>
      <p className="lede">Create real 9:16 miniature-cooking videos with real hands, edible ingredients, macro detail, and a publishing workflow you can trust.</p>
      <div className="hero-actions"><Link className="button" href="/studio">Create a video <span>→</span></Link><Link className="text-link" href="/templates">Explore templates</Link></div>
      <div className="hero-orbit" aria-hidden="true"><div className="orbit-card orbit-one">9:16<small>social ready</small></div><div className="orbit-card orbit-two">1:12<small>true scale</small></div><div className="orbit-card orbit-three">MP4<small>ready to share</small></div></div>
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">Simple by design</span><h2>Dish to post in four steps</h2></div><p>No timelines to fake. No complicated editor. Every status comes from real work.</p></div>
      <div className="steps-grid">{STEPS.map(([n,title,body]) => <article className="step-card" key={n}><span>{n}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>
    <section className="launch-card"><div><span className="eyebrow">Built for the shortest route</span><h2>Generate once. Publish with confidence.</h2><p>YouTube upload is automated. TikTok and Instagram get a clean MP4 plus one-click caption copy while platform approval is pending.</p></div><Link className="button dark" href="/studio">Start creating</Link></section>
  </main>;
}
