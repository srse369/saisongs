import DOMPurify from 'dompurify';

/** Allowed tags for template text: span (for colored text), br (line breaks) */
const ALLOWED_TAGS = ['span', 'br'];
/** Allowed attributes: only style on span for color */
const ALLOWED_ATTR = ['style'];

/**
 * Sanitize HTML content to prevent XSS.
 * Uses DOMPurify with strict allowlist: only span and br tags, style attribute for color.
 */
export const sanitizeHtmlContent = (content: string): string => {
  // Replace custom color tags with safe spans (before DOMPurify)
  const withSpans = content.replace(
    /<c:([0-9a-fA-F]{6})>(.*?)<\/c:[0-9a-fA-F]{6}>/g,
    (_, color, text) => {
      if (!/^[0-9a-fA-F]{6}$/.test(color)) return escapeHtml(text);
      return `<span style="color:#${color}">${escapeHtml(text)}</span>`;
    }
  );

  const withLineBreaks = withSpans.replace(/<br\s*\/?>/gi, '<br>');

  return DOMPurify.sanitize(withLineBreaks, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: null,
  });
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
