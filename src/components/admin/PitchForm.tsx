import React, { useState, useEffect, useMemo } from 'react';
import type { SongSingerPitch, CreatePitchInput, Song, Singer } from '../../types';
import { ALL_PITCH_OPTIONS, formatPitchWithName } from '../../utils/pitchUtils';
import { formatNormalizedPitch, normalizePitch } from '../../utils/pitchNormalization';
import { useAuth } from '../../contexts/AuthContext';
import { fetchCentersOnce } from '../common/CenterBadges';

interface PitchFormProps {
  pitch?: SongSingerPitch | null;
  songs: Song[];
  singers: Singer[];
  onSubmit: (input: CreatePitchInput) => Promise<void>;
  onCancel: () => void;
  onUnsavedChangesRef?: React.MutableRefObject<(() => boolean) | null>;
  userSingerId?: string; // Current user's singer ID if they have a profile
  defaultSongId?: string; // Default song ID from filter (if any)
  defaultSingerId?: string; // Default singer ID from filter (if any)
}

export const PitchForm: React.FC<PitchFormProps> = ({
  pitch,
  songs,
  singers,
  onSubmit,
  onCancel,
  onUnsavedChangesRef,
  userSingerId,
  defaultSongId,
  defaultSingerId
}) => {
  const { isEditor } = useAuth();
  const [songId, setSongId] = useState('');
  const [singerId, setSingerId] = useState('');
  const [pitchValue, setPitchValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [centers, setCenters] = useState<Array<{ id: number; name: string }>>([]);

  // Check if user is editing mode or creating for themselves
  const isEditMode = !!pitch;
  const isViewerCreatingForSelf = !isEditor && !!userSingerId && !isEditMode;

  // Fetch centers for display using shared cache
  useEffect(() => {
    fetchCentersOnce().then(data => {
      setCenters(data);
    });
  }, []);

  // Initialize form with pitch data (edit mode) or pre-select defaults (create mode)
  useEffect(() => {
    if (pitch) {
      setSongId(pitch.songId);
      setSingerId(pitch.singerId);
      setPitchValue(pitch.pitch);
    } else {
      // Create mode: set defaults based on filters or logged-in user
      // Priority: 1) song filter, 2) singer filter, 3) logged-in user (for singer only)
      if (defaultSongId) {
        setSongId(defaultSongId);
      } else {
        setSongId('');
      }
      if (defaultSingerId) {
        setSingerId(defaultSingerId);
      } else if (isViewerCreatingForSelf && userSingerId) {
        // Pre-select viewer's own singer profile if no filter
        setSingerId(userSingerId);
      } else if (userSingerId) {
        setSingerId(userSingerId);
      } else {
        setSingerId('');
      }
      setPitchValue('');
    }
    setErrors({});
  }, [pitch, isViewerCreatingForSelf, userSingerId, defaultSongId, defaultSingerId]);

  // Track if form has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (pitch) {
      // Edit mode - compare with original values (only pitch can be changed in edit mode)
      return pitchValue !== pitch.pitch;
    } else {
      // Create mode - check if any field has content
      return !!(songId || singerId || pitchValue.trim());
    }
  }, [pitch, songId, singerId, pitchValue]);

  // Expose hasUnsavedChanges check to parent via ref
  useEffect(() => {
    if (onUnsavedChangesRef) {
      onUnsavedChangesRef.current = () => hasUnsavedChanges;
    }
    return () => {
      if (onUnsavedChangesRef) {
        onUnsavedChangesRef.current = null;
      }
    };
  }, [hasUnsavedChanges, onUnsavedChangesRef]);

  // Handle cancel - parent will check for unsaved changes via ref
  const handleCancel = () => {
    onCancel();
  };

  // Get selected song's reference pitches
  const selectedSong = songs.find(s => s.id === songId);
  const hasReferencePitches = selectedSong?.refGents || selectedSong?.refLadies;
  const selectedSinger = singers.find(s => s.id === singerId);

  // Auto-populate pitch based on singer gender and song reference pitches
  useEffect(() => {
    // Auto-populate in create mode whenever song or singer changes (even if pitch already has a value)
    // This effect runs when songId or singerId changes and updates pitch based on reference pitches
    if (!isEditMode && songId && singerId && selectedSong && selectedSinger) {
      const singerGender = selectedSinger.gender;
      let rawReferencePitch = '';

      // Determine which reference pitch to use based on gender
      if (singerGender === 'Male') {
        // Use refGents for male singers
        if (selectedSong.refGents) {
          rawReferencePitch = selectedSong.refGents;
        }
      } else if (singerGender === 'Female' || singerGender === 'Boy' || singerGender === 'Girl') {
        // Use refLadies for female/boy/girl singers
        if (selectedSong.refLadies) {
          rawReferencePitch = selectedSong.refLadies;
        }
      }
      // For 'Other' gender, don't auto-populate (user can choose)

      // Normalize the reference pitch and verify it matches a value in ALL_PITCH_OPTIONS
      if (rawReferencePitch) {
        const normalizedPitch = normalizePitch(rawReferencePitch);

        // Only set if normalization succeeded and the normalized value is in ALL_PITCH_OPTIONS
        if (normalizedPitch && ALL_PITCH_OPTIONS.includes(normalizedPitch)) {
          setPitchValue(normalizedPitch);
        }
        // If normalization fails or doesn't match an option, don't auto-populate
        // (user will need to select manually)
      }
    }
    // Note: We intentionally don't include pitchValue in dependencies to avoid re-running when pitch changes
    // We only want to auto-populate when song or singer selection changes
  }, [songId, singerId, isEditMode, selectedSong, selectedSinger]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!songId) {
      newErrors.songId = 'Please select a song';
    }

    if (!singerId) {
      newErrors.singerId = 'Please select a singer';
    }

    if (!pitchValue.trim()) {
      newErrors.pitch = 'Pitch value is required';
    } else if (pitchValue.length > 50) {
      newErrors.pitch = 'Pitch value must be 50 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        songId,
        singerId,
        pitch: pitchValue.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div>
        <label htmlFor="pitch-song" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Song <span className="text-red-500 dark:text-red-400">*</span>
          <span
            title="Select which song this pitch assignment is for"
            className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
          >
            <i className="fas fa-info-circle text-xs"></i>
          </span>
        </label>
        <select
          id="pitch-song"
          value={songId}
          onChange={(e) => setSongId(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isEditMode
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed dark:!bg-gray-900 dark:!text-gray-500 dark:border-gray-700'
              : 'dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'
            } ${errors.songId ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
            }`}
          disabled={isSubmitting || isEditMode}
        >
          <option value="">Select a song</option>
          {songs.map((song) => (
            <option key={song.id} value={song.id}>
              {song.name}
            </option>
          ))}
        </select>
        {errors.songId && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.songId}</p>
        )}
      </div>

      <div>
        <label htmlFor="pitch-singer" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Singer <span className="text-red-500 dark:text-red-400">*</span>
          <span
            title="Select which singer this pitch is for"
            className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
          >
            <i className="fas fa-info-circle text-xs"></i>
          </span>
        </label>
        <select
          id="pitch-singer"
          value={singerId}
          onChange={(e) => setSingerId(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${(isEditMode || isViewerCreatingForSelf)
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed dark:!bg-gray-900 dark:!text-gray-500 dark:border-gray-700'
              : 'dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'
            } ${errors.singerId ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
            }`}
          disabled={isSubmitting || isEditMode || isViewerCreatingForSelf}
        >
          <option value="">Select a singer</option>
          {singers.map((singer) => {
            const singerCenters = singer.centerIds && singer.centerIds.length > 0
              ? centers.filter(c => singer.centerIds!.includes(c.id)).map(c => c.name).join(', ')
              : '';
            return (
              <option key={singer.id} value={singer.id}>
                {singer.name}{singerCenters ? ` (${singerCenters})` : ''}
              </option>
            );
          })}
        </select>
        {errors.singerId && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.singerId}</p>
        )}
        {isViewerCreatingForSelf && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
            <i className="fas fa-info-circle mr-1"></i>
            You can only create pitches for yourself
          </p>
        )}
      </div>

      {/* Reference Pitches Display */}
      {hasReferencePitches && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reference Pitches for Selected Song:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {selectedSong?.refGents && (
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">Gents: </span>
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  {formatNormalizedPitch(selectedSong.refGents)}
                </span>
              </div>
            )}
            {selectedSong?.refLadies && (
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">Ladies: </span>
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  {formatNormalizedPitch(selectedSong.refLadies)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="pitch-value" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Pitch <span className="text-red-500 dark:text-red-400">*</span>
          <span
            title="Musical key/pitch this singer uses for this song (e.g., C, D, F, 2 Madhyam)"
            className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
          >
            <i className="fas fa-info-circle text-xs"></i>
          </span>
        </label>
        <select
          id="pitch-value"
          value={pitchValue}
          onChange={(e) => setPitchValue(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${errors.pitch ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
            }`}
          disabled={isSubmitting}
        >
          <option value="">Select a pitch</option>
          {ALL_PITCH_OPTIONS.map((pitch) => (
            <option key={pitch} value={pitch}>
              {formatPitchWithName(pitch)}
            </option>
          ))}
        </select>
        {errors.pitch && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.pitch}</p>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          title="Discard changes and close the form"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 w-full sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          title={isEditMode ? "Save changes to this pitch assignment" : "Create a new pitch assignment for this song-singer combination"}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
        >
          {isSubmitting ? 'Saving...' : isEditMode ? 'Update Pitch' : 'Create Pitch'}
        </button>
      </div>
    </form>
  );
};
