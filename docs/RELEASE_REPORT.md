# Release report — bilingual UX production hardening

## Scope

- Introduced a maintainable application shell with a collapsible desktop sidebar, mobile drawer, sticky header, breadcrumbs, locale switch and account controls.
- Added persisted English/Arabic selection and document-level `lang`/`dir` updates.
- Added Arabic-aware status labels, access flows, dashboard, landing page, templates, integrations, operations, library primary actions and Creator Studio locale synchronization.
- Replaced third-party runtime font requests with Next.js font optimization for Geist and IBM Plex Sans Arabic.
- Added logical RTL styles, keyboard focus visibility, skip navigation and reduced-motion handling.
- Preserved all real generation, approval, assembly, persistence and publishing safeguards.

## Release gates

| Gate | Result |
| --- | --- |
| TypeScript | Pass |
| Automated tests | 21/21 pass |
| Production build | Pass on Next.js 16.3.0 |
| npm dependency audit | 0 vulnerabilities |
| Desktop browser (1440 × 1000) | AR/EN pass, no horizontal overflow, no console errors or error overlay |
| Mobile browser (375 × 812) | AR/EN pass, drawer and scrim pass, no horizontal overflow |
| RTL/LTR document state | `lang` and `dir` switch and persist correctly |

## Operational notes

- Environment secrets remain in Vercel/local ignored environment files and are never committed.
- Direct YouTube publishing remains private by default.
- TikTok and Instagram continue to use the honest MP4/caption handoff until platform approval.
- Vercel Blob remains an optional external account blocker; Upstash provides durable production/job state.
