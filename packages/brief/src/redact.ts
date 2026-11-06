/** Defense in depth, not a guarantee: never import credential files in the first place. */
export function redactText(text: string): string {
  return text
    .replace(
      /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?(?:-----END[ A-Z]*PRIVATE KEY-----|$)/g,
      "[REDACTED PRIVATE KEY]",
    )
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,}|ym_[A-Za-z0-9_-]{12,}|AKIA[A-Z0-9]{16})\b/g,
      "[REDACTED TOKEN]",
    )
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED JWT]")
    .replace(/\bBearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]")
    .replace(
      /\b((?:[a-z_]*api[_-]?key|[a-z_]*token|[a-z_]*secret|[a-z_]*password|passwd|authorization|cookie)\s*["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,"'<>]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(
      /([?&](?:key|token|secret|password|access_token|api_key)=)[^\s&#"']+/gi,
      "$1[REDACTED]",
    );
}
