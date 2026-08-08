# MiniBites Studio V3 — Full Audit

Legend: GREEN production-ready; YELLOW partial; RED broken; GRAY not implemented. This is code-and-test evidence, not a restatement of README claims.

| Module | Exists | Working | Missing / bugs / UX | Tests | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Access/session | Yes | Signed expiring cookie, rate limit, logout | Single-studio password model | Tamper, expiry, lock ownership | GREEN | P0 |
| Environment validation | Yes | Safe central readiness report; production blocks mock and non-durable storage | Live credentials still require deployment verification | Secret non-disclosure + provider requirements | GREEN | P0 |
| Idea/style/story | Yes | Dish, direction, style, story, length, EN/AR | Duration presets do not yet alter plan length | Browser verified | GREEN | P1 |
| Shot planner | Yes | Anthropic/Gemini + deterministic fallback | Rich editing for camera/sound still basic | Schema + lifecycle | GREEN | P0 |
| Planner schema | Yes | Rejects untrusted malformed JSON | — | Valid/invalid shapes | GREEN | P0 |
| Visual continuity | Yes | Project visual bible inherited by every prompt | Reference-image continuity varies by provider | Prompt lifecycle | YELLOW | P0 |
| Paid-generation boundary | Yes | Planning stops before explicit Generate | — | Zero submissions before confirm | GREEN | P0 |
| Creation idempotency | Yes | Stable request ID and distributed create lock | — | Duplicate quota test | GREEN | P0 |
| Redis/jobs | Yes | Durable state, counters, owned locks | Background execution remains poll-driven | Lock ownership | YELLOW | P0 |
| Provider abstraction | Yes | fal, Google, Wan, mock + capability metadata | Provider contract integration tests | Mock lifecycle | YELLOW | P0 |
| Cost controls | Yes | Validation, daily cap, usage ledger, optional cost estimate | Operations UI pending | Invalid/duplicate quota | GREEN | P0 |
| Clip review | Partial | Per-shot status/preview/retry | Accept/replace/version history | Retry lifecycle partial | YELLOW | P0 |
| Plan editing | Yes | Edit/reorder/delete/add before generation | Camera/sound editing is API-ready, UI action-focused | Reorder test + browser edit | GREEN | P0 |
| Regeneration | Yes | Failed/rejected shot only; max 3 attempts | Confirmation/version history | Partial | YELLOW | P0 |
| Assembly | Yes | fal ffmpeg, ordered clips, honest fallback | Durable final object storage | Pipeline | YELLOW | P0 |
| Approval | Yes | Mandatory before publishing | Approval notes | Pipeline | GREEN | P0 |
| YouTube | Yes | Private-first upload and refresh-token flow | Full OAuth connect UI and live credential test | Safety test pending | YELLOW | P0 |
| TikTok | Handoff | Honest manual flow | External Content Posting approval | Safety test pending | YELLOW | P1 |
| Instagram | Handoff | Download/copy/open | Direct API not implemented | Safety test pending | YELLOW | P1 |
| Library | Yes | Durable list and actions | Search/filter/duplicate/archive/thumbnails | None | YELLOW | P1 |
| Templates | Minimal | Inspiration chips | Reusable template domain/library | None | RED | P1 |
| Object storage | Placeholder | Provider URLs work temporarily | Durable archive implementation | None | RED | P0 |
| Admin operations | No | Safe status endpoint only | Jobs, locks, costs, failures | None | RED | P1 |
| Mobile/RTL/a11y | Partial | No overflow at 375px; form RTL | Full product translation/nav work | Browser verified | YELLOW | P1 |
| CI | Yes | GitHub Actions runs install, typecheck, tests, build and high-severity audit | First remote run pending push | Local gates pass | GREEN | P0 |

## Highest-priority remaining work

1. Durable final-media storage and recoverable assembly/upload state.
2. Shot versioning and accepted-clip preservation.
3. YouTube safety tests and platform-aware publishing pack.
4. Library/templates/admin operations.
5. Complete bilingual/mobile polish, branding assets and final deployment verification.
