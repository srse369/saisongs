import { useCallback, useMemo } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useSongs } from '../contexts/SongContext';
import { useSingers } from '../contexts/SingerContext';
import { useSession } from '../contexts/SessionContext';
import { createSongFuzzySearch, createSingerFuzzySearch } from '../utils/smartSearch';
import type { Song } from '../types';
import type { Singer } from '../types';

export interface AgentAction {
  type: string;
  path?: string;
  filters?: Record<string, string>;
  songName?: string;
  singerName?: string;
  pitch?: string;
  [k: string]: unknown;
}

export interface AgentExecutorCallbacks {
  setReply: (msg: string) => void;
  setPlayAudioSong: (song: Song | null) => void;
  setPendingAction: (action: { type: string; path?: string; filters?: Record<string, string> } | null) => void;
  navigate: NavigateFunction;
  onClose: () => void;
}

/**
 * Central executor for agent actions. Maps action.type to app behavior (navigate, context calls, state updates).
 * Used by LLMDrawer; call executeAction after chatWithAppContext returns.
 */
export function useAgentExecutor(): (action: AgentAction | undefined, callbacks: AgentExecutorCallbacks) => boolean {
  const { songs } = useSongs();
  const { singers } = useSingers();
  const { addSong, removeSong, clearSession, entries } = useSession();

  const songFuzzy = useMemo(() => createSongFuzzySearch(songs), [songs]);
  const singerFuzzy = useMemo(() => createSingerFuzzySearch(singers), [singers]);

  const findSongByName = useCallback(
    (name: string): Song | null => {
      if (!name?.trim()) return null;
      const exact = songs.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
      if (exact) return exact;
      const results = songFuzzy.search(name.trim());
      return results.length > 0 ? results[0].item : null;
    },
    [songs, songFuzzy]
  );

  const findSingerByName = useCallback(
    (name: string): Singer | null => {
      if (!name?.trim()) return null;
      const exact = singers.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
      if (exact) return exact;
      const results = singerFuzzy.search(name.trim());
      return results.length > 0 ? results[0].item : null;
    },
    [singers, singerFuzzy]
  );

  const executeAction = useCallback(
    (action: AgentAction | undefined, callbacks: AgentExecutorCallbacks): boolean => {
      const { setReply, setPlayAudioSong, setPendingAction, navigate: nav, onClose } = callbacks;
      if (!action?.type) return false;

      const songName = typeof action.songName === 'string' ? action.songName.trim() : undefined;
      const song = songName ? findSongByName(songName) : null;
      const singerName = typeof action.singerName === 'string' ? action.singerName.trim() : undefined;
      const singer = singerName ? findSingerByName(singerName) : null;
      const pitch = typeof action.pitch === 'string' ? action.pitch.trim() : undefined;

      switch (action.type) {
        case 'show_preview':
          if (song) {
            nav('/admin/songs', { state: { openSongPreview: song.id } });
            onClose();
            return true;
          }
          setReply(`Song not found. No song matching "${songName || ''}" in the library.`);
          return true;

        case 'play_audio':
          if (!song) {
            setReply(`Song not found. No song matching "${songName || ''}" in the library.`);
            return true;
          }
          if (song.audioLink) {
            setPlayAudioSong(song);
            return true;
          }
          setReply(`"${song.name}" has no audio link.`);
          return true;

        case 'show_ref_gents':
          if (!song) {
            setReply(`Song not found. No song matching "${songName || ''}" in the library.`);
            return true;
          }
          setReply(`Ref (men's scale) for "${song.name}": ${song.refGents || '—'}`);
          return true;

        case 'show_ref_ladies':
          if (!song) {
            setReply(`Song not found. No song matching "${songName || ''}" in the library.`);
            return true;
          }
          setReply(`Ref (ladies' scale) for "${song.name}": ${song.refLadies || '—'}`);
          return true;

        case 'navigate':
          if (action.path) {
            if (action.filters && Object.keys(action.filters).length > 0) {
              const showMyPitches = action.showMyPitches === true;
              nav(action.path, { state: { llmFilters: action.filters, llmShowMyPitches: showMyPitches } });
              onClose();
            } else {
              setPendingAction({ type: 'navigate', path: action.path });
            }
            return true;
          }
          return false;

        case 'add_song_to_session':
          if (!song) {
            setReply(`Song not found. No song matching "${songName || ''}" in the library.`);
            return true;
          }
          addSong(song.id, singer?.id, pitch);
          setReply(`Added "${song.name}"${singer ? ` (${singer.name})` : ''}${pitch ? ` in ${pitch}` : ''} to the session.`);
          return true;

        case 'remove_song_from_session': {
          if (!song) {
            setReply(`Song not found. No song matching "${songName || ''}" in the library.`);
            return true;
          }
          const singerId = singer?.id;
          removeSong(song.id, singerId);
          setReply(`Removed "${song.name}"${singer ? ` (${singer.name})` : ''} from the session.`);
          return true;
        }

        case 'clear_session':
          clearSession();
          setReply('Session cleared.');
          return true;

        default:
          return false;
      }
    },
    [findSongByName, findSingerByName, addSong, removeSong, clearSession]
  );

  return executeAction;
}
