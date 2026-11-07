/** Returns the URL only if it is an absolute http(s) link (blocks javascript:, data:, file:, …). */
export function safeUrl(u: string | undefined | null): string | undefined {
  if (!u) return undefined;
  try {
    const p = new URL(u);
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : undefined;
  } catch {
    return undefined;
  }
}
