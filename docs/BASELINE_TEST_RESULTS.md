# Verified V3 Baseline — 2026-08-09

Source of truth: fresh clone of GitHub `main` at `1d50363`, hardened on `agent/minibites-v3-hardening`.

| Check | Baseline | Current evidence |
| --- | --- | --- |
| `npm ci` | Earlier working copy hit a Windows `ENOTEMPTY` condition | PASS in the fresh clone: 32 locked packages installed |
| `npm run typecheck` | PASS | PASS after current changes |
| `npm test` | 4/4 | 9/9 after security, planner, lock and cost-safety coverage |
| `npm run build` | Previous V3 deploy built | PASS locally with Next.js 16.3/Turbopack |
| Lint | Not configured | Still missing; CI work remains |
| Paid API tests | Not run | Intentionally not run; browser lifecycle used the labeled mock provider |

External production configuration previously verified: password/session, Upstash, Anthropic, fal.ai and fal assembly. YouTube OAuth, TikTok direct posting and Instagram direct posting remain external/unconfigured dependencies.

