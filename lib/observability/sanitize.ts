// ---------------------------------------------------------------------------
// Kiswani AI Studio — Airtight Secret Redaction & Sanitization
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /auth/i,
  /credential/i,
  /bearer/i,
  /private[-_]?key/i,
  /cookie/i,
  /session/i,
  /x-goog-api-key/i,
];

const SECRET_VALUE_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/g, // Google API keys
  /sk-ant-[0-9A-Za-z-_]{40,}/g, // Anthropic API keys
  /sk-[0-9A-Za-z-_]{32,}/g, // OpenAI-style keys
  /fal_[0-9A-Za-z-_]{30,}/g, // Fal keys
  /ghp_[0-9A-Za-z]{36}/g, // GitHub tokens
  /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, // JWTs
];

export function redactString(str: string): string {
  if (!str || typeof str !== "string") return str;
  let redacted = str;

  // Redact URL query parameters like ?key=... or ?token=...
  redacted = redacted.replace(/([?&](?:key|api_key|apiKey|token|secret|password)=)[^&]+/gi, "$1[REDACTED]");

  // Redact headers like Bearer ... or Key ...
  redacted = redacted.replace(/(Bearer\s+)[A-Za-z0-9-_.]+/gi, "$1[REDACTED]");
  redacted = redacted.replace(/(Key\s+)[A-Za-z0-9-_:]+/gi, "$1[REDACTED]");

  // Redact known key patterns
  for (const pattern of SECRET_VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }

  return redacted;
}

export function sanitizeValue(val: unknown, keyName?: string): unknown {
  if (val === null || val === undefined) return val;

  if (typeof val === "string") {
    if (keyName && SENSITIVE_KEY_PATTERNS.some((p) => p.test(keyName))) {
      return "[REDACTED]";
    }
    return redactString(val);
  }

  if (typeof val === "number" || typeof val === "boolean") {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeValue(item, keyName));
  }

  if (typeof val === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERNS.some((p) => p.test(k))) {
        sanitizedObj[k] = "[REDACTED]";
      } else {
        sanitizedObj[k] = sanitizeValue(v, k);
      }
    }
    return sanitizedObj;
  }

  return val;
}

export function sanitizeObject<T>(obj: T): T {
  return sanitizeValue(obj) as T;
}
