import { AGENT_DEFS } from "@/lib/agents/pipeline";

export const metadata = { title: "Agents — MiniBites AI Studio" };

export default function AgentsPage() {
  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>The agent pipeline</h1>
        <p className="lede">
          Ten agents run in a persisted state machine. Order matters — this really is a sequence, from
          understanding the dish to a publish-ready package — and each stage only turns green when its real
          work completed.
        </p>
      </section>
      <div className="ruler" aria-hidden />
      <table>
        <thead>
          <tr><th>Stage</th><th>Agent</th><th>Responsibility</th></tr>
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
        Honesty note: Continuity and Quality agents enforce the style contract, negative prompts and per-shot
        results server-side. Frame-level visual judging needs a vision-model pass or your eyes — which is why
        final approval is always manual in phase one.
      </div>
    </main>
  );
}
