import { useState, useEffect } from 'react';
import type { ExternalSongsData } from '../types';
import { externalsongsService } from '../services/ExternalSongsService';

/**
 * Hook to fetch and cache all song data from ExternalSongs.org
 * @param externalsongsUrl - The ExternalSongs.org URL to fetch data from
 * @returns Object containing song data, loading state, and error
 */
export function useExternalSongsData(externalsongsUrl?: string) {
  const [data, setData] = useState<ExternalSongsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!externalsongsUrl) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const songData = await externalsongsService.fetchSongData(externalsongsUrl);
        
        if (isMounted) {
          setData(songData);
          if (!songData) {
            setError('Unable to fetch song data from ExternalSongs.org');
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
  }, [externalsongsUrl]);

  return { data, isLoading, error };
}
