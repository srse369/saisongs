import React, { useState, useEffect } from 'react';
import type { Song, CreateSongInput } from '../../types';

interface SongFormProps {
  song?: Song | null;
  onSubmit: (input: CreateSongInput) => Promise<void>;
  onCancel: () => void;
}

export const SongForm: React.FC<SongFormProps> = ({ song, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [externalSourceUrl, setExternalSourceUrl] = useState('');
  const [title, setTitle] = useState('');
  const [title2, setTitle2] = useState('');
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
  const [ulink, setUlink] = useState('');
  const [goldenVoice, setGoldenVoice] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!song;

  useEffect(() => {
    if (song) {
      setName(song.name);
      setExternalSourceUrl(song.externalSourceUrl);
      setTitle(song.title || '');
      setTitle2(song.title2 || '');
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
      setUlink(song.ulink || '');
      setGoldenVoice(song.goldenVoice || false);
    } else {
      setName('');
      setExternalSourceUrl('');
      setTitle('');
      setTitle2('');
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
      setUlink('');
      setGoldenVoice(false);
    }
    setErrors({});
  }, [song]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Song name is required';
    } else if (name.length > 255) {
      newErrors.name = 'Song name must be 255 characters or less';
    }

    if (!externalSourceUrl.trim()) {
      newErrors.externalSourceUrl = 'external source URL is required';
    } else if (!isValidUrl(externalSourceUrl.trim())) {
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
      await onSubmit({
        name: name.trim(),
        externalSourceUrl: externalSourceUrl.trim(),
        title: title.trim() || undefined,
        title2: title2.trim() || undefined,
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
        ulink: ulink.trim() || undefined,
        goldenVoice,
      });
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
          external source URL <span className="text-red-500 dark:text-red-400">*</span>
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
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Song Details (Optional)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              disabled={isSubmitting}
            />
          </div>

          {/* Title2 */}
          <div>
            <label htmlFor="title2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title 2 (Full)
            </label>
            <input
              id="title2"
              type="text"
              value={title2}
              onChange={(e) => setTitle2(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              disabled={isSubmitting}
            />
          </div>

          {/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Language
            </label>
            <input
              id="language"
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g., sanskrit / hindi"
              disabled={isSubmitting}
            />
          </div>

          {/* Deity */}
          <div>
            <label htmlFor="deity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deity
            </label>
            <input
              id="deity"
              type="text"
              value={deity}
              onChange={(e) => setDeity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g., sai, devi, krishna"
              disabled={isSubmitting}
            />
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
            Lyrics
          </label>
          <textarea
            id="lyrics"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 font-mono text-sm"
            placeholder="Enter song lyrics (use \n for line breaks)"
            disabled={isSubmitting}
          />
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

          {/* ULink */}
          <div>
            <label htmlFor="ulink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ULink
            </label>
            <input
              id="ulink"
              type="text"
              value={ulink}
              onChange={(e) => setUlink(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
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
      </div>

      {/* Form Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
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
