# Verified V3 Baseline — 2026-08-09

Source of truth: fresh clone of GitHub `main` at `1d50363`, hardened on `agent/minibites-v3-hardening`.

| Check | Baseline | Current evidence |
| --- | --- | --- |
| `npm ci` | Earlier working copy hit a Windows `ENOTEMPTY` condition | PASS in the fresh clone: 32 locked packages installed |
| `npm run typecheck` | PASS | PASS after current changes |
| `npm test` | 4/4 | 21/21 after security, planner, lock, cost, clip-version, duplication and social-safety coverage |
| `npm run build` | Previous V3 deploy built | PASS locally with Next.js 16.3/Turbopack |
| Lint | Not configured | No lint script; TypeScript, build and React/browser review are enforced |
| Paid API tests | Not run | Intentionally not run; browser lifecycle used the labeled mock provider |

External production configuration previously verified: password/session, Upstash, Anthropic, fal.ai and fal assembly. YouTube OAuth, TikTok direct posting and Instagram direct posting remain external/unconfigured dependencies.

GitHub CI `verify` and Vercel Preview both passed. Vercel Blob and the separately protected Operations dashboard were implemented after baseline; they require `BLOB_READ_WRITE_TOKEN` and `ADMIN_ACCESS_PASSWORD` respectively.
