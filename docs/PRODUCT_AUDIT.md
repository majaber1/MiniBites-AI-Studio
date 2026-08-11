# Product audit — bilingual production hardening

Baseline captured on 2026-08-11 from `main` at `09d0c365966bb7a74632f6d2fa85db4cd94e872e`.

## Baseline verification

| Check | Result |
| --- | --- |
| Locked install | Pass (`npm ci`) |
| TypeScript | Pass |
| Automated tests | 21/21 pass |
| Production build | Pass, 12 static/dynamic application routes |
| Dependency audit | 0 vulnerabilities |

## Module matrix

| Module | Baseline | Work in this release | External dependency |
| --- | --- | --- | --- |
| Application shell | Top navigation; mobile links hidden | Responsive sidebar, mobile drawer, top header, breadcrumbs, locale and account controls | None |
| Localization | Partial Arabic in Studio only | Shared persisted AR/EN locale, document RTL/LTR, localized navigation, major pages, controls and statuses | None |
| Typography and tokens | Remote DM Sans/Manrope links | Next.js self-hosted Geist and IBM Plex Sans Arabic, logical CSS, focus and reduced-motion tokens | Build-time font asset resolution |
| Dashboard | Functional real project/integration data | Bilingual command center, localized dates and workflow | Existing APIs |
| Creator Studio | Real planning/generation/review/assembly flow | Global locale synchronization and bilingual form semantics | fal.ai / selected provider |
| Library | Search, filters, approval, downloads and publishing | Bilingual primary workflow and filters | YouTube OAuth for direct publish |
| Templates | Functional editable presets | Bilingual hierarchy and actions | None |
| Integrations | Safe presence-only environment report | Bilingual status and setup guidance | Provider credentials |
| Operations | Separate administrator gate and real metrics | Bilingual access and status presentation | `ADMIN_ACCESS_PASSWORD`, durable store |
| Accessibility | Semantic pages, partial labels | Skip link, visible focus, current-page state, mobile dialog scrim, logical direction, reduced motion | Browser/AT verification |
| Storage | Upstash durable jobs; Blob optional | No behavioral change | Vercel Blob billing/profile completion |
| Social publishing | YouTube direct path plus manual packs | No false-success behavior; manual TikTok/Instagram path retained | YouTube OAuth and platform approvals |

## Remaining external blockers

- Vercel Blob cannot be provisioned until the Vercel billing profile is complete. The application remains usable and clearly reports this optional archival gap.
- YouTube direct publishing requires OAuth credentials and consent. TikTok/Instagram direct posting requires their platform approval; download/caption handoff is the supported fallback.
- A paid fal.ai generation is intentionally not triggered by automated verification. The real provider path is configured and cost confirmation remains mandatory.

No secret values are recorded in this document or exposed by the status API.
