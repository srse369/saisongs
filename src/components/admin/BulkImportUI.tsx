import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import importService, { type ImportProgress, type ImportError } from '../../services/ImportService';
import { useSongs } from '../../contexts/SongContext';

/**
 * Props for the BulkImportUI component
 */
interface BulkImportUIProps {
  /** Whether the import UI modal is currently open */
  isOpen: boolean;
  /** Callback function when modal is closed */
  onClose: () => void;
}

/**
 * Possible states during the import process
 */
type ImportStatus = 'idle' | 'discovering' | 'importing' | 'completed' | 'error';

/**
 * Internal state for tracking import progress and errors
 */
interface ImportState {
  /** Current status of the import operation */
  status: ImportStatus;
  /** Progress statistics (total, processed, created, updated, failed) */
  progress: ImportProgress;
  /** List of errors encountered during import */
  errors: ImportError[];
  /** Critical error that stopped the import process */
  criticalError: string | null;
}

/**
 * Bulk Import UI component for importing songs from external sources
 * 
 * Provides a modal interface for the bulk import process with:
 * - Start Import button (idle state)
 * - Real-time progress bar and statistics
 * - Current song being processed indicator
 * - Completion summary with success/failure counts
 * - Collapsible error list for failed imports
 * - Automatic song list refresh after successful import
 * 
 * The component prevents closing during active import operations
 * and refreshes the song context after successful completion.
 * 
 * @component
 * @example
 * ```tsx
 * <BulkImportUI
 *   isOpen={isImportUIOpen}
 *   onClose={() => setIsImportUIOpen(false)}
 * />
 * ```
 */
export const BulkImportUI: React.FC<BulkImportUIProps> = ({ isOpen, onClose }) => {
  const { fetchSongs } = useSongs();
  
  const [importState, setImportState] = useState<ImportState>({
    status: 'idle',
    progress: {
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      currentSong: null,
    },
    errors: [],
    criticalError: null,
  });

  const [showErrors, setShowErrors] = useState(false);
  const [showManualImport, setShowManualImport] = useState(false);
  const [pastedJson, setPastedJson] = useState('');

  /**
   * Handles manual import from pasted JSON data
   */
  const handleManualImport = async (jsonData: string) => {
    try {
      // Clean the JSON data - remove any backticks, extra quotes, or whitespace
      let cleanedData = jsonData.trim();
      
      // Remove surrounding backticks if present
      if (cleanedData.startsWith('`') && cleanedData.endsWith('`')) {
        cleanedData = cleanedData.slice(1, -1);
      }
      
      // Remove surrounding quotes if present (only if the entire string is quoted)
      if ((cleanedData.startsWith('"') && cleanedData.endsWith('"')) ||
          (cleanedData.startsWith("'") && cleanedData.endsWith("'"))) {
        cleanedData = cleanedData.slice(1, -1);
        // If it was quoted, we need to unescape the content
        cleanedData = cleanedData.replace(/\\"/g, '"');
        cleanedData = cleanedData.replace(/\\n/g, '\n');
        cleanedData = cleanedData.replace(/\\r/g, '\r');
        cleanedData = cleanedData.replace(/\\t/g, '\t');
        cleanedData = cleanedData.replace(/\\\\/g, '\\');
      }
      
      // Try to parse the JSON data with better error handling
      let rawSongs;
      try {
        rawSongs = JSON.parse(cleanedData);
      } catch (parseError) {
        // If parsing fails, try to fix common issues
        console.error('Initial JSON parse failed:', parseError);
        
        // Remove any trailing commas before closing brackets
        cleanedData = cleanedData.replace(/,(\s*[}\]])/g, '$1');
        
        // Try parsing again
        try {
          rawSongs = JSON.parse(cleanedData);
        } catch (secondError) {
          // Provide the original error with context
          const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
          throw new Error(`JSON Parse Error: ${errorMsg}\n\nPlease ensure you copied the complete output from the console command.`);
        }
      }
      
      if (!Array.isArray(rawSongs)) {
        throw new Error('Invalid JSON format. Expected an array of songs.');
      }
      
      // Validate the structure
      if (rawSongs.length === 0) {
        throw new Error('No songs found in the JSON data.');
      }
      
      // Transform superSongJson format to our format
      // Each song in superSongJson has: song_id, lyrics, meaning, language, deity, tempo, beat, raga, level, songtags, audio_link, video_link, golden_voice, url
      const externalSourceUrl = import.meta.env.VITE_EXTERNAL_SOURCE_URL || 'https://localhost:3000';
      const songs = rawSongs.map((s: any) => ({
        name: s.name || 'Unknown',
        url: s.url ? `${externalSourceUrl}${s.url}` : `${externalSourceUrl}/node/${s.song_id}`,
        lyrics: s.lyrics,
        meaning: s.meaning,
        language: s.language,
        deity: s.deity,
        tempo: s.tempo,
        beat: s.beat,
        raga: s.raga,
        level: s.level,
        songtags: s.songtags,
        // Handle arrays - convert to comma-separated string or take first element
        audio_link: Array.isArray(s.audio_link) ? s.audio_link[0] : s.audio_link,
        video_link: Array.isArray(s.video_link) ? s.video_link[0] : s.video_link,
        golden_voice: Array.isArray(s.golden_voice) ? (s.golden_voice.length > 0 ? 'yes' : '') : s.golden_voice,
      }));
      
      // Validate that we have at least name and url
      const firstSong = songs[0];
      if (!firstSong.name || !firstSong.url) {
        throw new Error('Invalid song format. Each song must have "name" and "url" fields.');
      }
      
      // Hide manual import UI and start importing
      setShowManualImport(false);
      
      // Reset state and start import
      setImportState({
        status: 'importing',
        progress: {
          total: songs.length,
          processed: 0,
          created: 0,
          updated: 0,
          failed: 0,
          currentSong: null,
        },
        errors: [],
        criticalError: null,
      });
      
      // Import songs using the ImportService with the manual data
      const result = await importService.importManualSongs(songs, (progress) => {
        setImportState((prev) => ({
          ...prev,
          progress,
        }));
      });
      
      // Handle completion
      if (result.success) {
        setImportState((prev) => ({
          ...prev,
          status: 'completed',
          progress: result.stats,
          errors: result.errors,
        }));
        
        // Refresh song list after successful import (force network fetch)
        await fetchSongs(true);
      } else {
        // Critical error occurred
        setImportState((prev) => ({
          ...prev,
          status: 'error',
          criticalError: result.errors[0]?.error || 'Unknown error occurred',
          errors: result.errors,
        }));
      }
      
      // Clear the pasted JSON
      setPastedJson('');
      
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'Invalid JSON data';
      
      // Provide more helpful error message for JSON parsing errors
      if (errorMessage.includes('JSON')) {
        errorMessage = `JSON Parsing Error: ${errorMessage}\n\nTips:\n- Make sure you copied the entire output from the console\n- Check that the data starts with [ and ends with ]\n- Try copying the data again from the browser console`;
      }
      
      setImportState({
        status: 'error',
        progress: {
          total: 0,
          processed: 0,
          created: 0,
          updated: 0,
          failed: 0,
          currentSong: null,
        },
        errors: [],
        criticalError: errorMessage,
      });
    }
  };

  /**
   * Initiates the bulk import process
   * 
   * Resets state, calls ImportService with progress callback,
   * handles completion and errors, and refreshes song list on success
   */
  const handleStartImport = async () => {
    // Reset state and start import
    setImportState({
      status: 'importing',
      progress: {
        total: 0,
        processed: 0,
        created: 0,
        updated: 0,
        failed: 0,
        currentSong: null,
      },
      errors: [],
      criticalError: null,
    });

    try {
      // Call ImportService with progress callback
      const result = await importService.importAllSongs((progress) => {
        setImportState((prev) => ({
          ...prev,
          progress,
        }));
      });

      // Handle completion
      if (result.success) {
        setImportState((prev) => ({
          ...prev,
          status: 'completed',
          progress: result.stats,
          errors: result.errors,
        }));
        
        // Refresh song list after successful import (force network fetch)
        await fetchSongs(true);
      } else {
        // Critical error occurred
        setImportState((prev) => ({
          ...prev,
          status: 'error',
          criticalError: result.errors[0]?.error || 'Unknown error occurred',
          errors: result.errors,
        }));
      }
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setImportState((prev) => ({
        ...prev,
        status: 'error',
        criticalError: errorMessage,
      }));
    }
  };

  /**
   * Handles closing the import UI modal
   * 
   * Only allows closing when not actively importing.
   * Resets all state when closing.
   */
  const handleClose = () => {
    // Only allow closing when not importing
    if (importState.status !== 'importing') {
      // Reset state on close
      setImportState({
        status: 'idle',
        progress: {
          total: 0,
          processed: 0,
          created: 0,
          updated: 0,
          failed: 0,
          currentSong: null,
        },
        errors: [],
        criticalError: null,
      });
      setShowErrors(false);
      onClose();
    }
  };

  /**
   * Calculates the import progress percentage
   * 
   * @returns Progress percentage (0-100)
   */
  const calculatePercentage = () => {
    if (importState.progress.total === 0) return 0;
    return Math.round((importState.progress.processed / importState.progress.total) * 100);
  };

  const isImporting = importState.status === 'importing';
  const isCompleted = importState.status === 'completed';
  const hasError = importState.status === 'error';
  const hasErrors = importState.errors.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Songs">
      <div className="space-y-4">
        {/* Idle State - Start Import Button */}
        {importState.status === 'idle' && !showManualImport && (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Import all songs from external sources into the database.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleStartImport}
                className="px-6 py-3 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium"
              >
                Start Automatic Import
              </button>
              <div className="text-sm text-gray-500 dark:text-gray-400">or</div>
              <button
                onClick={() => setShowManualImport(true)}
                className="px-6 py-3 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium"
              >
                Manual Import (Paste JSON)
              </button>
            </div>
          </div>
        )}

        {/* Manual Import - Paste JSON */}
        {importState.status === 'idle' && showManualImport && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                Manual Import Instructions
              </h3>
              <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-2 list-decimal list-inside">
                <li>Open <a href={`${import.meta.env.VITE_EXTERNAL_SOURCE_URL || 'http://localhost'}/songs`} target="_blank" rel="noopener noreferrer" className="underline">{import.meta.env.VITE_EXTERNAL_SOURCE_URL || 'http://localhost'}/songs</a> in a new tab</li>
                <li>Wait for the page to fully load (you should see the song list)</li>
                <li>Open browser console (F12 or Cmd+Option+I on Mac)</li>
                <li>Copy and paste this command in the console and press Enter:
                  <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-blue-300 dark:border-blue-700 font-mono text-xs overflow-x-auto">
                    copy(JSON.stringify(window.superSongJson))
                  </div>
                </li>
                <li>You should see "undefined" in the console - this means the data was copied</li>
                <li>Paste the data (Cmd+V or Ctrl+V) in the textarea below</li>
                <li>Click "Import from JSON" button</li>
              </ol>
            </div>
            
            <div>
              <label htmlFor="json-paste" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Paste Song JSON Data:
              </label>
              <textarea
                id="json-paste"
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder='[{"name":"Song Name","url":"https://external-source/node/12345"},...]'
                className="w-full h-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowManualImport(false);
                  setPastedJson('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleManualImport(pastedJson)}
                disabled={!pastedJson.trim()}
                className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import from JSON
              </button>
            </div>
          </div>
        )}

        {/* Critical Error Display */}
        {hasError && importState.criticalError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                  Critical Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {importState.criticalError}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Display */}
        {(isImporting || isCompleted) && (
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Progress</span>
                <span>{calculatePercentage()}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${calculatePercentage()}%` }}
                />
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {importState.progress.processed}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Processed / {importState.progress.total}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {importState.progress.created}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Created</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {importState.progress.updated}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">Updated</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {importState.progress.failed}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">Failed</div>
              </div>
            </div>

            {/* Current Song Being Processed */}
            {isImporting && importState.progress.currentSong && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <span className="font-medium">Processing:</span> {importState.progress.currentSong}
                </p>
              </div>
            )}

            {/* Completion Summary */}
            {isCompleted && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-400">
                      Import Completed
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Successfully processed {importState.progress.processed} of{' '}
                      {importState.progress.total} songs.
                      {importState.progress.created > 0 && ` Created ${importState.progress.created} new songs.`}
                      {importState.progress.updated > 0 && ` Updated ${importState.progress.updated} existing songs.`}
                      {importState.progress.failed > 0 && ` ${importState.progress.failed} songs failed.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error List (Collapsible) */}
            {hasErrors && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Errors ({importState.errors.length})
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
                      showErrors ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {showErrors && (
                  <div className="max-h-60 overflow-y-auto">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {importState.errors.map((error, index) => (
                        <li key={index} className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {error.songName}
                          </p>
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            {error.error}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Close Button */}
        {(isCompleted || hasError) && (
          <div className="flex justify-end pt-4">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Importing State - Disable Close */}
        {isImporting && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            Import in progress... Please do not close this window.
          </div>
        )}
      </div>
    </Modal>
  );
};
