import { useState, useEffect } from 'react';
import type { SairhythmsData } from '../types';
import { sairhythmsService } from '../services/SairhythmsService';

/**
 * Hook to fetch and cache all song data from Sairhythms.org
 * @param sairhythmsUrl - The Sairhythms.org URL to fetch data from
 * @returns Object containing song data, loading state, and error
 */
export function useSairhythmsData(sairhythmsUrl?: string) {
  const [data, setData] = useState<SairhythmsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sairhythmsUrl) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const songData = await sairhythmsService.fetchSongData(sairhythmsUrl);
        
        if (isMounted) {
          setData(songData);
          if (!songData) {
            setError('Unable to fetch song data from Sairhythms.org');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to fetch song data');
          setData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [sairhythmsUrl]);

  return { data, isLoading, error };
}

// Keep the old name for backwards compatibility
export const useSairhythmsMetadata = useSairhythmsData;
