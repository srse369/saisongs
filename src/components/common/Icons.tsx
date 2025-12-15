// Common icon components using Font Awesome

interface IconProps {
  className?: string;
}

export const RefreshIcon: React.FC<IconProps> = ({ className = "text-lg" }) => (
  <i className={`fas fa-sync ${className}`}></i>
);

export const MusicNoteIcon: React.FC<IconProps> = ({ className = "text-lg" }) => (
  <i className={`fas fa-music ${className}`}></i>
);

// Simpler music note alternative
export const MusicIcon: React.FC<IconProps> = ({ className = "text-lg" }) => (
  <i className={`fas fa-music ${className}`}></i>
);

// Simple pitch/tuning fork icon
export const PitchIcon: React.FC<IconProps> = ({ className = "text-lg" }) => (
  <i className={`fas fa-sliders-h ${className}`}></i>
);

// Song/document icon
export const SongIcon: React.FC<IconProps> = ({ className = "text-lg" }) => (
  <i className={`fas fa-file-alt ${className}`}></i>
);

