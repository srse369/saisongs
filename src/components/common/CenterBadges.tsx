import React, { useState, useEffect } from 'react';
import { getCacheItem, setCacheItem } from '../../utils/cacheUtils';
import { CACHE_KEYS } from '../../utils/cacheUtils';

interface Center {
  id: number;
  name: string;
  badgeTextColor?: string;
}

interface CenterBadgesProps {
  centerIds: number[];
  showAllIfEmpty?: boolean; // Show "All Centers" badge if centerIds is empty
  showWarningIfEmpty?: boolean; // Show warning badge if centerIds is empty (for singers)
  /** Label when no centers = available to all. Default "Public Session". Use "Public" for templates. */
  publicLabel?: string;
}

// Singleton cache for centers data to prevent multiple fetches
let centersCache: Center[] | null = null;
const CENTERS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let centersFetchPromise: Promise<Center[]> | null = null;

/**
 * Clears the centers cache so the next fetch gets fresh data.
 * Call this after centers are created, updated, or deleted.
 */
export const clearCentersCache = (): void => {
  centersCache = null;
  centersFetchPromise = null;
};

/**
 * Fetches centers with singleton caching to prevent duplicate requests.
 * Exported for use in other components that need center data.
 */
export const fetchCentersOnce = async (): Promise<Center[]> => {
  // Return cached data if available
  if (centersCache) {
    return centersCache;
  }

  // Return existing promise if fetch is in progress
  if (centersFetchPromise) {
    return centersFetchPromise;
  }

  // Start new fetch
  centersFetchPromise = (async () => {
    try {
      // Browser cache first
      const raw = await getCacheItem(CACHE_KEYS.SAI_SONGS_CENTERS);
      if (raw) {
        try {
          const { timestamp, centers } = JSON.parse(raw) as { timestamp: number; centers: Center[] };
          if (Array.isArray(centers) && Date.now() - timestamp < CENTERS_CACHE_TTL_MS) {
            centersCache = centers;
            return centers;
          }
        } catch {
          // Ignore parse errors
        }
      }

      const response = await fetch('/api/centers');
      if (response.ok) {
        const data = await response.json();
        const centers = Array.isArray(data) ? data : [];
        centersCache = centers;
        // Persist to localStorage for offline use and browser cache stats
        if (centers.length > 0) {
          setCacheItem(CACHE_KEYS.SAI_SONGS_CENTERS, JSON.stringify({
            timestamp: Date.now(),
            centers,
          })).catch(() => {});
        }
        return centers;
      }
      throw new Error('Failed to fetch centers');
    } catch (error) {
      // Offline fallback: return from cache
      const raw = await getCacheItem(CACHE_KEYS.SAI_SONGS_CENTERS);
      if (raw) {
        try {
          const { centers } = JSON.parse(raw) as { timestamp: number; centers: Center[] };
          if (Array.isArray(centers)) {
            centersCache = centers;
            return centers;
          }
        } catch {
          // Ignore parse errors
        }
      }
      console.error('Failed to fetch centers:', error);
      return [];
    } finally {
      centersFetchPromise = null;
    }
  })();

  return centersFetchPromise;
};

/**
 * Displays center badges based on the provided center IDs
 * Fetches center details and renders them as colored badges
 */
export const CenterBadges: React.FC<CenterBadgesProps> = ({ 
  centerIds, 
  showAllIfEmpty = true,
  showWarningIfEmpty = false,
  publicLabel = 'Public Session'
}) => {
  const [centers, setCenters] = useState<Center[]>(centersCache || []);
  const [loading, setLoading] = useState(!centersCache);

  useEffect(() => {
    fetchCentersOnce().then(data => {
      setCenters(data);
      setLoading(false);
    });
  }, []);

  // If no center IDs are provided, show appropriate badge
  if (!centerIds || centerIds.length === 0) {
    if (!showAllIfEmpty) return null;
    
    if (showWarningIfEmpty) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded" title="No centers assigned - needs admin attention">
          ⚠️ No Centers
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
        🌐 {publicLabel}
      </span>
    );
  }

  if (loading) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
        Loading...
      </span>
    );
  }

  // Filter centers that match the provided IDs
  const selectedCenters = centers.filter(c => centerIds.includes(c.id));

  if (selectedCenters.length === 0) {
    return null;
  }

  return (
    <>
      {selectedCenters.map(center => (
        <span
          key={center.id}
          className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border-2"
          style={{ 
            backgroundColor: (center.badgeTextColor || '#1e40af') + '20',
            borderColor: center.badgeTextColor || '#1e40af',
            color: center.badgeTextColor || '#1e40af'
          }}
        >
          {center.name}
        </span>
      ))}
    </>
  );
};
