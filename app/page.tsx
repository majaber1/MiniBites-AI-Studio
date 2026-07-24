import Link from "next/link";
import { AGENT_DEFS } from "@/lib/agents/pipeline";

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <h1>
          Type a dish.<br />
          Ten agents cook it <em>tiny</em> — for real.
        </h1>
        <p className="lede">
          MiniBites turns a single dish name — Omelette, Maqluba, Mansaf, Pizza, Cookies — into a real
          9:16 miniature-cooking short: real hands, real 1:12 tools, real edible ingredients, macro ASMR.
          No cartoons. No slideshows. No fake progress.
        </p>
        <Link href="/studio"><button>Open Creator Studio</button></Link>
        <span style={{ display: "inline-block", width: 10 }} />
        <Link href="/agents"><button className="ghost">Meet the agents</button></Link>
      </section>

      <div className="ruler" aria-hidden />

      <section className="grid two">
        <div className="card">
          <h3>Real production state</h3>
          <p className="dim">
            Every production has a durable ID and a persisted state machine. Progress you see is provider
            status — queue position, generation, per-shot completion — never an animated timer. Refresh the
            page; the job is still there.
          </p>
        </div>
        <div className="card">
          <h3>Provider-independent video</h3>
          <p className="dim">
            One contract — submit, status, result, cancel — with adapters for fal.ai models (Wan, Kling and
            others), a self-hosted Wan GPU worker, and a clearly-labeled mock used only for automated tests.
          </p>
        </div>
        <div className="card">
          <h3>Manual approval before publishing</h3>
          <p className="dim">
            Nothing is posted automatically. YouTube Shorts and TikTok packages are prepared, but publishing
            requires your approval and is only marked published when the platform API confirms it.
          </p>
        </div>
        <div className="card">
          <h3>Cost protection built in</h3>
          <p className="dim">
            Password-gated generation, per-IP rate limits, a daily production cap, and per-shot retry limits
            keep GPU spending under your control.
          </p>
        </div>
      </section>

      <div className="ruler" aria-hidden />

      <section>
        <h2 style={{ marginBottom: 14 }}>The kitchen brigade</h2>
        <div className="grid two">
          {AGENT_DEFS.map((a, i) => (
            <div className="card" key={a.id}>
              <span className="mono" style={{ color: "var(--yolk)" }}>{String(i + 1).padStart(2, "0")}</span>
              <h3>{a.name}</h3>
              <p className="dim">{a.role}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
