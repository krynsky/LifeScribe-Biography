/**
 * Turn what a user typed into a safe link target, or null if it isn't one.
 * Accepts http(s) URLs, mailto:/tel: links, bare emails, and bare domains (https:// is added).
 * Anything else — javascript:, data:, file:, plain words — is rejected.
 */
export function normalizeLinkUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;

  if (/^(https?:|mailto:|tel:)/i.test(text)) {
    try {
      const u = new URL(text);
      return u.protocol === "mailto:" || u.protocol === "tel:" || u.hostname ? text : null;
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^/]+:\d+/.test(text)) return null; // other schemes
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) return `mailto:${text}`;
  if (/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(text)) return `https://${text}`;
  return null;
}
