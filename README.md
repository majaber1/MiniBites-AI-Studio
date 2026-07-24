# MiniBites AI Studio

Type a dish name — **Omelette, Pizza, Maqluba, Mansaf, Cookies** — and a ten-agent
pipeline plans, generates, reviews and packages a **real miniature-cooking short**
(9:16, real hands, real 1:12 tools, real edible ingredients, macro ASMR) for
TikTok and YouTube Shorts.

**Honesty rules baked into the product:** no simulated progress, no slideshow
labeled as video, the mock provider is loudly labeled, and nothing is ever
marked *published* unless the platform API confirms it.

## Architecture

```
app/                      Next.js 15 App Router (UI + API routes)
  studio/                 Creator Studio — order ticket, live agent/shot state
  library/                Content Library — approve / publish / download
  integrations/           Live env-driven integration status
  api/productions/        Create, poll+advance, retry, approve, publish, cancel
lib/
  agents/pipeline.ts      Persisted 10-agent state machine (real work only)
  providers/              VideoProvider contract + fal.ai / Wan / mock adapters
  store/                  Upstash Redis (durable) or labeled memory fallback
  llm.ts                  Planning via Anthropic or Gemini, template fallback
  security.ts             Password auth, rate limits, daily production cap
```

### The agent pipeline

Orchestrator → Recipe → Miniature Director → Shot Director → Prompt →
Video → Continuity → Quality → Assembly → Publishing.

Serverless-friendly: each poll of `GET /api/productions/:id?advance=1`
performs at most one small unit of *real* work (plan, submit a shot, check the
provider queue, review, assemble) and persists it. Productions survive refresh
and redeploys when the durable store is configured.

### Video providers

One contract — `submitShot / getShotStatus / getShotResult / cancelShot`:

| Provider | Env | Cost |
| --- | --- | --- |
| `fal` (default) | `FAL_KEY`, `FAL_MODEL_ID` | Paid per generation (Wan/Kling/Veo-class models) |
| `wan` | `WAN_VIDEO_ENDPOINT`, `WAN_VIDEO_TOKEN` | Your own GPU (open-source Wan) — lowest marginal cost |
| `mock` | — | Free, **testing only, produces no real video** |

There is no free production-quality hosted video API. Realistic paths are a
paid provider (roughly ~$0.10–$0.50 per 5-second shot depending on model, so
about $1–$4 per 8-shot episode) or open-source Wan on a GPU you rent/own.

## Run locally

```bash
npm install
cp .env.example .env      # fill in at least APP_ACCESS_PASSWORD + SESSION_SECRET
npm run dev
```

Quality gates: `npm run typecheck`, `npm test`, `npm run build`.

## Deploy (Vercel)

1. Import the GitHub repo in Vercel (framework auto-detected: Next.js).
2. Add environment variables from `.env.example`.
3. Deploy. Check `/integrations` — it reports live configuration status.

## Security

- Generation is locked until `APP_ACCESS_PASSWORD` is set (503 with guidance).
- HttpOnly signed session cookie; per-IP rate limits; `MAX_PRODUCTIONS_PER_DAY`
  cap; 3-attempt per-shot retry limit; input validation on every route.
- Secrets live only in server env. `/api/status` reports booleans, never values.

## Publishing

Phase one is manual-approval only. YouTube needs a Google OAuth client with the
`youtube.upload` scope; TikTok needs an approved Content Posting API app. The
Library shows the exact required action until both are connected.
