import React, { useState, useMemo, useEffect } from 'react';
import type { SongSingerPitch, Song, Singer } from '../../types';
import { Modal } from '../common';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSession } from '../../contexts/SessionContext';
import { formatNormalizedPitch } from '../../utils/pitchNormalization';
import { CenterBadges } from '../common/CenterBadges';
import { SongMetadataCard } from '../common/SongMetadataCard';

interface PitchWithDetails extends SongSingerPitch {
  songName?: string;
  singerName?: string;
  singerGender?: string;
  singerCenterIds?: number[];
  externalSourceUrl?: string;
  refGents?: string;
  refLadies?: string;
  deity?: string;
  language?: string;
  tempo?: string;
  raga?: string;
  beat?: string;
}

interface PitchListProps {
  pitches: SongSingerPitch[];
  songs: Song[];
  singers: Singer[];
  onEdit: (pitch: SongSingerPitch) => void;
  onDelete: (id: string) => Promise<void>;
  onViewSong: (songId: string) => void;
  loading?: boolean;
  userSingerId?: string; // Current user's singer ID if they have a profile
}

export const PitchList: React.FC<PitchListProps> = ({ 
  pitches, 
  songs, 
  singers, 
  onEdit, 
  onDelete, 
  onViewSong,
  loading = false,
  userSingerId
}) => {
  const navigate = useNavigate();
  const { addSong, songIds, entries } = useSession();
  const { isEditor, isAdmin } = useAuth();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pitchToDelete, setPitchToDelete] = useState<PitchWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPitchId, setSelectedPitchId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Check if a song+singer combination is already in the live session
  const isInLiveSession = (songId: string, singerId: string): boolean => {
    return entries.some(entry => entry.songId === songId && entry.singerId === singerId);
  };

  // Memoize maps to prevent recreation on every render (performance optimization)
  const songMap = useMemo(() => new Map(songs.map(song => [song.id, { 
    name: song.name, 
    externalSourceUrl: song.externalSourceUrl,
    refGents: song.refGents,
    refLadies: song.refLadies,
    deity: song.deity,
    language: song.language,
    tempo: song.tempo,
    raga: song.raga,
    beat: song.beat
  }])), [songs]);
  const singerMap = useMemo(() => new Map(singers.map(singer => [singer.id, { name: singer.name, gender: singer.gender, centerIds: singer.centerIds }])), [singers]);

  // Enrich pitches with song and singer names (memoized for performance)
  const enrichedPitches: PitchWithDetails[] = useMemo(() => pitches.map(pitch => ({
    ...pitch,
    songName: songMap.get(pitch.songId)?.name || 'Unknown Song',
    singerName: singerMap.get(pitch.singerId)?.name || 'Unknown Singer',
    singerGender: singerMap.get(pitch.singerId)?.gender,
    singerCenterIds: singerMap.get(pitch.singerId)?.centerIds,
    externalSourceUrl: songMap.get(pitch.songId)?.externalSourceUrl,
    refGents: songMap.get(pitch.songId)?.refGents,
    refLadies: songMap.get(pitch.songId)?.refLadies,
    deity: songMap.get(pitch.songId)?.deity,
    language: songMap.get(pitch.songId)?.language,
    tempo: songMap.get(pitch.songId)?.tempo,
    raga: songMap.get(pitch.songId)?.raga,
    beat: songMap.get(pitch.songId)?.beat
  })), [pitches, songMap, singerMap]);

  const handleDeleteClick = (pitch: PitchWithDetails) => {
    setPitchToDelete(pitch);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pitchToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(pitchToDelete.id);
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
      setPitchToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setPitchToDelete(null);
  };

  const handlePresent = (pitch: PitchWithDetails) => {
    const params = new URLSearchParams();
    params.set('closeOnExit', '1');
    if (pitch.singerName) {
      params.set('singerName', pitch.singerName);
    }
    if (pitch.pitch) {
      params.set('pitch', pitch.pitch);
    }
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const path = `${base}/presentation/${pitch.songId}`.replace(/\/\/+/g, '/');
    window.open(`${window.location.origin}${path}?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (enrichedPitches.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-music text-4xl text-gray-400 mx-auto block"></i>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No pitch associations</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new pitch association.</p>
      </div>
    );
  }

  return (
    <>
      {/* Card layout for all screen sizes - SAME AS SONGS */}
      <div className="space-y-0 md:space-y-3">
        {enrichedPitches.map((pitch, index) => {
          const isSelected = selectedPitchId === pitch.id;
          const songWithLyrics = songs.find(s => s.id === pitch.songId);
          return (
          <div
            key={pitch.id}
            onClick={() => {
              // On mobile, toggle selection on row click
              if (isMobile) {
                setSelectedPitchId(isSelected ? null : pitch.id);
              }
            }}
            className={`bg-white dark:bg-gray-800 p-2 md:p-4 transition-all duration-200 ${
              isMobile 
                ? `cursor-pointer ${index > 0 ? 'border-t border-gray-300 dark:border-gray-600' : ''} ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`
                : `border rounded-lg shadow-md hover:shadow-lg ${
                    isSelected 
                      ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`
            }`}
          >
            <div className="flex flex-col gap-1.5 md:gap-3">
              {/* Content Section */}
              <div className="flex-1 min-w-0">
                {/* Song Metadata Section - Reusable component */}
                <SongMetadataCard
                  song={{
                    name: pitch.songName || '',
                    externalSourceUrl: pitch.externalSourceUrl,
                    raga: pitch.raga,
                    beat: pitch.beat,
                    deity: pitch.deity,
                    language: pitch.language,
                    tempo: pitch.tempo,
                    refGents: pitch.refGents,
                    refLadies: pitch.refLadies,
                  }}
                  onNameClick={isMobile ? undefined : () => handlePresent(pitch)}
                  showBackground={!isMobile}
                  isSelected={isSelected}
                  onPreviewClick={() => handlePresent(pitch)}
                  lyricsHover={{ songId: pitch.songId, songName: pitch.songName || 'Unknown', song: songWithLyrics }}
                />
                
                {/* Singer and Pitch */}
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <span className="hidden md:inline font-medium">Singer: </span>
                  <span className={`font-semibold text-base ${
                    pitch.singerGender?.toLowerCase() === 'male' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : pitch.singerGender?.toLowerCase() === 'boy' 
                        ? 'text-blue-400 dark:text-blue-300' 
                        : pitch.singerGender?.toLowerCase() === 'female' 
                          ? 'text-pink-600 dark:text-pink-400' 
                          : pitch.singerGender?.toLowerCase() === 'girl' 
                            ? 'text-pink-400 dark:text-pink-300' 
                            : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {pitch.singerName}
                    {pitch.singerCenterIds && pitch.singerCenterIds.length > 0 && (
                      <span className="font-normal text-gray-500 dark:text-gray-400">
                        {' '}<CenterBadges centerIds={pitch.singerCenterIds} />
                      </span>
                    )}
                  </span>
                  <span className="mx-2">•</span>
                  <span className="hidden md:inline">Pitch: </span>
                  <span className="font-bold text-gray-700 dark:text-gray-200">{formatNormalizedPitch(pitch.pitch)}</span>
                </div>
              </div>
              
              {/* Actions - Hidden on mobile until row is selected */}
              <div className={`flex flex-wrap items-center justify-start gap-1.5 sm:gap-2 pt-1 md:pt-3 md:border-t md:border-gray-200 md:dark:border-gray-700 ${isMobile && !isSelected ? 'hidden' : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => addSong(pitch.songId, pitch.singerId, pitch.pitch)}
                  disabled={isInLiveSession(pitch.songId, pitch.singerId)}
                  title={isInLiveSession(pitch.songId, pitch.singerId) ? 'Already in live session' : 'Add this song with singer and pitch to the live session'}
                  className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg sm:rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInLiveSession(pitch.songId, pitch.singerId) ? (
                    <i className="fas fa-check text-lg text-emerald-600 dark:text-emerald-400"></i>
                  ) : (
                    <i className="fas fa-plus text-lg text-emerald-600 dark:text-emerald-400"></i>
                  )}
                  <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Add to Session</span>
                </button>
                <button
                  onClick={() => navigate(`/admin/songs?songId=${pitch.songId}`)}
                  title="View song in Songs tab"
                  className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg sm:rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                >
                  <i className="fas fa-external-link-alt text-lg text-blue-600 dark:text-blue-400" style={{ transform: 'scaleX(-1)' }}></i>
                  <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Song</span>
                </button>
                {pitch.externalSourceUrl && (
                  <a
                    href={pitch.externalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View song on external source (YouTube, etc.)"
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                  >
                    <i className="fas fa-external-link-alt text-lg text-blue-600 dark:text-blue-400"></i>
                    <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">External URL</span>
                  </a>
                )}
                {(isEditor || pitch.singerId === userSingerId) && (
                  <button
                    onClick={() => onEdit(pitch)}
                    title="Edit the pitch/key for this singer's performance"
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg sm:rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                  >
                    <i className="fas fa-edit text-lg text-blue-600 dark:text-blue-400"></i>
                    <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Edit</span>
                  </button>
                )}
                {(isEditor || pitch.singerId === userSingerId) && (
                  <button
                    onClick={() => handleDeleteClick(pitch)}
                    title="Remove this pitch association permanently"
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg sm:rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                  >
                    <i className="fas fa-trash text-lg text-red-600 dark:text-red-400"></i>
                    <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        title="Delete Pitch Association"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete the pitch association for{' '}
            <span className="font-semibold">{pitchToDelete?.singerName}</span> singing{' '}
            <span className="font-semibold">{pitchToDelete?.songName}</span> in pitch{' '}
            <span className="font-semibold">{pitchToDelete?.pitch}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleDeleteCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
