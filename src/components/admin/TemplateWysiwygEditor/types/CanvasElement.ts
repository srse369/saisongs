// Element types for the canvas
export type CanvasElement = {
  id: string;
  type: 'image' | 'text' | 'video' | 'audio';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  // For images
  url?: string;
  // For text
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  // Common
  opacity?: number;
  zIndex?: number;
  // For video/audio behavior
  autoPlay?: boolean;
  loop?: boolean;
  hideVideo?: boolean;
  hideAudio?: boolean;
  visualHidden?: boolean;
  volume?: number;
  // Multi-slide audio (1-based slide numbers)
  startSlide?: number;
  endSlide?: number;
};

// Type for history state
export type HistoryState = {
  slides: any[]; // Using any to avoid circular dependency with PresentationTemplate
  selectedSlideIndex: number;
};
