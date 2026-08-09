# Clip Review, Assembly and Storage

- Existing: per-shot results, retry, ordered fal ffmpeg merge and honest individual-clip fallback.
- Problems found: real clips auto-advanced into assembly; no clip acceptance gate, version history or durable final-media adapter.
- Implemented: explicit review state, accept/regenerate actions, cost confirmation, three-attempt cap, saved versions, all-clips-accepted assembly gate and Vercel Blob archiving.
- UX: a failed/bad clip can be remade without losing other clips or its prior successful version.
- Security/reliability: owned per-shot and assembly locks; no provider error bodies; provider URL retained if archival fails.
- Tests: acceptance gate, version preservation, concurrent retry and mock lifecycle.
- Remaining: Blob must be connected; live fal merge/Blob smoke test awaits a rotated key.
- Scores: Functionality 9, UX 9, UI 9, Mobile 9, Security 9, Testing 9, Reliability 8, Performance 8, Creator Value 10, Maintainability 9.
- Status: PARTIAL only because live external media services are not yet safely testable.
