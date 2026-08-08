# Module 1 — Access / Session / Security

Status: COMPLETE

- Requires separate `APP_ACCESS_PASSWORD` and `SESSION_SECRET`.
- Uses a versioned HMAC token with a verified seven-day expiry.
- Rejects expired/tampered sessions with timing-safe comparisons.
- Uses Secure cookies in production and localhost-compatible cookies in development.
- Adds no-store login/logout responses and creator-facing sign out.
- Serializes owned locks so an expired worker cannot release a newer worker's lock.

Tests: password configuration, correct/incorrect password, expiry, tampering, and lock ownership. Score: 9/10 across functionality, UX, security, reliability, testing and maintainability.

