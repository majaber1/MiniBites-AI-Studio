# Approval and Social Publishing

- Existing: human approval, private-first YouTube upload, final MP4 download, caption copy and manual TikTok/Instagram handoff.
- Problems found: no approval notes/request-changes state, one generic caption action, limited automated safety evidence.
- Implemented: locked approve/request-changes decisions, note sanitization/timestamps, platform-aware social pack and dedicated copy actions.
- Safety: unapproved content cannot publish; YouTube defaults private; TikTok/Instagram are never shown as direct publishing when unavailable.
- Tests: unapproved route guard, request changes, private YouTube multipart metadata and manual handoff assertions.
- Remaining: YouTube OAuth connect UI/live channel test; TikTok and Instagram require external platform approval.
- Scores: Functionality 9, UX 9, UI 8, Mobile 9, Security 10, Testing 9, Reliability 9, Performance 9, Creator Value 10, Maintainability 9.
- Status: PARTIAL due external platform credentials/approval only.
