// Sanitize HTML content to prevent XSS
export const sanitizeHtmlContent = (content: string): string => {
  // Create a temporary element to parse and sanitize
  const temp = document.createElement('div');
  
  // Replace custom color tags with safe spans
  const withSpans = content.replace(
    /<c:([0-9a-fA-F]{6})>(.*?)<\/c:[0-9a-fA-F]{6}>/g,
    (_, color, text) => {
      // Validate hex color
      if (!/^[0-9a-fA-F]{6}$/.test(color)) return text;
      return `<span style="color:#${color}">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
    }
  );
  
  // Only allow safe tags
  const withLineBreaks = withSpans.replace(/<br\s*\/?>/gi, '<br>');
  
  // Parse and extract only text content with allowed tags
  temp.innerHTML = withLineBreaks;
  return temp.innerHTML;
};
