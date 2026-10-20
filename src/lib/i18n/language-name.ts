/**
 * A language's name in the reader's language, from the browser's and
 * Node's built-in data (for example "tl" is "Tagalog" in English). Codes
 * the built-in data doesn't know are labelled from `fallbacks`.
 */
export function languageName(
  code: string,
  locale: string,
  fallbacks: Record<string, string> = {},
): string {
  if (fallbacks[code]) return fallbacks[code];
  try {
    return (
      new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}
