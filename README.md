# MiniBites Studio V3

A focused production studio for real miniature-cooking vertical videos. V3 turns a dish name into planned shots, generates real video, merges the clips, requires human approval, and prepares a social publishing pack.

## Fastest launch path

1. Deploy to Vercel.
2. Create an Upstash Redis database for durable jobs.
3. Add a `FAL_KEY`; it powers video generation and automatic MP4 merging.
4. Add `APP_ACCESS_PASSWORD` and a long random `SESSION_SECRET`.
5. Optionally add Gemini or Anthropic for custom planning. The labeled template planner works without either.
6. Connect YouTube OAuth when ready. Keep `YOUTUBE_PRIVACY=private` for initial uploads.

TikTok Direct Post and public YouTube API publishing require platform review. Until approved, the Library provides the reliable route: download the final MP4, copy the prepared caption, and open TikTok or Instagram.

## Required production environment

```env
APP_ACCESS_PASSWORD=
SESSION_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
VIDEO_PROVIDER=fal
FAL_KEY=
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
