import React, { useState, useEffect } from 'react';
import type { SongSingerPitch, CreatePitchInput, Song, Singer } from '../../types';

interface PitchFormProps {
  pitch?: SongSingerPitch | null;
  songs: Song[];
  singers: Singer[];
  onSubmit: (input: CreatePitchInput) => Promise<void>;
  onCancel: () => void;
}

export const PitchForm: React.FC<PitchFormProps> = ({ 
  pitch, 
  songs, 
  singers, 
  onSubmit, 
  onCancel 
}) => {
  const [songId, setSongId] = useState('');
  const [singerId, setSingerId] = useState('');
  const [pitchValue, setPitchValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!pitch;

  useEffect(() => {
    if (pitch) {
      setSongId(pitch.songId);
      setSingerId(pitch.singerId);
      setPitchValue(pitch.pitch);
    } else {
      setSongId('');
      setSingerId('');
      setPitchValue('');
    }
    setErrors({});
  }, [pitch]);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pitch-song" className="block text-sm font-medium text-gray-700 mb-1">
          Song <span className="text-red-500">*</span>
        </label>
        <select
          id="pitch-song"
          value={songId}
          onChange={(e) => setSongId(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.songId ? 'border-red-500' : 'border-gray-300'
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
          <p className="mt-1 text-sm text-red-600">{errors.songId}</p>
        )}
      </div>

      <div>
        <label htmlFor="pitch-singer" className="block text-sm font-medium text-gray-700 mb-1">
          Singer <span className="text-red-500">*</span>
        </label>
        <select
          id="pitch-singer"
          value={singerId}
          onChange={(e) => setSingerId(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.singerId ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isSubmitting || isEditMode}
        >
          <option value="">Select a singer</option>
          {singers.map((singer) => (
            <option key={singer.id} value={singer.id}>
              {singer.name}
            </option>
          ))}
        </select>
        {errors.singerId && (
          <p className="mt-1 text-sm text-red-600">{errors.singerId}</p>
        )}
      </div>

      <div>
        <label htmlFor="pitch-value" className="block text-sm font-medium text-gray-700 mb-1">
          Pitch <span className="text-red-500">*</span>
        </label>
        <input
          id="pitch-value"
          type="text"
          value={pitchValue}
          onChange={(e) => setPitchValue(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.pitch ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="e.g., C, D#, G major"
          disabled={isSubmitting}
        />
        {errors.pitch && (
          <p className="mt-1 text-sm text-red-600">{errors.pitch}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : isEditMode ? 'Update Pitch' : 'Create Pitch'}
        </button>
      </div>
    </form>
  );
};
