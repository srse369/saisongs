/**
 * Curated list of fonts available for slide presentations
 * Includes system fonts and Google Fonts
 */

export interface FontOption {
  name: string;
  family: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'indic';
  isSystemFont?: boolean; // System fonts are always available
}

export const AVAILABLE_FONTS: FontOption[] = [
  // Sans-serif fonts (modern, clean, highly readable)
  { name: 'Arial', family: 'Arial, sans-serif', category: 'sans-serif', isSystemFont: true },
  { name: 'Inter', family: 'Inter, sans-serif', category: 'sans-serif' },
  { name: 'Roboto', family: 'Roboto, sans-serif', category: 'sans-serif' },
  { name: 'Open Sans', family: 'Open Sans, sans-serif', category: 'sans-serif' },
  { name: 'Lato', family: 'Lato, sans-serif', category: 'sans-serif' },
  { name: 'Montserrat', family: 'Montserrat, sans-serif', category: 'sans-serif' },
  { name: 'Poppins', family: 'Poppins, sans-serif', category: 'sans-serif' },
  
  // Serif fonts (traditional, elegant)
  { name: 'Georgia', family: 'Georgia, serif', category: 'serif', isSystemFont: true },
  { name: 'Times New Roman', family: 'Times New Roman, Times, serif', category: 'serif', isSystemFont: true },
  { name: 'Playfair Display', family: 'Playfair Display, serif', category: 'serif' },
  { name: 'Merriweather', family: 'Merriweather, serif', category: 'serif' },
  { name: 'Lora', family: 'Lora, serif', category: 'serif' },
  
  // Display fonts (bold, attention-grabbing)
  { name: 'Oswald', family: 'Oswald, sans-serif', category: 'display' },
  { name: 'Bebas Neue', family: 'Bebas Neue, sans-serif', category: 'display' },
  
  // Handwriting/Script fonts (decorative)
  { name: 'Pacifico', family: 'Pacifico, cursive', category: 'handwriting' },
  { name: 'Dancing Script', family: 'Dancing Script, cursive', category: 'handwriting' },
  
  // Indic language fonts (for devotional content)
  { name: 'Noto Sans Devanagari', family: 'Noto Sans Devanagari, sans-serif', category: 'indic' },
  { name: 'Noto Sans Telugu', family: 'Noto Sans Telugu, sans-serif', category: 'indic' },
];

/**
 * Get font family string by font name
 */
export function getFontFamily(fontName: string | undefined): string {
  if (!fontName) return 'Arial, sans-serif';
  const font = AVAILABLE_FONTS.find(f => f.name === fontName);
  return font?.family || fontName;
}

/**
 * Get fonts grouped by category for display in dropdowns
 */
export function getFontsByCategory(): Record<string, FontOption[]> {
  const grouped: Record<string, FontOption[]> = {};
  for (const font of AVAILABLE_FONTS) {
    if (!grouped[font.category]) {
      grouped[font.category] = [];
    }
    grouped[font.category].push(font);
  }
  return grouped;
}

/**
 * Category display names
 */
export const FONT_CATEGORY_NAMES: Record<string, string> = {
  'sans-serif': 'Sans-Serif',
  'serif': 'Serif',
  'display': 'Display',
  'handwriting': 'Handwriting',
  'indic': 'Indic Languages',
};

