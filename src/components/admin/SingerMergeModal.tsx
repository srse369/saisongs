import React, { useState, useEffect, useMemo } from 'react';
import type { Singer, SongSingerPitch, Song } from '../../types';
import { Modal } from '../common/Modal';
import { CenterBadges } from '../common/CenterBadges';
import { usePitches } from '../../contexts/PitchContext';
import { useSongs } from '../../contexts/SongContext';
import { formatPitchWithName } from '../../utils/pitchUtils';

interface SingerMergeModalProps {
  isOpen: boolean;
  singers: Singer[];
  selectedSingerIds: string[];
  onClose: () => void;
  onConfirm: (targetSingerId: string, singerIdsToMerge: string[]) => Promise<void>;
}

export const SingerMergeModal: React.FC<SingerMergeModalProps> = ({
  isOpen,
  singers,
  selectedSingerIds,
  onClose,
  onConfirm,
}) => {
  const [targetSingerId, setTargetSingerId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);
  const { pitches, fetchAllPitches } = usePitches();
  const { songs, fetchSongs } = useSongs();

  const selectedSingers = singers.filter(s => selectedSingerIds.includes(s.id));

  // Fetch pitches and songs when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAllPitches();
      fetchSongs();
    }
  }, [isOpen, fetchAllPitches, fetchSongs]);

  // Calculate pitch changes
  const pitchAnalysis = useMemo(() => {
    if (!targetSingerId) {
      return { toTransfer: [], toDelete: [], conflicts: [] };
    }

    const singerIdsToMerge = selectedSingerIds.filter(id => id !== targetSingerId);
    
    // Get pitches for target singer
    const targetPitches = pitches.filter(p => p.singerId === targetSingerId);
    const targetSongIds = new Set(targetPitches.map(p => p.songId));
    
    // Get pitches for singers being merged
    const mergePitches = pitches.filter(p => singerIdsToMerge.includes(p.singerId));
    
    // Group merge pitches by song
    const mergePitchesBySong = new Map<string, SongSingerPitch[]>();
    mergePitches.forEach(pitch => {
      const existing = mergePitchesBySong.get(pitch.songId) || [];
      existing.push(pitch);
      mergePitchesBySong.set(pitch.songId, existing);
    });
    
    const toTransfer: Array<SongSingerPitch & { songName?: string; singerName?: string }> = [];
    const toDelete: Array<SongSingerPitch & { songName?: string; singerName?: string; reason: string }> = [];
    const conflicts: Array<{ songName: string; kept: string; deleted: string[] }> = [];
    
    mergePitchesBySong.forEach((pitchesForSong, songId) => {
      const song = songs.find(s => s.id === songId);
      const songName = song?.name || 'Unknown Song';
      
      if (targetSongIds.has(songId)) {
        // Conflict: target singer already has this song
        const targetPitch = targetPitches.find(p => p.songId === songId);
        const deletedPitches = pitchesForSong.map(p => {
          const singer = singers.find(s => s.id === p.singerId);
          return `${singer?.name || 'Unknown'} (${formatPitchWithName(p.pitch)})`;
        });
        
        conflicts.push({
          songName,
          kept: formatPitchWithName(targetPitch!.pitch),
          deleted: deletedPitches
        });
        
        // Mark all merge pitches for this song as to be deleted
        pitchesForSong.forEach(pitch => {
          const singer = singers.find(s => s.id === pitch.singerId);
          toDelete.push({
            ...pitch,
            songName,
            singerName: singer?.name,
            reason: 'Target singer already has this song'
          });
        });
      } else {
        // No conflict: transfer one pitch (pick first one)
        const pitchToTransfer = pitchesForSong[0];
        const singer = singers.find(s => s.id === pitchToTransfer.singerId);
        toTransfer.push({
          ...pitchToTransfer,
          songName,
          singerName: singer?.name
        });
        
        // If there are multiple pitches for this song, mark extras as to be deleted
        if (pitchesForSong.length > 1) {
          pitchesForSong.slice(1).forEach(pitch => {
            const singer = singers.find(s => s.id === pitch.singerId);
            toDelete.push({
              ...pitch,
              songName,
              singerName: singer?.name,
              reason: 'Duplicate - another pitch for this song will be transferred'
            });
          });
        }
      }
    });
    
    return { toTransfer, toDelete, conflicts };
  }, [targetSingerId, selectedSingerIds, pitches, songs, singers]);

  const handleConfirm = async () => {
    if (!targetSingerId) return;

    const singerIdsToMerge = selectedSingerIds.filter(id => id !== targetSingerId);
    
    if (singerIdsToMerge.length === 0) {
      return;
    }

    setIsMerging(true);
    try {
      await onConfirm(targetSingerId, singerIdsToMerge);
      onClose();
    } finally {
      setIsMerging(false);
    }
  };

  const handleClose = () => {
    if (!isMerging) {
      setTargetSingerId('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Merge Singers"
    >
      <div className="space-y-4">
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <div className="flex items-start">
            <i className="fas fa-exclamation-triangle text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5"></i>
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-semibold mb-1">Warning: This action cannot be undone!</p>
              <p>All pitch associations from the merged singers will be transferred to the target singer, and the merged singers will be permanently deleted.</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            You have selected <span className="font-semibold">{selectedSingers.length} singers</span> to merge. 
            Please select which singer should be kept as the primary record:
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedSingers.map((singer) => (
              <label
                key={singer.id}
                className={`flex items-start p-3 border rounded-md cursor-pointer transition-colors ${
                  targetSingerId === singer.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <input
                  type="radio"
                  name="targetSinger"
                  value={singer.id}
                  checked={targetSingerId === singer.id}
                  onChange={(e) => setTargetSingerId(e.target.value)}
                  className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
                  disabled={isMerging}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`font-semibold ${
                      singer.gender?.toLowerCase() === 'male' 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : singer.gender?.toLowerCase() === 'boy' 
                          ? 'text-blue-400 dark:text-blue-300' 
                          : singer.gender?.toLowerCase() === 'female' 
                            ? 'text-pink-600 dark:text-pink-400' 
                            : singer.gender?.toLowerCase() === 'girl' 
                              ? 'text-pink-400 dark:text-pink-300' 
                              : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {singer.name}
                    </span>
                    {singer.gender && (
                      <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {singer.gender}
                      </span>
                    )}
                    <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-blue-600 dark:bg-blue-500 rounded-full" title={`${singer.pitchCount ?? 0} pitch assignments`}>
                      {singer.pitchCount ?? 0}
                    </span>
                  </div>
                  {singer.email && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {singer.email}
                    </p>
                  )}
                  {singer.centerIds && singer.centerIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <CenterBadges centerIds={singer.centerIds} />
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {targetSingerId && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-semibold">
                {selectedSingers.find(s => s.id === targetSingerId)?.name}
              </span> will be kept, and {selectedSingers.length - 1} other singer(s) will be merged into it and deleted.
            </p>
          </div>
        )}

        {/* Singers to be deleted */}
        {targetSingerId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Left Column */}
            <div className="space-y-3">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <h4 className="font-semibold text-sm text-red-800 dark:text-red-200 mb-2">
                  <i className="fas fa-user-times mr-2"></i>
                  Singers to be deleted ({selectedSingers.length - 1}):
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  {selectedSingers
                    .filter(s => s.id !== targetSingerId)
                    .map(singer => (
                      <li key={singer.id} className="flex items-center gap-2">
                        <i className="fas fa-times text-xs"></i>
                        {singer.name}
                        {singer.gender && ` (${singer.gender})`}
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 dark:bg-blue-500 rounded-full ml-auto" title={`${singer.pitchCount ?? 0} pitches`}>
                          {singer.pitchCount ?? 0}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>

              {/* Pitches to transfer */}
              {pitchAnalysis.toTransfer.length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <h4 className="font-semibold text-sm text-green-800 dark:text-green-200 mb-2">
                    <i className="fas fa-arrow-right mr-2"></i>
                    Pitches to be transferred ({pitchAnalysis.toTransfer.length}):
                  </h4>
                  <div className="text-sm text-green-700 dark:text-green-300 space-y-1 max-h-60 overflow-y-auto">
                    {pitchAnalysis.toTransfer.map((pitch, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <i className="fas fa-music text-xs mt-1"></i>
                        <span>
                          <span className="font-medium">{pitch.songName}</span>
                          {' - '}
                          <span className="text-xs">{formatPitchWithName(pitch.pitch)}</span>
                          {pitch.singerName && (
                            <span className="text-xs opacity-75"> (from {pitch.singerName})</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Conflicts */}
              {pitchAnalysis.conflicts.length > 0 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
                  <h4 className="font-semibold text-sm text-orange-800 dark:text-orange-200 mb-2">
                    <i className="fas fa-exclamation-circle mr-2"></i>
                    Conflicts - Target keeps ({pitchAnalysis.conflicts.length}):
                  </h4>
                  <div className="text-sm text-orange-700 dark:text-orange-300 space-y-2 max-h-60 overflow-y-auto">
                    {pitchAnalysis.conflicts.map((conflict, idx) => (
                      <div key={idx} className="border-l-2 border-orange-400 pl-2">
                        <div className="font-medium">{conflict.songName}</div>
                        <div className="text-xs">
                          <span className="text-green-700 dark:text-green-400">✓ Keeping: {conflict.kept}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-red-700 dark:text-red-400">✗ Deleting: {conflict.deleted.join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pitches to delete details */}
              {pitchAnalysis.toDelete.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-md">
                  <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-2">
                    <i className="fas fa-trash mr-2"></i>
                    Pitches to be deleted ({pitchAnalysis.toDelete.length}):
                  </h4>
                  <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1 max-h-60 overflow-y-auto">
                    {pitchAnalysis.toDelete.map((pitch, idx) => (
                      <div key={idx} className="flex items-start gap-2 py-1">
                        <i className="fas fa-times text-red-600 dark:text-red-400 text-xs mt-1"></i>
                        <div className="flex-1">
                          <div className="font-medium">{pitch.songName}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {formatPitchWithName(pitch.pitch)}
                            {pitch.singerName && ` (from ${pitch.singerName})`}
                            {pitch.reason && (
                              <span className="italic text-gray-500 dark:text-gray-500"> - {pitch.reason}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <button
            onClick={handleClose}
            disabled={isMerging}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!targetSingerId || isMerging}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMerging ? 'Merging...' : 'Confirm Merge'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
