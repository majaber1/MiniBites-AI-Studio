# Modules 2–9 — Idea, Planning, Providers, Generation, Cost and Jobs

Status: PARTIAL (core paid boundary complete; recovery/storage work remains)

Implemented:

- Creator-first idea, optional direction, visual style, story mode and length selection.
- Technical video-engine selection moved under Advanced.
- Structured planner validation before any paid call.
- Project visual bible inherited by every shot prompt.
- Explicit planned state: no shot is submitted until the creator presses Generate.
- Shot-plan edit, reorder, delete and add operations before generation.
- Idempotent creation request IDs and distributed owned locks.
- Provider capability metadata.
- Submitted/completed/failed usage counts and optional environment-driven cost estimates.
- Safe provider errors without raw third-party response bodies.
- Meaningful, non-fake generation progress.

Verified:

- Invalid input consumes no daily quota.
- A repeated request creates one project and consumes one quota slot.
- Planning submits zero paid shots.
- Lock release requires the owning token.
- Inline shot editing persists through the API.
- Mobile width 375px has no horizontal overflow; Arabic switches the form to RTL.

Remaining: durable background execution independent of browser polling, shot version history, durable object storage, provider contract fixtures and operations dashboard.

