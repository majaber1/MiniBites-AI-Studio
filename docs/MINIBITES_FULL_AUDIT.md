# MiniBites Studio V3 — Full Audit

Evidence date: 2026-08-11. GREEN = production-ready in code; YELLOW = usable with a documented limitation or external dependency; RED = broken; GRAY = intentionally future scope. Claims are based on code, automated tests, local browser checks, GitHub CI and live Vercel Production—not README text alone.

| Module | Exists | Working | Missing | Bugs | UX Issues | Tests | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Access/session | Yes | Signed expiring HttpOnly cookie, rate limit, logout | Multi-user accounts | None known | Shared studio password is phase-one scope | Tamper, expiry, separate secrets | P0 | GREEN |
| Environment validation | Yes | Safe central readiness report; production rejects mock/non-durable project store | Optional provider health history | None known; exposed fal key was rotated and revoked | None | Non-disclosure, provider requirements | P0 | GREEN |
| Idea input | Yes | Dish, direction, presets, EN/AR | Full global UI translation | None known | Arabic navigation remains English | Browser + request validation | P1 | GREEN |
| Creative style | Yes | 10 internal styles, 6 visual cards | More visual previews | None known | Advanced styles accessible through templates/API | Planner tests | P1 | GREEN |
| Video format | Yes | 9:16 provider contract; Quick/Standard/Extended alter plans | Resolution selector intentionally hidden | Provider-specific output metadata | No technical controls by default | Preset validation | P1 | GREEN |
| Shot planner | Yes | Coherent 6–9 shot plan with hook/story/continuity | Frame-aware planning | None known | Camera/sound editing remains advanced/API-level | Schema, reorder, browser edit | P0 | GREEN |
| Planner providers | Yes | Anthropic, Gemini, deterministic fallback | Provider health history | None known | Hidden from normal flow | Invalid JSON/fallback | P0 | GREEN |
| Visual continuity | Yes | Persisted project visual bible inherited by prompts | Reference image support varies | fal text provider lacks reference images | Honest capability display | Prompt lifecycle | P0 | YELLOW |
| Video generation | Yes | fal, Google/Veo, Wan, mock abstraction | Live paid smoke test after key rotation | External provider behavior | None in normal flow | Mock lifecycle/provider safety | P0 | YELLOW |
| Cost control | Yes | Validate-before-charge, daily cap, idempotency, locks, usage/cost ledger | Exact costs need configured rate/provider billing | Unknown cost shown as unknown | Cost hidden from creators | Invalid/duplicate/concurrent retry | P0 | GREEN |
| Progress | Yes | Real state/shot counts; resumable after refresh | Push notification | None known | No fake percentage | Browser lifecycle | P1 | GREEN |
| Jobs/Redis | Yes | Durable state, owned locks, recovery by polling | Dedicated background queue | Poll-driven execution needs browser/client activity | Long jobs rely on resume polling | Lock/race tests | P0 | YELLOW |
| Clip review | Yes | Preview, accept, regenerate one clip | Upload replacement clip | Provider video preview longevity | Prompt editing after generation is next step | Review/accept gate | P0 | GREEN |
| Shot versions | Yes | Every completed version preserved; regeneration cost confirmation | Restore-old-version UI | None known | Version count only, history UI compact | Version preservation | P0 | GREEN |
| Assembly | Yes | Ordered fal ffmpeg merge; honest individual-clip fallback | Live merge smoke test after key rotation | External merge can fail | Fallback is clearly explained | Pipeline lifecycle | P0 | YELLOW |
| Audio | Partial | Provider-native/ASMR prompt intent | Mixing, royalty-free library, user upload | No post-production mixer | Controls not exposed yet | Capability metadata | P1 | YELLOW |
| Text/end card | Partial | Titles/captions/social safe-area prompt | Rendered overlays/watermark composition | SVG watermark not composited yet | No overlay editor | Asset/build verification | P1 | YELLOW |
| Approval | Yes | Manual approval, notes, request changes, timestamps | Rich comment thread | None known | Uses a simple prompt dialog for notes | Unapproved/request-changes tests | P0 | GREEN |
| Social captions | Yes | TikTok, Instagram, YouTube pack with bounded hashtags | In-app caption editor | LLM output shares base caption | Copy actions are simple | Manual pack safety | P0 | GREEN |
| YouTube | Yes | Server OAuth refresh/upload; API-confirmed; private default | OAuth connect/callback UI; live credentials | External OAuth unconfigured | Clear dependency status | Private-default, unapproved guard | P0 | YELLOW |
| TikTok | Handoff | MP4 download, caption copy, upload link | Direct Post requires platform approval | Not connected | Honest manual path | False-claim safety | P1 | YELLOW |
| Instagram | Handoff | MP4 download, caption copy, platform link | Direct Graph publishing approval | Not connected | Honest manual path | False-claim safety | P1 | YELLOW |
| Library | Yes | Search, filter, lazy previews, open, duplicate, archive, publish pack | Server pagination beyond first 50 | Historical legacy names normalized in UI | Creator-focused metadata | Duplicate/no-media test + browser | P1 | GREEN |
| Templates | Yes | 10 editable regional/global/seasonal templates | Marketplace intentionally future | None known | Clear categories | Browser handoff | P1 | GREEN |
| Dashboard | Yes | Dedicated command center with real recent projects, metrics, readiness, workflow and missing integrations | Social analytics require connected platform APIs | None known | Intentionally avoids fabricated corporate analytics | Browser + API | P1 | GREEN |
| Operations | Yes | Separate unlinked password gate, health/jobs/failures/cost; live credential verified | Lock enumeration and provider latency | None known | Intentionally absent from creator nav | Separate-password test + live API | P1 | GREEN |
| Object storage | Yes | Optional Vercel Blob archive with provider fallback | Blob store must be connected externally | Provider URLs may expire without Blob | Warning shown in Library | Type/build; fallback path | P0 | YELLOW |
| Branding | Yes | Six SVG assets, palette, typography, tagline | Automated watermark composition | None known | Consistent creator-studio direction | Render/build/browser | P1 | GREEN |
| Mobile/RTL/a11y | Partial | 375px no overflow, RTL form, labels, focus, tap targets | Full Arabic app shell and WCAG audit | No known blocking mobile bug | Approval prompt is basic | Desktop/mobile browser | P1 | YELLOW |
| CI/security | Yes | npm ci, typecheck, 21 tests, build, high audit | Lint script not configured | None known; 0 audit vulnerabilities | — | GitHub verify passed | P0 | GREEN |

## Remaining production dependencies

1. Connect Vercel Blob to obtain `BLOB_READ_WRITE_TOKEN` if durable final-video archiving is required.
2. Configure YouTube OAuth only when private channel uploads are desired; TikTok/Instagram remain honest manual handoffs until platform approval.
3. Run one deliberately low-cost real fal shot and one real merge when production credit use is explicitly approved; automated tests never spend production credit.

## Intentionally future scope

Creator profiles, restaurant brand kits, analytics from connected social APIs, template marketplace, push notifications, music licensing/library, and rendered text/watermark composition remain future-ready concepts rather than falsely claimed V3 features.
