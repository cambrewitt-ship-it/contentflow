// Client-safe link helpers (articleFetcher.ts is server-only)

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/i;

/** Returns the first http(s) link in a block of text, without trailing punctuation. */
export function extractFirstUrl(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(URL_PATTERN);
  if (!match) return null;
  return match[0].replace(/[),.;:!?\]]+$/, '');
}

/** "https://www.example.com/a/b" → "example.com" */
export function linkHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
