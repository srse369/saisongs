import React from 'react';

/**
 * Wrapper that sets --offline-banner-height CSS variable (0 - no banner).
 * Offline status is shown via the status dropdown icon (red when offline) instead of a banner.
 */
interface OfflineBannerWrapperProps {
  children: React.ReactNode;
}

export const OfflineBannerWrapper: React.FC<OfflineBannerWrapperProps> = ({ children }) => {
  return (
    <div style={{ '--offline-banner-height': '0px' } as React.CSSProperties}>
      {children}
    </div>
  );
};
