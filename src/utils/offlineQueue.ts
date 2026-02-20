/**
 * Offline queue - stores pending create/update/delete operations when offline
 * and syncs them to the server when the app comes back online.
 *
 * Sync order: songs -> singers -> pitches -> sessions (to resolve dependencies)
 */

import { getCacheItem, setCacheItem, getSyncItem, setSyncItem } from './cacheUtils';
import { CACHE_KEYS } from './cacheUtils';

/** Resolve song/singer ID to display name from cache. Used when queuing offline ops. Returns promise. */
export async function resolveNameFromCache(id: string | undefined, entity: 'song' | 'singer'): Promise<string | null> {
  if (!id) return null;
  try {
    if (entity === 'song') {
      const raw = await getCacheItem(`${CACHE_KEYS.SAI_SONGS_SONG_PREFIX}${id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.song?.name ?? null;
      }
      const listRaw = await getCacheItem(CACHE_KEYS.SAI_SONGS_SONGS);
      if (listRaw) {
        const parsed = JSON.parse(listRaw);
        const songs = parsed?.songs;
        const found = Array.isArray(songs) ? songs.find((s: { id: string }) => s.id === id) : null;
        return found?.name ?? null;
      }
    } else if (entity === 'singer') {
      const raw = await getCacheItem(CACHE_KEYS.SAI_SONGS_SINGERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        const singers = parsed?.singers;
        const found = Array.isArray(singers) ? singers.find((s: { id: string }) => s.id === id) : null;
        return found?.name ?? null;
      }
    }
    const pitchesRaw = await getCacheItem(CACHE_KEYS.SAI_SONGS_PITCHES);
    if (pitchesRaw) {
      const parsed = JSON.parse(pitchesRaw);
      const pitches = parsed?.pitches;
      const found = Array.isArray(pitches) ? pitches.find((p: { songId?: string; singerId?: string }) => p.songId === id || p.singerId === id) : null;
      if (found) return entity === 'song' ? found.songName ?? null : found.singerName ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}
import { globalEventBus } from './globalEventBus';
import songService from '../services/SongService';
import singerService from '../services/SingerService';
import pitchService from '../services/PitchService';
import NamedSessionService from '../services/NamedSessionService';
import type { Song, Singer, SongSingerPitch } from '../types';

const QUEUE_KEY = 'saiSongs:offlineQueue';

export type OfflineEntity = 'song' | 'singer' | 'pitch' | 'session';

export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: OfflineEntity;
  payload: Record<string, unknown>;
  tempId?: string;
  timestamp: number;
  /** Human-readable label for display in sync summary (e.g. "Song: Amazing Grace") */
  displayLabel?: string;
}

export interface OfflineSyncConflict {
  opId: string;
  displayLabel: string;
  reason: 'modified_on_server' | 'deleted_on_server';
  serverUpdatedAt?: string;
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message?.includes('fetch')) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed');
  }
  return false;
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

export function isOfflineError(err: unknown): boolean {
  return isOffline() || isNetworkError(err);
}

export function generateTempId(entity: OfflineEntity): string {
  return `temp-${entity}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getQueue(): QueuedOperation[] {
  const raw = getSyncItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(ops: QueuedOperation[]): void {
  setSyncItem(QUEUE_KEY, JSON.stringify(ops));
}

export function addToOfflineQueue(op: Omit<QueuedOperation, 'id' | 'timestamp'>): string {
  const queue = getQueue();
  const id = `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const fullOp: QueuedOperation = {
    ...op,
    id,
    timestamp: Date.now(),
  };
  queue.push(fullOp);
  saveQueue(queue);
  return id;
}

/**
 * Check for potential conflicts: fetch update/delete targets from server and compare.
 * Returns list of ops that may conflict (server was modified after we queued).
 */
export async function checkOfflineQueueConflicts(): Promise<OfflineSyncConflict[]> {
  const queue = getQueue();
  const conflicts: OfflineSyncConflict[] = [];

  for (const op of queue) {
    if (op.type === 'create') continue; // Creates don't conflict
    const id = (op.payload.id as string) || (op.payload.sessionId as string) || '';
    if (!id || id.startsWith('temp-')) continue; // Temp IDs not yet on server

    try {
      if (op.entity === 'song') {
        const song = await songService.getSongById(id, true);
        if (!song) {
          if (op.type === 'delete') continue; // Already gone, no conflict
          conflicts.push({ opId: op.id, displayLabel: op.displayLabel || `Song ${id}`, reason: 'deleted_on_server' });
        } else {
          const serverUpdated = song.updatedAt ? new Date(song.updatedAt).getTime() : 0;
          if (serverUpdated > op.timestamp) {
            conflicts.push({
              opId: op.id,
              displayLabel: op.displayLabel || `Song: ${song.name}`,
              reason: 'modified_on_server',
              serverUpdatedAt: song.updatedAt?.toString(),
            });
          }
        }
      } else if (op.entity === 'singer') {
        const singer = await singerService.getSingerById(id, true);
        if (!singer) {
          if (op.type === 'delete') continue;
          conflicts.push({ opId: op.id, displayLabel: op.displayLabel || `Singer ${id}`, reason: 'deleted_on_server' });
        } else {
          const serverUpdated = singer.updatedAt ? new Date(singer.updatedAt).getTime() : 0;
          if (serverUpdated > op.timestamp) {
            conflicts.push({
              opId: op.id,
              displayLabel: op.displayLabel || `Singer: ${singer.name}`,
              reason: 'modified_on_server',
              serverUpdatedAt: singer.updatedAt?.toString(),
            });
          }
        }
      } else if (op.entity === 'pitch') {
        const pitch = await pitchService.updatePitch(id, {} as any);
        if (!pitch) {
          if (op.type === 'delete') continue;
          conflicts.push({ opId: op.id, displayLabel: op.displayLabel || `Pitch ${id}`, reason: 'deleted_on_server' });
        } else {
          const updatedAt = pitch.updatedAt;
          const serverUpdated = updatedAt ? new Date(updatedAt).getTime() : 0;
          if (serverUpdated > op.timestamp) {
            conflicts.push({
              opId: op.id,
              displayLabel: op.displayLabel || `Pitch: ${pitch.songName || ''} / ${pitch.singerName || ''}`,
              reason: 'modified_on_server',
              serverUpdatedAt: updatedAt?.toString(),
            });
          }
        }
      } else if (op.entity === 'session') {
        const session = await NamedSessionService.getSession(id);
        if (!session) {
          if (op.type === 'delete') continue;
          conflicts.push({ opId: op.id, displayLabel: op.displayLabel || `Session ${id}`, reason: 'deleted_on_server' });
        } else {
          const updatedAt = session.updatedAt;
          const serverUpdated = updatedAt ? new Date(updatedAt).getTime() : 0;
          if (serverUpdated > op.timestamp) {
            conflicts.push({
              opId: op.id,
              displayLabel: op.displayLabel || `Session: ${session.name}`,
              reason: 'modified_on_server',
              serverUpdatedAt: updatedAt?.toString(),
            });
          }
        }
      }
    } catch {
      // Network error or other - skip conflict check for this op
    }
  }

  return conflicts;
}

export function getOfflineQueue(): QueuedOperation[] {
  return getQueue();
}

export function getPendingCount(): number {
  return getQueue().length;
}

export function clearOfflineQueue(): void {
  saveQueue([]);
}

/**
 * Resolve temp IDs in a payload using the mapping
 */
function resolvePayload(
  payload: Record<string, unknown>,
  mapping: Map<string, string>,
  fields: string[]
): Record<string, unknown> {
  const resolved = { ...payload };
  for (const field of fields) {
    const val = resolved[field];
    if (typeof val === 'string' && mapping.has(val)) {
      (resolved as Record<string, string>)[field] = mapping.get(val)!;
    }
  }
  return resolved;
}

/**
 * Process the offline queue and sync to server.
 * Call when app comes back online.
 */
export async function processOfflineQueue(
  onProgress?: (op: QueuedOperation, status: 'syncing' | 'success' | 'failed') => void
): Promise<{ synced: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const tempToReal = new Map<string, string>();
  let synced = 0;
  let failed = 0;

  // Process in dependency order: songs, singers, pitches, sessions
  const order: OfflineEntity[] = ['song', 'singer', 'pitch', 'session'];
  const remaining = [...queue];

  for (const entity of order) {
    const ops = remaining.filter((o) => o.entity === entity);
    for (const op of ops) {
      onProgress?.(op, 'syncing');
      try {
        if (op.type === 'create') {
          if (entity === 'song') {
            const song = await songService.createSong(op.payload as any);
            if (op.tempId && song) {
              tempToReal.set(op.tempId, song.id);
              globalEventBus.dispatch('songDeleted', { type: 'songDeleted', song: { id: op.tempId } as Song });
              globalEventBus.dispatch('songCreated', { type: 'songCreated', song });
            }
          } else if (entity === 'singer') {
            const singer = await singerService.createSinger(op.payload as any);
            if (op.tempId && singer) {
              tempToReal.set(op.tempId, singer.id);
              globalEventBus.dispatch('singerDeleted', { type: 'singerDeleted', singer: { id: op.tempId } as Singer, centerIds: singer.centerIds || [] });
              globalEventBus.dispatch('singerCreated', { type: 'singerCreated', singer, centerIds: singer.centerIds || [] });
            }
          } else if (entity === 'pitch') {
            const resolved = resolvePayload(op.payload, tempToReal, ['songId', 'singerId']);
            const pitch = await pitchService.createPitch(resolved as any);
            if (op.tempId && pitch) {
              tempToReal.set(op.tempId, pitch.id);
              globalEventBus.dispatch('pitchDeleted', { type: 'pitchDeleted', pitch: { id: op.tempId } as SongSingerPitch });
              globalEventBus.dispatch('pitchCreated', { type: 'pitchCreated', pitch });
            }
          } else if (entity === 'session') {
            const resolved = resolvePayload(op.payload, tempToReal, []);
            const items = (resolved.items as Array<{ songId: string; singerId?: string; pitch?: string }>) || [];
            const resolvedItems = items.map((item) => ({
              ...item,
              songId: tempToReal.get(item.songId) || item.songId,
              singerId: item.singerId ? tempToReal.get(item.singerId) || item.singerId : undefined,
            }));
            const session = await NamedSessionService.createSession({
              name: resolved.name as string,
              description: resolved.description as string,
              centerIds: resolved.centerIds as number[],
            });
            if (session) {
              if (resolvedItems.length > 0) {
                await NamedSessionService.setSessionItems(session.id, resolvedItems);
              }
              if (op.tempId) {
                tempToReal.set(op.tempId, session.id);
              }
              globalEventBus.dispatch('dataRefreshNeeded', { type: 'dataRefreshNeeded', resource: 'all' });
            }
          }
        } else if (op.type === 'update') {
          let id = (op.payload.id as string) || (op.payload.sessionId as string) || '';
          if (entity === 'session') {
            id = tempToReal.get(id) || id;
          }
          if (entity === 'song') {
            const { id: _id, ...input } = op.payload;
            const song = await songService.updateSong(id, input as any);
            if (song) globalEventBus.dispatch('songUpdated', { type: 'songUpdated', song });
          } else if (entity === 'singer') {
            const { id: _id, ...input } = op.payload;
            const singer = await singerService.updateSinger(id, input as any);
            if (singer) globalEventBus.dispatch('singerUpdated', { type: 'singerUpdated', singer, centerIdsRemoved: [], centerIdsAdded: [] });
          } else if (entity === 'pitch') {
            const { id: _id, ...input } = op.payload;
            const pitch = await pitchService.updatePitch(id, input as any);
            if (pitch) globalEventBus.dispatch('pitchUpdated', { type: 'pitchUpdated', pitch });
          } else if (entity === 'session') {
            const { items, name, description, centerIds } = op.payload;
            if (name !== undefined || description !== undefined || centerIds !== undefined) {
              await NamedSessionService.updateSession(id, { name, description, centerIds } as any);
            }
            if (items && Array.isArray(items)) {
              const resolvedItems = (items as Array<{ songId: string; singerId?: string; pitch?: string }>).map((item) => ({
                ...item,
                songId: tempToReal.get(item.songId) || item.songId,
                singerId: item.singerId ? tempToReal.get(item.singerId) || item.singerId : undefined,
              }));
              await NamedSessionService.setSessionItems(id, resolvedItems);
            }
            globalEventBus.dispatch('dataRefreshNeeded', { type: 'dataRefreshNeeded', resource: 'all' });
          }
        } else if (op.type === 'delete') {
          const id = op.payload.id as string;
          if (entity === 'song') {
            await songService.deleteSong(id);
            globalEventBus.dispatch('songDeleted', { type: 'songDeleted', song: { id } as Song });
          } else if (entity === 'singer') {
            await singerService.deleteSinger(id);
            globalEventBus.dispatch('singerDeleted', { type: 'singerDeleted', singer: { id } as Singer, centerIds: [] });
          } else if (entity === 'pitch') {
            await pitchService.deletePitch(id);
            globalEventBus.dispatch('pitchDeleted', { type: 'pitchDeleted', pitch: { id } as SongSingerPitch });
          } else if (entity === 'session') {
            await NamedSessionService.deleteSession(id);
            globalEventBus.dispatch('dataRefreshNeeded', { type: 'dataRefreshNeeded', resource: 'all' });
          }
        }

        remaining.splice(remaining.indexOf(op), 1);
        saveQueue(remaining);
        synced++;
        onProgress?.(op, 'success');
      } catch (err) {
        console.error('Offline sync failed for', op, err);
        failed++;
        onProgress?.(op, 'failed');
      }
    }
  }

  return { synced, failed };
}
