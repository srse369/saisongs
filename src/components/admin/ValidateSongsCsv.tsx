import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useSongs } from '../../contexts/SongContext';
import { parseSongsCsv, type SongsCsvRow } from '../../utils/songsCsvParser';
import { calculateBodySimilarity, normalizeSongNameForMapping } from '../../utils/songMatcher';
import { parsePitchesCsvSongNames, parsePitchesCsvSongNameCounts } from '../../utils/pitchesCsvUtils';
import { takeOfflineIfNeeded } from '../../utils/offlineDownload';
import { getSongsFromCache } from '../../utils/cacheUtils';
import type { Song } from '../../types';
import { Modal } from '../common/Modal';

type MatchStatus = 'found' | 'potential' | 'missing';

interface MatchCandidate {
  song: Song;
  similarity: number;
  lyrics: string;
}

interface ValidationResult {
  csvRow: SongsCsvRow;
  status: MatchStatus;
  dbSong?: Song;
  dbLyrics?: string;
  nameSimilarity?: number;
  bodySimilarity?: number;
  topMatches: MatchCandidate[];
}

const BODY_MATCH_THRESHOLD = 60;
const AUTO_ACCEPT_THRESHOLD = 75;
const TOP_MATCHES_PER_ROW = 5;

function getMatchPercentColorClass(pct: number): string {
  if (pct > 66) return 'text-green-600 dark:text-green-400';
  if (pct >= 50) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

type ReviewDecision = 'accepted' | 'rejected';

export const ValidateSongsCsv: React.FC = () => {
  const { songs, getSongById, fetchSongs, createSong } = useSongs();
  const [isDragging, setIsDragging] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult[] | null>(null);
  const [totalCsvRowsInFile, setTotalCsvRowsInFile] = useState<number | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [matchIndexByRow, setMatchIndexByRow] = useState<Map<number, number>>(new Map());
  const [decisions, setDecisions] = useState<Map<number, ReviewDecision>>(new Map());
  const [addPromptForRow, setAddPromptForRow] = useState<number | null>(null);
  const [reviewComplete, setReviewComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pitchesFileName, setPitchesFileName] = useState<string | null>(null);
  const [songsCsvContent, setSongsCsvContent] = useState<string | null>(null);
  const [pitchesCsvContent, setPitchesCsvContent] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [addingSongs, setAddingSongs] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0, currentSong: 0, totalSongs: 0, phase: 'cache' as 'cache' | 'title' | 'body', message: '' as string });
  const [comparisonItem, setComparisonItem] = useState<ValidationResult | null>(null);
  const [comparisonSong, setComparisonSong] = useState<Song | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const validationContextRef = useRef<{
    rowsWithBody: SongsCsvRow[];
    lyricsBySongId: Map<string, string>;
    songsToUse: Song[];
    allRows: SongsCsvRow[];
    nextRowIndex?: number;
    previousResults?: ValidationResult[];
  } | null>(null);

  const validateNextRowsRef = useRef<((startIdx: number, previousResults: ValidationResult[]) => Promise<void>) | null>(null);

  const runValidation = useCallback(
    async (csvText: string, pitchesCsvText?: string | null) => {
      setError(null);
      setValidationResult(null);
      setTotalCsvRowsInFile(null);
      setValidating(true);

      try {
        const allRows = parseSongsCsv(csvText);
        let rowsWithBody = allRows.filter((r) => r.songBody?.trim());

        if (pitchesCsvText?.trim()) {
          const songNamesWithPitches = parsePitchesCsvSongNames(pitchesCsvText);
          if (songNamesWithPitches.size > 0) {
            rowsWithBody = rowsWithBody.filter((r) =>
              songNamesWithPitches.has(normalizeSongNameForMapping(r.songTitle))
            );
          }
        }

        if (rowsWithBody.length === 0) {
          setError(
            pitchesCsvText?.trim()
              ? 'No songs with body found that have at least one pitch in the pitches CSV.'
              : 'No rows with song body found. Add a song body column and body text for body-only comparison.'
          );
          setValidating(false);
          return;
        }

        setProgress({ current: 0, total: 1, phase: 'cache', message: 'Ensuring offline data...' });
        const { skipped } = await takeOfflineIfNeeded((offlineProgress) => {
          setProgress((p) => ({ ...p, message: offlineProgress.message }));
        });
        if (!skipped) {
          fetchSongs(false);
        }

        const cachedSongs = await getSongsFromCache();
        const songsToUse: Song[] = (cachedSongs && cachedSongs.length > 0 ? cachedSongs : songs) as Song[];

        setProgress({ current: 0, total: songsToUse.length, currentSong: 0, totalSongs: songsToUse.length, phase: 'body', message: 'Loading lyrics...' });
        const lyricsBySongId = new Map<string, string>();
        for (let songIdx = 0; songIdx < songsToUse.length; songIdx++) {
          const song = songsToUse[songIdx];
          const lyrics = song.lyrics ?? (await getSongById(song.id))?.lyrics ?? '';
          lyricsBySongId.set(song.id, lyrics);
          if (songIdx % 25 === 0) {
            setProgress({ current: songIdx, total: songsToUse.length, currentSong: songIdx, totalSongs: songsToUse.length, phase: 'body', message: `Loading lyrics... ${songIdx + 1}/${songsToUse.length}` });
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        validationContextRef.current = {
          rowsWithBody,
          lyricsBySongId,
          songsToUse,
          allRows,
        };
        setTotalCsvRowsInFile(allRows.filter((r) => r.songBody?.trim()).length);
        setReviewIndex(0);
        setMatchIndexByRow(new Map());
        setDecisions(new Map());
        setAddPromptForRow(null);

        const validateNextRows = async (startIdx: number, previousResults: ValidationResult[] = []) => {
          const ctx = validationContextRef.current;
          if (!ctx) return;
          const { rowsWithBody: rwb, lyricsBySongId: lyr, songsToUse: stu } = ctx;
          const totalSongs = stu.length;
          const results = [...previousResults];

          for (let rowIdx = startIdx; rowIdx < rwb.length; rowIdx++) {
            const csvRow = rwb[rowIdx];
            const candidates: MatchCandidate[] = [];

            for (let songIdx = 0; songIdx < stu.length; songIdx++) {
              const song = stu[songIdx];
              setProgress({ current: rowIdx, total: rwb.length, currentSong: songIdx, totalSongs, phase: 'body', message: '' });

              const lyrics = lyr.get(song.id) ?? '';
              if (lyrics) {
                const dbText = [song.name, lyrics].filter(Boolean).join('\n');
                const sim = calculateBodySimilarity(csvRow.songBody!.trim(), dbText);
                if (sim > 0) {
                  candidates.push({ song, similarity: sim, lyrics });
                }
              }

              if (songIdx % 50 === 0) {
                await new Promise((r) => setTimeout(r, 0));
              }
            }

            candidates.sort((a, b) => b.similarity - a.similarity);
            const topMatches = candidates.slice(0, TOP_MATCHES_PER_ROW);
            const best = topMatches[0];
            const status: MatchStatus = best && best.similarity >= BODY_MATCH_THRESHOLD
              ? (best.similarity >= 75 ? 'found' : 'potential')
              : 'missing';

            const needsReview = !best || best.similarity < AUTO_ACCEPT_THRESHOLD;
            const item: ValidationResult = {
              csvRow,
              status,
              dbSong: best?.song,
              dbLyrics: best?.lyrics,
              bodySimilarity: best?.similarity,
              topMatches,
            };

            results.push(item);
            setValidationResult([...results]);

            if (needsReview) {
              setDecisions((prev) => {
                const next = new Map(prev ?? []);
                results.forEach((r, i) => {
                  const b = r.topMatches?.[0];
                  if (b && b.similarity >= AUTO_ACCEPT_THRESHOLD) next.set(i, 'accepted');
                });
                return next;
              });
              setValidating(false);
              setProgress({ current: 0, total: 0, currentSong: 0, totalSongs: 0, phase: 'body', message: '' });
              validationContextRef.current = { ...ctx, nextRowIndex: rowIdx + 1, previousResults: results };
              return;
            }

            setDecisions((prev) => {
              const next = new Map(prev ?? []);
              next.set(results.length - 1, 'accepted');
              return next;
            });
            await new Promise((r) => setTimeout(r, 0));
          }

          const autoAccepted = new Map<number, ReviewDecision>();
          results.forEach((_, i) => autoAccepted.set(i, 'accepted'));
          setDecisions(autoAccepted);
          setReviewComplete(true);
          setValidating(false);
          setProgress({ current: 0, total: 0, currentSong: 0, totalSongs: 0, phase: 'body', message: '' });
          validationContextRef.current = null;
        };

        validateNextRowsRef.current = validateNextRows;
        await validateNextRows(0, []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV');
      } finally {
        setValidating(false);
        setProgress({ current: 0, total: 0, currentSong: 0, totalSongs: 0, phase: 'body', message: '' });
      }
    },
    [songs, getSongById, fetchSongs]
  );

  const continueValidation = useCallback(() => {
    const ctx = validationContextRef.current;
    const fn = validateNextRowsRef.current;
    if (ctx?.nextRowIndex != null && ctx.previousResults && fn) {
      setValidating(true);
      setAddPromptForRow(null);
      fn(ctx.nextRowIndex, ctx.previousResults);
    }
  }, []);

  const handleSongsFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a CSV file.');
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setSongsCsvContent(text);
        runValidation(text, pitchesCsvContent);
      };
      reader.onerror = () => setError('Failed to read file.');
      reader.readAsText(file, 'UTF-8');
    },
    [runValidation, pitchesCsvContent]
  );

  const handlePitchesFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a CSV file.');
        return;
      }
      setPitchesFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setPitchesCsvContent(text);
        if (songsCsvContent) runValidation(songsCsvContent, text);
      };
      reader.onerror = () => setError('Failed to read file.');
      reader.readAsText(file, 'UTF-8');
    },
    [runValidation, songsCsvContent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleSongsFile(file);
    },
    [handleSongsFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleSongsFile(file);
      e.target.value = '';
    },
    [handleSongsFile]
  );

  const handlePitchesFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handlePitchesFile(file);
      e.target.value = '';
    },
    [handlePitchesFile]
  );

  const handleReset = useCallback(() => {
    validationContextRef.current = null;
    validateNextRowsRef.current = null;
    setValidationResult(null);
    setTotalCsvRowsInFile(null);
    setReviewIndex(0);
    setMatchIndexByRow(new Map());
    setDecisions(new Map());
    setAddPromptForRow(null);
    setReviewComplete(false);
    setError(null);
    setFileName(null);
    setPitchesFileName(null);
    setSongsCsvContent(null);
    setPitchesCsvContent(null);
    setComparisonItem(null);
    setComparisonSong(null);
    setSelectedToAdd(new Set());
  }, []);

  const pitchesCountBySong = useMemo(
    () => (pitchesCsvContent?.trim() ? parsePitchesCsvSongNameCounts(pitchesCsvContent) : new Map<string, number>()),
    [pitchesCsvContent]
  );

  const rowsNeedingReview = useMemo(
    () =>
      validationResult?.map((r, i) => i).filter((i) => {
        if (decisions.has(i)) return false;
        const best = validationResult[i].topMatches?.[0];
        return !best || best.similarity < AUTO_ACCEPT_THRESHOLD;
      }) ?? [],
    [validationResult, decisions]
  );
  const totalToReview = rowsNeedingReview.length;
  const rowIdx = rowsNeedingReview[reviewIndex] ?? -1;
  const currentItem = validationResult?.[rowIdx];
  const matchIndex = matchIndexByRow.get(rowIdx) ?? 0;
  const currentMatch = currentItem?.topMatches?.[matchIndex];
  const acceptedCount = Array.from(decisions.values()).filter((d) => d === 'accepted').length;
  const rejectedCount = Array.from(decisions.values()).filter((d) => d === 'rejected').length;
  const rejectedWithIndices = validationResult?.map((r, i) => ({ item: r, index: i })).filter(({ index }) => decisions.get(index) === 'rejected') ?? [];

  const handleAccept = useCallback(() => {
    setDecisions((prev) => new Map(prev).set(rowIdx, 'accepted'));
    setAddPromptForRow(null);
    continueValidation();
  }, [rowIdx, continueValidation]);

  const handleReject = useCallback(() => {
    const item = validationResult?.[rowIdx];
    const topMatches = item?.topMatches ?? [];
    if (matchIndex < topMatches.length - 1) {
      setMatchIndexByRow((prev) => new Map(prev).set(rowIdx, matchIndex + 1));
    } else {
      setDecisions((prev) => new Map(prev).set(rowIdx, 'rejected'));
      setAddPromptForRow(rowIdx);
    }
  }, [rowIdx, matchIndex, validationResult]);

  const handleAddPromptAdd = useCallback(async () => {
    const item = validationResult?.[addPromptForRow!];
    if (!item) return;
    setAddingSongs(true);
    setError(null);
    try {
      const input = {
        name: item.csvRow.songTitle.trim(),
        externalSourceUrl: '',
        lyrics: item.csvRow.songBody?.trim() ?? '',
        meaning: item.csvRow.translation?.trim() || undefined,
        language: 'Telugu',
        deity: item.csvRow.deity?.trim() || 'Sai Baba',
        songTags: item.csvRow.keywords?.trim() || undefined,
      };
      await createSong(input);
      setDecisions((prev) => new Map(prev).set(addPromptForRow!, 'accepted'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add song');
    } finally {
      setAddingSongs(false);
    }
    setAddPromptForRow(null);
    continueValidation();
  }, [addPromptForRow, validationResult, createSong, continueValidation]);

  const handleAddPromptSkip = useCallback(() => {
    setAddPromptForRow(null);
    continueValidation();
  }, [continueValidation]);

  const handleToggleAddSelection = useCallback((idx: number) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleAddSelectedToDb = useCallback(async () => {
    const toAdd = validationResult?.filter((_, i) => selectedToAdd.has(i)) ?? [];
    if (toAdd.length === 0) return;
    setAddingSongs(true);
    setError(null);
    try {
      for (const item of toAdd) {
        const input = {
          name: item.csvRow.songTitle.trim(),
          externalSourceUrl: '',
          lyrics: item.csvRow.songBody?.trim() ?? '',
          meaning: item.csvRow.translation?.trim() || undefined,
          language: 'Telugu',
          deity: item.csvRow.deity?.trim() || 'Sai Baba',
          songTags: item.csvRow.keywords?.trim() || undefined,
        };
        await createSong(input);
      }
      setError(null);
      handleReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add songs');
    } finally {
      setAddingSongs(false);
    }
  }, [validationResult, selectedToAdd, createSong, handleReset]);

  const handleViewComparison = useCallback(
    async (item: ValidationResult) => {
      if (!item.dbSong) return;
      setComparisonItem(item);
      setComparisonSong(null);
      setLoadingComparison(true);
      try {
        const fullSong = await getSongById(item.dbSong.id);
        setComparisonSong(fullSong || null);
      } catch {
        setComparisonSong(null);
      } finally {
        setLoadingComparison(false);
      }
    },
    [getSongById]
  );

  const bodySimilarity =
    comparisonItem && comparisonSong && comparisonItem.csvRow.songBody
      ? calculateBodySimilarity(
          comparisonItem.csvRow.songBody,
          [comparisonSong.name, comparisonSong.lyrics || ''].filter(Boolean).join('\n')
        )
      : null;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
        <h3 className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-2">
          Validate Songs CSV
        </h3>
        <p className="text-sm text-amber-800 dark:text-amber-400">
          Upload a CSV with columns: <strong>song title</strong> (required), song body, translation, deity, keywords.
          Validates all rows with body. With a pitches CSV, only songs that have at least one pitch are validated. Review each song one by one — accept or reject the suggested match.
          At the end, optionally add rejected songs to the database.
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-500 mt-2">
          <strong>Optional:</strong> Upload a pitches CSV (Song Name, Singer, Pitch) to validate only songs that have at least one pitch.
        </p>
      </div>

      <div
        onDrop={validating ? undefined : handleDrop}
        onDragOver={validating ? undefined : handleDragOver}
        onDragLeave={validating ? undefined : handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          validating
            ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 opacity-75'
            : isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
          id="validate-csv-input"
          disabled={validating}
        />
        <label
          htmlFor="validate-csv-input"
          className={`flex flex-col items-center gap-2 ${validating ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
        >
          <i className="fas fa-file-csv text-3xl text-gray-500 dark:text-gray-400"></i>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Drop CSV file here or click to browse
          </span>
          {fileName && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{fileName}</span>
          )}
        </label>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Optional: Pitches CSV (filter to songs with at least one pitch)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv"
              onChange={handlePitchesFileInput}
              className="hidden"
              id="validate-pitches-csv-input"
              disabled={validating}
            />
            <label
              htmlFor="validate-pitches-csv-input"
              className={`text-sm px-3 py-1.5 rounded border cursor-pointer ${validating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} border-gray-300 dark:border-gray-600`}
            >
              {pitchesFileName || 'Choose pitches CSV'}
            </label>
            {pitchesFileName && (
              <button
                type="button"
                onClick={() => { setPitchesFileName(null); setPitchesCsvContent(null); if (songsCsvContent) runValidation(songsCsvContent, null); }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {validating && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md space-y-3">
          <div className="flex items-center gap-2">
            <i className="fas fa-spinner fa-spin text-blue-600 dark:text-blue-400"></i>
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {progress.phase === 'cache'
                ? (progress.message || 'Ensuring offline data...')
                : `Row ${progress.current + 1} of ${progress.total}, song ${progress.currentSong + 1} of ${progress.totalSongs}`}
            </span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-200"
              style={{
                width: progress.totalSongs > 0 && progress.total > 0
                  ? `${((progress.current * progress.totalSongs + progress.currentSong) / (progress.total * progress.totalSongs)) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {validationResult && !validating && (
        <div className="space-y-4">
          {!reviewComplete ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {addPromptForRow !== null
                    ? 'Add song to database?'
                    : `Review match ${reviewIndex + 1} of ${totalToReview}`}
                </h3>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm text-blue-600 dark:text-blue-400"
                >
                  Cancel
                </button>
              </div>

              {addPromptForRow !== null && validationResult?.[addPromptForRow] ? (
                <div className="border border-amber-200 dark:border-amber-800 rounded-md overflow-hidden bg-amber-50 dark:bg-amber-900/20 p-4">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-2">
                    No more matches for &quot;{validationResult[addPromptForRow].csvRow.songTitle}&quot;
                    {pitchesCountBySong.size > 0 && (
                      <span className="ml-1.5 text-amber-700 dark:text-amber-400 font-normal">
                        ({pitchesCountBySong.get(normalizeSongNameForMapping(validationResult[addPromptForRow].csvRow.songTitle)) ?? 0} pitch{(pitchesCountBySong.get(normalizeSongNameForMapping(validationResult[addPromptForRow].csvRow.songTitle)) ?? 0) !== 1 ? 'es' : ''} in pitches CSV)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-400 mb-4">
                    Add this song to the database?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddPromptAdd}
                      disabled={addingSongs}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                    >
                      {addingSongs ? 'Adding...' : 'Add to database'}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPromptSkip}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : currentItem && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  <div className="grid grid-cols-2 gap-4 p-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">CSV</h4>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {currentItem.csvRow.songTitle}
                        {pitchesCountBySong.size > 0 && (
                          <span className="ml-1.5 text-gray-600 dark:text-gray-400 font-normal">
                            ({pitchesCountBySong.get(normalizeSongNameForMapping(currentItem.csvRow.songTitle)) ?? 0} pitch{(pitchesCountBySong.get(normalizeSongNameForMapping(currentItem.csvRow.songTitle)) ?? 0) !== 1 ? 'es' : ''} in pitches CSV)
                          </span>
                        )}
                      </p>
                      {currentItem.csvRow.songBody && (
                        <pre className="mt-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                          {currentItem.csvRow.songBody}
                        </pre>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                        Potential match {currentMatch ? (
                          <>({matchIndex + 1} of {currentItem.topMatches.length}, <span className={getMatchPercentColorClass(currentMatch.similarity)}>{currentMatch.similarity}%</span> body)</>
                        ) : '(none)'}
                      </h4>
                      {currentMatch ? (
                        <>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {currentMatch.song.name}
                            <span className="ml-1.5 text-gray-600 dark:text-gray-400 font-normal">
                              ({(currentMatch.song.pitchCount ?? 0)} pitch{(currentMatch.song.pitchCount ?? 0) !== 1 ? 'es' : ''} in DB)
                            </span>
                          </p>
                          <pre className="mt-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                            {currentMatch.lyrics}
                          </pre>
                        </>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-2">No matches found</p>
                          <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">Add this song to the database?</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setAddPromptForRow(rowIdx)}
                              disabled={addingSongs}
                              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded"
                            >
                              Add to database
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDecisions((prev) => new Map(prev).set(rowIdx, 'rejected')); handleAddPromptSkip(); }}
                              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded"
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {currentMatch && (
                    <div className="flex justify-between gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
                          disabled={reviewIndex === 0}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded disabled:opacity-50"
                        >
                          Previous
                        </button>
                        {reviewIndex < totalToReview - 1 && (
                          <button
                            type="button"
                            onClick={() => setReviewIndex((i) => Math.min(totalToReview - 1, i + 1))}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded"
                          >
                            Next
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAccept}
                          className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded"
                        >
                          Accept match
                        </button>
                        <button
                          type="button"
                          onClick={handleReject}
                          className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Review complete
                </h3>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm text-blue-600 dark:text-blue-400"
                >
                  Validate another file
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{validationResult?.length ?? 0}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total validated</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                  <div className="text-xl font-bold text-green-700 dark:text-green-400">{acceptedCount}</div>
                  <div className="text-xs text-green-600 dark:text-green-400">Accepted</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  <div className="text-xl font-bold text-red-700 dark:text-red-400">{rejectedCount}</div>
                  <div className="text-xs text-red-600 dark:text-red-400">Rejected</div>
                </div>
              </div>

              {rejectedWithIndices.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Add rejected songs to database (select which to add)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedToAdd.size === rejectedWithIndices.length) {
                          setSelectedToAdd(new Set());
                        } else {
                          setSelectedToAdd(new Set(rejectedWithIndices.map(({ index }) => index)));
                        }
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400"
                    >
                      {selectedToAdd.size === rejectedWithIndices.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {rejectedWithIndices.map(({ item, index }) => (
                        <li key={index} className="px-4 py-2 flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedToAdd.has(index)}
                            onChange={() => handleToggleAddSelection(index)}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                            {item.csvRow.songTitle}
                            {pitchesCountBySong.size > 0 && (
                              <span className="ml-1 text-gray-500 dark:text-gray-400">
                                ({pitchesCountBySong.get(normalizeSongNameForMapping(item.csvRow.songTitle)) ?? 0} pitch{(pitchesCountBySong.get(normalizeSongNameForMapping(item.csvRow.songTitle)) ?? 0) !== 1 ? 'es' : ''})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600">
                    <button
                      type="button"
                      onClick={handleAddSelectedToDb}
                      disabled={selectedToAdd.size === 0 || addingSongs}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingSongs ? 'Adding...' : `Add ${selectedToAdd.size} selected`}
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="ml-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={!!comparisonItem}
        onClose={() => { setComparisonItem(null); setComparisonSong(null); }}
        title="Compare side by side"
      >
        {comparisonItem && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              {bodySimilarity !== null && (
                <span className="text-gray-600 dark:text-gray-400">
                  Body similarity: <strong className={getMatchPercentColorClass(bodySimilarity)}>{bodySimilarity}%</strong>
                  {bodySimilarity >= BODY_MATCH_THRESHOLD && (
                    <span className="ml-1 text-green-600 dark:text-green-400">(likely same)</span>
                  )}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">CSV</h4>
                <div className="border border-gray-200 dark:border-gray-600 rounded p-3 bg-gray-50 dark:bg-gray-800 max-h-64 overflow-y-auto">
                  <p className="font-medium text-gray-900 dark:text-white">{comparisonItem.csvRow.songTitle}</p>
                  {comparisonItem.csvRow.songBody && (
                    <pre className="mt-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                      {comparisonItem.csvRow.songBody}
                    </pre>
                  )}
                  {!comparisonItem.csvRow.songBody && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">No body in CSV</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Database</h4>
                <div className="border border-gray-200 dark:border-gray-600 rounded p-3 bg-gray-50 dark:bg-gray-800 max-h-64 overflow-y-auto">
                  {loadingComparison ? (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <i className="fas fa-spinner fa-spin"></i>
                      Loading...
                    </div>
                  ) : comparisonSong ? (
                    <>
                      <p className="font-medium text-gray-900 dark:text-white">{comparisonSong.name}</p>
                      {comparisonSong.lyrics ? (
                        <pre className="mt-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                          {comparisonSong.lyrics}
                        </pre>
                      ) : (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">No lyrics in database</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Could not load song</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
