import React, { useState, useEffect, useMemo } from 'react';
import type { Song, CreateSongInput } from '../../types';

interface SongFormProps {
  song?: Song | null;
  onSubmit: (input: CreateSongInput) => Promise<void>;
  onCancel: () => void;
  onUnsavedChangesRef?: React.MutableRefObject<(() => boolean) | null>;
}

export const SongForm: React.FC<SongFormProps> = ({ song, onSubmit, onCancel, onUnsavedChangesRef }) => {
  const [name, setName] = useState('');
  const [externalSourceUrl, setExternalSourceUrl] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [meaning, setMeaning] = useState('');
  const [language, setLanguage] = useState('');
  const [deity, setDeity] = useState('');
  const [tempo, setTempo] = useState('');
  const [beat, setBeat] = useState('');
  const [raga, setRaga] = useState('');
  const [level, setLevel] = useState('');
  const [songTags, setSongTags] = useState('');
  const [audioLink, setAudioLink] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [goldenVoice, setGoldenVoice] = useState(false);
  const [referenceGentsPitch, setReferenceGentsPitch] = useState('');
  const [referenceLadiesPitch, setReferenceLadiesPitch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!song;
  
  // Track if form has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (song) {
      // Edit mode - compare with original values
      return (
        name !== song.name ||
        externalSourceUrl !== song.externalSourceUrl ||
        lyrics !== (song.lyrics || '') ||
        meaning !== (song.meaning || '') ||
        language !== (song.language || '') ||
        deity !== (song.deity || '') ||
        tempo !== (song.tempo || '') ||
        beat !== (song.beat || '') ||
        raga !== (song.raga || '') ||
        level !== (song.level || '') ||
        songTags !== (song.songTags || '') ||
        audioLink !== (song.audioLink || '') ||
        videoLink !== (song.videoLink || '') ||
        goldenVoice !== (song.goldenVoice || false) ||
        referenceGentsPitch !== (song.referenceGentsPitch || '') ||
        referenceLadiesPitch !== (song.referenceLadiesPitch || '')
      );
    } else {
      // Create mode - check if any field has content
      return !!(
        name.trim() ||
        externalSourceUrl.trim() ||
        lyrics.trim() ||
        meaning.trim() ||
        language.trim() ||
        deity.trim() ||
        tempo.trim() ||
        beat.trim() ||
        raga.trim() ||
        level.trim() ||
        songTags.trim() ||
        audioLink.trim() ||
        videoLink.trim() ||
        goldenVoice ||
        referenceGentsPitch.trim() ||
        referenceLadiesPitch.trim()
      );
    }
  }, [song, name, externalSourceUrl, lyrics, meaning, language, deity, tempo, beat, raga, level, songTags, audioLink, videoLink, goldenVoice, referenceGentsPitch, referenceLadiesPitch]);

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

  // Handle cancel with unsaved changes check
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    onCancel();
  };

  useEffect(() => {
    if (song) {
      setName(song.name || '');
      setExternalSourceUrl(song.externalSourceUrl || '');
      setLyrics(song.lyrics || '');
      setMeaning(song.meaning || '');
      setLanguage(song.language || '');
      setDeity(song.deity || '');
      setTempo(song.tempo || '');
      setBeat(song.beat || '');
      setRaga(song.raga || '');
      setLevel(song.level || '');
      setSongTags(song.songTags || '');
      setAudioLink(song.audioLink || '');
      setVideoLink(song.videoLink || '');
      setGoldenVoice(song.goldenVoice || false);
      setReferenceGentsPitch(song.referenceGentsPitch || '');
      setReferenceLadiesPitch(song.referenceLadiesPitch || '');
    } else {
      setName('');
      setExternalSourceUrl('');
      setLyrics('');
      setMeaning('');
      setLanguage('');
      setDeity('');
      setTempo('');
      setBeat('');
      setRaga('');
      setLevel('');
      setSongTags('');
      setAudioLink('');
      setVideoLink('');
      setGoldenVoice(false);
      setReferenceGentsPitch('');
      setReferenceLadiesPitch('');
    }
    setErrors({});
  }, [song]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Ensure values are strings (defensive against null values)
    const nameVal = name ?? '';
    const languageVal = language ?? '';
    const deityVal = deity ?? '';
    const lyricsVal = lyrics ?? '';
    const externalSourceUrlVal = externalSourceUrl ?? '';

    if (!nameVal.trim()) {
      newErrors.name = 'Song name is required';
    } else if (nameVal.length > 255) {
      newErrors.name = 'Song name must be 255 characters or less';
    }

    if (!languageVal.trim()) {
      newErrors.language = 'Language is required';
    }

    if (!deityVal.trim()) {
      newErrors.deity = 'Deity is required';
    }

    if (!lyricsVal.trim()) {
      newErrors.lyrics = 'Lyrics are required';
    }

    if (externalSourceUrlVal.trim() && !isValidUrl(externalSourceUrlVal.trim())) {
      newErrors.externalSourceUrl = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        name: name.trim(),
        externalSourceUrl: externalSourceUrl.trim(),
        lyrics: lyrics.trim() || undefined,
        meaning: meaning.trim() || undefined,
        language: language.trim() || undefined,
        deity: deity.trim() || undefined,
        tempo: tempo.trim() || undefined,
        beat: beat.trim() || undefined,
        raga: raga.trim() || undefined,
        level: level.trim() || undefined,
        songTags: songTags.trim() || undefined,
        audioLink: audioLink.trim() || undefined,
        videoLink: videoLink.trim() || undefined,
        goldenVoice,
        referenceGentsPitch: referenceGentsPitch.trim() || undefined,
        referenceLadiesPitch: referenceLadiesPitch.trim() || undefined,
      };
      await onSubmit(submitData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      {/* Song Name */}
      <div>
        <label htmlFor="song-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Song Name <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="song-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
            errors.name ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
          }`}
          placeholder="Enter song name"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
        )}
      </div>

      {/* External Source URL */}
      <div>
        <label htmlFor="external-source-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          External Source URL
        </label>
        <input
          id="external-source-url"
          type="url"
          value={externalSourceUrl}
          onChange={(e) => setExternalSourceUrl(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
            errors.externalSourceUrl ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
          }`}
          placeholder="https://external-source/..."
          disabled={isSubmitting}
        />
        {errors.externalSourceUrl && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.externalSourceUrl}</p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          All song data (lyrics, translation, metadata) will be fetched automatically from this URL.
        </p>
      </div>

      {/* Additional Fields Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Song Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Language <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              id="language"
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 ${
                errors.language ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., sanskrit / hindi"
              disabled={isSubmitting}
            />
            {errors.language && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.language}</p>
            )}
          </div>

          {/* Deity */}
          <div>
            <label htmlFor="deity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deity <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              id="deity"
              type="text"
              value={deity}
              onChange={(e) => setDeity(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 ${
                errors.deity ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., sai, devi, krishna"
              disabled={isSubmitting}
            />
            {errors.deity && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.deity}</p>
            )}
          </div>

          {/* Tempo */}
          <div>
            <label htmlFor="tempo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tempo
            </label>
            <input
              id="tempo"
              type="text"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g., medium, fast, slow"
              disabled={isSubmitting}
            />
          </div>

          {/* Beat */}
          <div>
            <label htmlFor="beat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Beat
            </label>
            <input
              id="beat"
              type="text"
              value={beat}
              onChange={(e) => setBeat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g., 8 beat / keherwa / adi"
              disabled={isSubmitting}
            />
          </div>

          {/* Raga */}
          <div>
            <label htmlFor="raga" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Raga
            </label>
            <input
              id="raga"
              type="text"
              value={raga}
              onChange={(e) => setRaga(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g., hamsadhwani"
              disabled={isSubmitting}
            />
          </div>

          {/* Level */}
          <div>
            <label htmlFor="level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Level
            </label>
            <input
              id="level"
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g., simple, intermediate, advanced"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Lyrics */}
        <div className="mt-4">
          <label htmlFor="lyrics" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Lyrics <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <textarea
            id="lyrics"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={6}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 font-mono text-sm ${
              errors.lyrics ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Enter song lyrics (use \n for line breaks)"
            disabled={isSubmitting}
          />
          {errors.lyrics && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.lyrics}</p>
          )}
        </div>

        {/* Meaning */}
        <div className="mt-4">
          <label htmlFor="meaning" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Meaning / Translation
          </label>
          <textarea
            id="meaning"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Enter translation or meaning"
            disabled={isSubmitting}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Audio Link */}
          <div>
            <label htmlFor="audioLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Audio Link
            </label>
            <input
              id="audioLink"
              type="url"
              value={audioLink}
              onChange={(e) => setAudioLink(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="https://..."
              disabled={isSubmitting}
            />
          </div>

          {/* Video Link */}
          <div>
            <label htmlFor="videoLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Video Link
            </label>
            <input
              id="videoLink"
              type="url"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="https://..."
              disabled={isSubmitting}
            />
          </div>

          {/* Song Tags */}
          <div>
            <label htmlFor="songTags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
            </label>
            <input
              id="songTags"
              type="text"
              value={songTags}
              onChange={(e) => setSongTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g., prayers, sheet-music"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Golden Voice */}
        <div className="mt-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={goldenVoice}
              onChange={(e) => setGoldenVoice(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              disabled={isSubmitting}
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Golden Voice</span>
          </label>
        </div>

        {/* Reference Pitches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {/* Reference Gents Pitch */}
          <div>
            <label htmlFor="referenceGentsPitch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reference Gents Pitch
            </label>
            <input
              id="referenceGentsPitch"
              type="text"
              value={referenceGentsPitch}
              onChange={(e) => setReferenceGentsPitch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g., F, 2 Madhyam, C#"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              For male singers (e.g., C, D, F, 2 Madhyam)
            </p>
          </div>

          {/* Reference Ladies Pitch */}
          <div>
            <label htmlFor="referenceLadiesPitch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reference Ladies Pitch
            </label>
            <input
              id="referenceLadiesPitch"
              type="text"
              value={referenceLadiesPitch}
              onChange={(e) => setReferenceLadiesPitch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g., C, 1 Madhyam, G#"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              For female singers (e.g., C, G, 1 Madhyam)
            </p>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 w-full sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
        >
          {isSubmitting ? 'Saving...' : isEditMode ? 'Update Song' : 'Create Song'}
        </button>
      </div>
    </form>
  );
};
