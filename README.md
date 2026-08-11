# MiniBites Studio V3

A focused production studio for real miniature-cooking vertical videos. V3 turns a dish name into planned shots, generates real video, merges the clips, requires human approval, and prepares a social publishing pack.

## Fastest launch path

1. Deploy to Vercel.
2. Create an Upstash Redis database for durable jobs.
3. Add a fresh `FAL_KEY`; it powers video generation and automatic MP4 merging. Never reuse a key disclosed in chat or logs.
4. Add `APP_ACCESS_PASSWORD` and a long random `SESSION_SECRET`.
5. Optionally add Gemini or Anthropic for custom planning. The labeled template planner works without either.
6. Connect Vercel Blob for durable final-MP4 archiving.
7. Connect YouTube OAuth when ready. Keep `YOUTUBE_PRIVACY=private` for initial uploads.

TikTok Direct Post and public YouTube API publishing require platform review. Until approved, the Library provides the reliable route: download the final MP4, copy the prepared caption, and open TikTok or Instagram.

## Required production environment

```env
APP_ACCESS_PASSWORD=
SESSION_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
VIDEO_PROVIDER=fal
FAL_KEY=
BLOB_READ_WRITE_TOKEN=
YOUTUBE_PRIVACY=private
```

See `.env.example` for optional LLM, self-hosted Wan, Google video, and YouTube OAuth settings.

## Local verification

```bash
npm ci
npm run typecheck
npm test
npm run build
```

The mock provider is testing-only and never claims to create a real video.

## Creator flow

`Idea → Style → Plan → Generate → Review each clip → Assemble → Approve → Publish pack`

The Library supports search, status filters, resumable projects, duplication without copying paid media, archive, download and platform-specific copy actions. `/templates` contains editable Saudi/Arab, global and seasonal starting points. `/operations` is deliberately absent from creator navigation and requires a separate `ADMIN_ACCESS_PASSWORD`.

## Bilingual application shell

MiniBites supports English (LTR) and Arabic (RTL) from the persistent language switch in the application header. The responsive shell includes a collapsible desktop sidebar, mobile drawer, breadcrumbs, accessible focus states and reduced-motion support. Geist is used for English and IBM Plex Sans Arabic for Arabic through Next.js self-hosted font optimization.

See `docs/PRODUCT_AUDIT.md` for the module matrix and remaining external dependencies, and `docs/RELEASE_REPORT.md` for release verification.
