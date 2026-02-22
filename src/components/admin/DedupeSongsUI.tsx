import React, { useState, useCallback } from 'react';
import { useSongs } from '../../contexts/SongContext';
import songService from '../../services/SongService';
import { findSimilarSongPairs, calculateBodySimilarity } from '../../utils/songMatcher';
import type { Song } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';

type DedupeStatus = 'idle' | 'scanning' | 'filtering' | 'ready' | 'merging' | 'completed' | 'error';

interface SimilarPair {
  song1: Song;
  song2: Song;
  similarity: number;
  bodySimilarity?: number;
}

export const DedupeSongsUI: React.FC = () => {
  const { songs, fetchSongs, loading: songsLoading } = useSongs();
  const toast = useToast();
  const [status, setStatus] = useState<DedupeStatus>('idle');
  const [pairs, setPairs] = useState<SimilarPair[]>([]);
  const [threshold, setThreshold] = useState(85);
  const [error, setError] = useState<string | null>(null);
  const [mergedCount, setMergedCount] = useState(0);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);

  const handleScan = useCallback(async () => {
    if (songs.length < 2) {
      setError('Need at least 2 songs to scan for duplicates.');
      return;
    }
    setStatus('scanning');
    setError(null);
    setPairs([]);
    const total = (songs.length * (songs.length - 1)) / 2;
    setScanProgress({ current: 0, total });
    try {
      // Run in chunks to avoid blocking UI
      await new Promise((r) => setTimeout(r, 50));
      const found = await findSimilarSongPairs(songs, threshold, (current, tot) => {
        setScanProgress({ current, total: tot });
      });
      setScanProgress(null);

      if (found.length === 0) {
        setPairs([]);
        setStatus('ready');
        toast.success('No similar song pairs found.');
        return;
      }

      // Filter by body similarity: fetch lyrics and keep only pairs with body >= 50% similar
      setStatus('filtering');
      const uniqueIds = [...new Set(found.flatMap((p) => [p.song1.id, p.song2.id]))];
      const songsWithLyrics = await songService.getSongsWithLyrics(uniqueIds);
      const lyricsMap = new Map(songsWithLyrics.map((s) => [s.id, s]));

      const BODY_THRESHOLD = 50;
      const filtered: SimilarPair[] = [];
      for (const pair of found) {
        const s1 = lyricsMap.get(pair.song1.id);
        const s2 = lyricsMap.get(pair.song2.id);
        const body1 = (s1?.lyrics ?? '').trim();
        const body2 = (s2?.lyrics ?? '').trim();
        if (!body1 || !body2) continue; // Skip pairs without lyrics
        const bodySim = calculateBodySimilarity(body1, body2);
        if (bodySim >= BODY_THRESHOLD) {
          filtered.push({ ...pair, bodySimilarity: bodySim });
        }
      }

      setPairs(filtered);
      setStatus('ready');
      if (filtered.length === 0) {
        toast.success('No pairs with similar lyrics (≥50%) found.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setStatus('error');
      setScanProgress(null);
    } finally {
      setScanProgress(null);
    }
  }, [songs, threshold, toast]);

  const handleMerge = useCallback(
    async (targetSong: Song, duplicateSong: Song) => {
      setStatus('merging');
      setError(null);
      try {
        await songService.mergeSongs(targetSong.id, duplicateSong.id);
        setPairs((prev) =>
          prev.filter(
            (p) =>
              !(p.song1.id === duplicateSong.id || p.song2.id === duplicateSong.id)
          )
        );
        setMergedCount((c) => c + 1);
        await fetchSongs(true);
        setStatus('ready');
        toast.success(`Merged "${duplicateSong.name}" into "${targetSong.name}"`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Merge failed');
        setStatus('ready');
        toast.error('Failed to merge songs');
      }
    },
    [fetchSongs, toast]
  );

  const handleKeepFirst = (pair: SimilarPair) => {
    handleMerge(pair.song1, pair.song2);
  };

  const handleKeepSecond = (pair: SimilarPair) => {
    handleMerge(pair.song2, pair.song1);
  };

  const scanPercent = scanProgress && scanProgress.total > 0
    ? Math.round((scanProgress.current / scanProgress.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Loading songs */}
      {songsLoading && songs.length === 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-3">
            <LoadingSpinner size="sm" />
            <span className="text-sm text-blue-800 dark:text-blue-200">Loading songs...</span>
          </div>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
          Deduplicate Similar Songs
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
          Find and merge songs that look similar (e.g. &quot;Om Sai Ram&quot; vs &quot;Om Sai Rama&quot;).
          Pairs must match by name and have lyrics at least 50% similar. For each pair, choose which song to keep. The other will be merged into it (pitches, sessions, and mappings transfer) and then deleted.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="threshold" className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Similarity threshold:
            </label>
            <select
              id="threshold"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              disabled={status === 'scanning' || status === 'filtering'}
              className="px-2 py-1 border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-blue-900 dark:text-blue-100 text-sm"
            >
              <option value={80}>80%</option>
              <option value={85}>85%</option>
              <option value={90}>90%</option>
              <option value={95}>95%</option>
            </select>
          </div>
          <button
            onClick={handleScan}
            disabled={status === 'scanning' || status === 'filtering' || songs.length < 2}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {status === 'scanning' || status === 'filtering' ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                {status === 'filtering' ? 'Checking lyrics...' : 'Scanning...'}
              </>
            ) : (
              'Find Similar Songs'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Filtering progress */}
      {status === 'filtering' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
          <LoadingSpinner size="sm" />
          <span className="text-sm text-blue-800 dark:text-blue-200">Checking lyrics (body similarity ≥50%)...</span>
        </div>
      )}

      {/* Scan progress */}
      {status === 'scanning' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-sm text-blue-800 dark:text-blue-200">
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Comparing {songs.length} songs...
            </span>
            <span className="font-medium">{scanPercent}%</span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-150"
              style={{ width: `${scanPercent}%` }}
            />
          </div>
          {scanProgress && (
            <p className="text-xs text-blue-600 dark:text-blue-300">
              {scanProgress.current.toLocaleString()} of {scanProgress.total.toLocaleString()} comparisons
            </p>
          )}
        </div>
      )}

      {/* Merging progress */}
      {status === 'merging' && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
          <LoadingSpinner size="sm" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Merging songs...</span>
        </div>
      )}

      {status === 'ready' && pairs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {pairs.length} similar pair{pairs.length !== 1 ? 's' : ''} found
              {mergedCount > 0 && ` (${mergedCount} merged)`}
            </h4>
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {pairs.map((pair, idx) => (
              <div
                key={`${pair.song1.id}-${pair.song2.id}`}
                className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {pair.song1.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({pair.song1.pitchCount ?? 0} pitch{pair.song1.pitchCount !== 1 ? 'es' : ''})
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    vs {pair.song2.name}
                    <span className="text-xs ml-1">
                      ({pair.song2.pitchCount ?? 0} pitch{pair.song2.pitchCount !== 1 ? 'es' : ''})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-sm font-medium px-2 py-0.5 rounded ${
                      pair.similarity >= 95
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        : pair.similarity >= 90
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                    }`}
                    title="Name similarity"
                  >
                    {pair.similarity}%
                  </span>
                  {pair.bodySimilarity != null && (
                    <span
                      className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      title="Body/lyrics similarity"
                    >
                      body {pair.bodySimilarity}%
                    </span>
                  )}
                  <button
                    onClick={() => handleKeepFirst(pair)}
                    disabled={status === 'merging'}
                    className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    title={`Keep "${pair.song1.name}"`}
                  >
                    Keep first
                  </button>
                  <button
                    onClick={() => handleKeepSecond(pair)}
                    disabled={status === 'merging'}
                    className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    title={`Keep "${pair.song2.name}"`}
                  >
                    Keep second
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'ready' && pairs.length === 0 && !error && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center text-gray-600 dark:text-gray-400">
          No similar song pairs to merge (name match + lyrics ≥50%). Try a lower name threshold.
        </div>
      )}
    </div>
  );
};
