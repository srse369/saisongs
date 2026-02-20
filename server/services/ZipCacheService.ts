/**
 * ZipCacheService - Compressed zip-based cache for offline entities
 *
 * Stores entities as gzip-compressed JSON in Maps. Serves as zip files for frontend.
 * Create/update/delete update only the affected entry - no full rebuild.
 *
 * Structure:
 * - songs-list: Map<id, gzip(lightSong)> - metadata without CLOBs
 * - songs-clobs: Map<id, gzip({lyrics,meaning,songTags})> - CLOBs only
 * - singers, pitches, templates, sessions, centers: Map<id, gzip(entity)>
 */

import { gzipSync, gunzipSync } from 'zlib';
import JSZip from 'jszip';
import databaseReadService from './DatabaseReadService.js';

function compress(data: object): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(data), 'utf8'), { level: 6 });
}

function decompress<T>(buf: Buffer): T {
  return JSON.parse(gunzipSync(buf).toString('utf8')) as T;
}

type EntityMap = Map<string, Buffer>;

class ZipCacheService {
  private songsList: EntityMap = new Map();
  private songsClobs: EntityMap = new Map();
  private singers: EntityMap = new Map();
  private pitches: EntityMap = new Map();
  private templates: EntityMap = new Map();
  private sessions: EntityMap = new Map();
  private centers: EntityMap = new Map();

  private zipCache: Map<string, { buffer: Buffer; timestamp: number }> = new Map();
  private readonly ZIP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

  private invalidateZip(entityKey: string): void {
    this.zipCache.delete(entityKey);
  }

  private async buildZipFromMap(map: EntityMap, entityKey: string): Promise<Buffer> {
    const cached = this.zipCache.get(entityKey);
    if (cached && Date.now() - cached.timestamp < this.ZIP_CACHE_TTL_MS) {
      return cached.buffer;
    }

    const zip = new JSZip();
    for (const [id, gzipBuf] of map) {
      zip.file(`${id}.json`, gzipBuf, { compression: 'STORE' });
    }

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
    });

    this.zipCache.set(entityKey, { buffer: buffer as Buffer, timestamp: Date.now() });
    return buffer as Buffer;
  }

  // ==================== SONGS ====================

  async loadSongsFromDb(): Promise<void> {
    const rows = await databaseReadService.getAllSongsWithClobsForCache();
    this.songsList.clear();
    this.songsClobs.clear();

    for (const row of rows) {
      const id = String(row.ID ?? row.id ?? '');
      if (!id) continue;

      const lightSong = {
        id,
        name: row.NAME ?? row.name,
        externalSourceUrl: row.EXTERNAL_SOURCE_URL ?? row.external_source_url,
        language: row.LANGUAGE ?? row.language,
        deity: row.DEITY ?? row.deity,
        tempo: row.TEMPO ?? row.tempo,
        beat: row.BEAT ?? row.beat,
        raga: row.RAGA ?? row.raga,
        level: row.SONG_LEVEL ?? row.song_level,
        audioLink: row.AUDIO_LINK ?? row.audio_link,
        goldenVoice: !!row.GOLDEN_VOICE,
        refGents: row.REFERENCE_GENTS_PITCH ?? row.reference_gents_pitch,
        refLadies: row.REFERENCE_LADIES_PITCH ?? row.reference_ladies_pitch,
        pitchCount: parseInt(row.PITCH_COUNT ?? row.pitch_count ?? '0', 10),
      };

      const clobs = {
        lyrics: row.LYRICS ?? row.lyrics ?? null,
        meaning: row.MEANING ?? row.meaning ?? null,
        songTags: row.SONG_TAGS ?? row.song_tags ?? null,
      };

      this.songsList.set(id, compress(lightSong));
      this.songsClobs.set(id, compress(clobs));
    }

    this.invalidateZip('songs-list');
    this.invalidateZip('songs-clobs');
  }

  getSong(id: string): { light: any; clobs: any } | null {
    const lightBuf = this.songsList.get(id);
    const clobsBuf = this.songsClobs.get(id);
    if (!lightBuf || !clobsBuf) return null;

    const light = decompress<any>(lightBuf);
    const clobs = decompress<any>(clobsBuf);
    return { light, clobs: { ...clobs } };
  }

  getSongFull(id: string): any | null {
    const merged = this.getSong(id);
    if (!merged) return null;
    return { ...merged.light, ...merged.clobs };
  }

  getAllSongsLight(): any[] {
    const result: any[] = [];
    for (const buf of this.songsList.values()) {
      result.push(decompress<any>(buf));
    }
    return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  getAllSongsWithClobs(): any[] {
    const result: any[] = [];
    for (const id of this.songsList.keys()) {
      const full = this.getSongFull(id);
      if (full) result.push(full);
    }
    return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  setSong(id: string, light: any, clobs: { lyrics?: string | null; meaning?: string | null; songTags?: string | null }): void {
    this.songsList.set(id, compress(light));
    this.songsClobs.set(id, compress(clobs));
    this.invalidateZip('songs-list');
    this.invalidateZip('songs-clobs');
  }

  deleteSong(id: string): void {
    this.songsList.delete(id);
    this.songsClobs.delete(id);
    this.invalidateZip('songs-list');
    this.invalidateZip('songs-clobs');
  }

  async getSongsListZip(): Promise<Buffer> {
    return this.buildZipFromMap(this.songsList, 'songs-list');
  }

  async getSongsClobsZip(): Promise<Buffer> {
    return this.buildZipFromMap(this.songsClobs, 'songs-clobs');
  }

  // ==================== OTHER ENTITIES ====================

  async loadSingersFromDb(): Promise<void> {
    const rows = await databaseReadService.getAllSingersForCache();
    this.singers.clear();
    for (const row of rows) {
      const id = String(row.ID ?? row.id ?? '');
      if (!id) continue;
      const data = this.mapSingerRow(row);
      this.singers.set(id, compress(data));
    }
    this.invalidateZip('singers');
  }

  private mapSingerRow(row: any): any {
    let centerIds: number[] = [];
    let editorFor: number[] = [];
    try {
      if (row.CENTER_IDS ?? row.center_ids) {
        centerIds = JSON.parse(row.CENTER_IDS ?? row.center_ids);
      }
    } catch {}
    try {
      if (row.EDITOR_FOR ?? row.editor_for) {
        editorFor = JSON.parse(row.EDITOR_FOR ?? row.editor_for);
      }
    } catch {}
    const isAdminVal = row.IS_ADMIN ?? row.is_admin ?? 0;
    return {
      id: row.ID ?? row.id,
      name: row.NAME ?? row.name,
      gender: row.GENDER ?? row.gender,
      email: row.EMAIL ?? row.email,
      isAdmin: isAdminVal === 1 || isAdminVal === '1' || isAdminVal === true,
      centerIds,
      editorFor,
      pitchCount: parseInt(row.PITCH_COUNT ?? row.pitch_count ?? '0', 10),
    };
  }

  async loadPitchesFromDb(): Promise<void> {
    const rows = await databaseReadService.getAllPitchesForCache();
    this.pitches.clear();
    for (const row of rows) {
      const id = String(row.ID ?? row.id ?? '');
      if (!id) continue;
      const data = this.mapPitchRow(row);
      this.pitches.set(id, compress(data));
    }
    this.invalidateZip('pitches');
  }

  private mapPitchRow(row: any): any {
    return {
      id: row.ID ?? row.id,
      songId: row.SONG_ID ?? row.song_id,
      singerId: row.SINGER_ID ?? row.singer_id,
      pitch: row.PITCH ?? row.pitch,
      songName: row.SONG_NAME ?? row.song_name,
      singerName: row.SINGER_NAME ?? row.singer_name,
    };
  }

  async loadTemplatesFromDb(): Promise<void> {
    const rows = await databaseReadService.getAllTemplatesForCache();
    this.templates.clear();
    for (const row of rows) {
      const id = String(row.ID ?? row.id ?? '');
      if (id === 'undefined' || id === 'null') continue;
      const data = this.mapTemplateRow(row);
      this.templates.set(id, compress(data));
    }
    this.invalidateZip('templates');
  }

  private mapTemplateRow(row: any): any {
    let centerIds: number[] | null = null;
    try {
      const raw = row.CENTER_IDS ?? row.center_ids;
      if (raw) centerIds = JSON.parse(raw);
    } catch {}
    return {
      id: row.ID ?? row.id,
      name: row.NAME ?? row.name,
      description: row.DESCRIPTION ?? row.description,
      templateJson: row.TEMPLATE_JSON ?? row.template_json,
      centerIds,
      isDefault: !!(row.IS_DEFAULT ?? row.is_default),
    };
  }

  async loadSessionsFromDb(): Promise<void> {
    const rows = await databaseReadService.getAllSessionsForCache();
    this.sessions.clear();
    for (const row of rows) {
      const id = String(row.ID ?? row.id ?? '');
      if (!id) continue;
      const data = this.mapSessionRow(row);
      this.sessions.set(id, compress(data));
    }
    this.invalidateZip('sessions');
  }

  private mapSessionRow(row: any): any {
    let centerIds: number[] | null = null;
    try {
      const raw = row.CENTER_IDS ?? row.center_ids;
      if (raw) centerIds = JSON.parse(raw);
    } catch {}
    return {
      id: row.ID ?? row.id,
      name: row.NAME ?? row.name,
      description: row.DESCRIPTION ?? row.description,
      centerIds,
      createdBy: row.CREATED_BY ?? row.created_by,
    };
  }

  async loadCentersFromDb(): Promise<void> {
    const rows = await databaseReadService.getAllCentersForCache();
    this.centers.clear();
    for (const row of rows) {
      const id = String(row.ID ?? row.id ?? '');
      if (id === 'undefined' || id === 'null') continue;
      const data = this.mapCenterRow(row);
      this.centers.set(id, compress(data));
    }
    this.invalidateZip('centers');
  }

  private mapCenterRow(row: any): any {
    return {
      id: row.ID ?? row.id,
      name: row.NAME ?? row.name,
      badgeTextColor: row.BADGE_TEXT_COLOR ?? row.badge_text_color,
    };
  }

  // Entity getters (decompress from map)
  getSinger(id: string): any | null {
    const buf = this.singers.get(id);
    return buf ? decompress<any>(buf) : null;
  }

  getPitch(id: string): any | null {
    const buf = this.pitches.get(id);
    return buf ? decompress<any>(buf) : null;
  }

  getTemplate(id: string): any | null {
    const buf = this.templates.get(id);
    return buf ? decompress<any>(buf) : null;
  }

  getSession(id: string): any | null {
    const buf = this.sessions.get(id);
    return buf ? decompress<any>(buf) : null;
  }

  getCenter(id: string): any | null {
    const buf = this.centers.get(id);
    return buf ? decompress<any>(buf) : null;
  }

  getAllSingers(): any[] {
    return Array.from(this.singers.values()).map((buf) => decompress<any>(buf));
  }

  getAllPitches(): any[] {
    return Array.from(this.pitches.values()).map((buf) => decompress<any>(buf));
  }

  getAllTemplates(): any[] {
    return Array.from(this.templates.values()).map((buf) => decompress<any>(buf));
  }

  getAllSessions(): any[] {
    return Array.from(this.sessions.values()).map((buf) => decompress<any>(buf));
  }

  getAllCenters(): any[] {
    return Array.from(this.centers.values()).map((buf) => decompress<any>(buf));
  }

  // Zip getters for frontend
  async getSingersZip(): Promise<Buffer> {
    return this.buildZipFromMap(this.singers, 'singers');
  }

  async getPitchesZip(): Promise<Buffer> {
    return this.buildZipFromMap(this.pitches, 'pitches');
  }

  async getTemplatesZip(): Promise<Buffer> {
    return this.buildZipFromMap(this.templates, 'templates');
  }

  async getSessionsZip(): Promise<Buffer> {
    return this.buildZipFromMap(this.sessions, 'sessions');
  }

  async getCentersZip(): Promise<Buffer> {
    return this.buildZipFromMap(this.centers, 'centers');
  }

  // Entity setters (update in place)
  setSinger(id: string, data: any): void {
    this.singers.set(id, compress(data));
    this.invalidateZip('singers');
  }

  setPitch(id: string, data: any): void {
    this.pitches.set(id, compress(data));
    this.invalidateZip('pitches');
  }

  setTemplate(id: string, data: any): void {
    this.templates.set(id, compress(data));
    this.invalidateZip('templates');
  }

  setSession(id: string, data: any): void {
    this.sessions.set(id, compress(data));
    this.invalidateZip('sessions');
  }

  setCenter(id: string, data: any): void {
    this.centers.set(id, compress(data));
    this.invalidateZip('centers');
  }

  deleteSinger(id: string): void {
    this.singers.delete(id);
    this.invalidateZip('singers');
  }

  deletePitch(id: string): void {
    this.pitches.delete(id);
    this.invalidateZip('pitches');
  }

  deleteTemplate(id: string): void {
    this.templates.delete(id);
    this.invalidateZip('templates');
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
    this.invalidateZip('sessions');
  }

  deleteCenter(id: string): void {
    this.centers.delete(id);
    this.invalidateZip('centers');
  }

  clear(): void {
    this.songsList.clear();
    this.songsClobs.clear();
    this.singers.clear();
    this.pitches.clear();
    this.templates.clear();
    this.sessions.clear();
    this.centers.clear();
    this.zipCache.clear();
  }
}

export const zipCacheService = new ZipCacheService();
export default zipCacheService;
