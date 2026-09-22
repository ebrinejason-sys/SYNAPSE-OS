/**
 * HTML escape for user-controlled values interpolated into email HTML.
 * Prevents XSS in email clients that render HTML.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

const HTML_ESCAPE_REGEX = /[&<>"'/]/g

export function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined) return ''
  return String(text).replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] ?? char)
}
