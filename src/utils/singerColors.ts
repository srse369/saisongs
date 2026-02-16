/**
 * Singer gender colors for song title when template uses white
 * Blue for men, pink for women, light blue for boys, light pink for girls
 */
export const SINGER_TITLE_COLORS: Record<string, string> = {
  Male: '#2563eb',   // blue
  Female: '#db2777', // pink
  Boy: '#38bdf8',    // light blue
  Girl: '#f472b6',   // light pink
};

/** Check if a color is white (template default) - normalize and compare */
export function isWhiteTitleColor(color: string | undefined): boolean {
  if (!color) return true; // default is white
  const c = color.trim().toLowerCase();
  return c === '#ffffff' || c === '#fff' || c === 'white' || c === 'rgb(255,255,255)' || c === 'rgb(255, 255, 255)';
}

/** Get song title color - use singer color when template is white */
export function getSongTitleColor(
  templateColor: string | undefined,
  singerGender?: string
): string {
  if (!isWhiteTitleColor(templateColor)) {
    return templateColor || '#ffffff';
  }
  if (singerGender && SINGER_TITLE_COLORS[singerGender]) {
    return SINGER_TITLE_COLORS[singerGender];
  }
  return templateColor || '#ffffff';
}
