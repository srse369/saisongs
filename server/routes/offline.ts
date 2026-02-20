/**
 * Offline download route - batched endpoint for Take Offline feature
 * Returns all data (songs with lyrics, singers, pitches, templates) in one response.
 * All responses are gzip-compressed via Express compression middleware for efficient transfer.
 */

import express from 'express';
import { gzipSync } from 'zlib';
import { URL } from 'url';
import { Readable } from 'stream';
import { cacheService } from '../services/CacheService.js';
import { zipCacheService } from '../services/ZipCacheService.js';
import { databaseReadService } from '../services/DatabaseReadService.js';
import { requireEditor } from '../middleware/simpleAuth.js';

const router = express.Router();

/** Block private/localhost hosts to prevent SSRF. Allow localhost only when request is from localhost (dev). */
function isUrlAllowed(targetUrl: string, requestHost: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    const isRequestLocalhost = /localhost|127\.0\.0\.1|\[::1\]/.test(requestHost || '');
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return isRequestLocalhost;
    if (/^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Build the same payload as /download for a given user (used by both download and size) */
async function buildOfflinePayload(req: express.Request) {
  const user = (req as any).user;

  const [songs, allSingers, pitches, allTemplates, allSessions, centers] = await Promise.all([
    cacheService.getAllSongsWithClobs(),
    cacheService.getAllSingers(),
    cacheService.getAllPitches(),
    cacheService.getAllTemplates(),
    cacheService.getAllSessions(),
    cacheService.getAllCenters(),
  ]);

  let singers = allSingers;
  if (user?.role !== 'admin') {
    let accessibleCenterIds = getAccessibleCenterIds(user?.centerIds, user?.editorFor);
    if (user?.role === 'editor' && accessibleCenterIds.length === 0 && user?.email) {
      try {
        const freshUser = await databaseReadService.getUserByEmail(user.email);
        if (freshUser) {
          accessibleCenterIds = getAccessibleCenterIds(freshUser.centerIds, freshUser.editorFor);
        }
      } catch {
        // use session data as-is
      }
    }
    singers = allSingers.filter((singer: any) => {
      if (!singer.centerIds || singer.centerIds.length === 0) return true;
      return singer.centerIds.some((cid: number) => accessibleCenterIds.includes(cid));
    });
  }

  const templates = cacheService.filterByCenterAccess(
    allTemplates,
    user?.role || 'viewer',
    getAccessibleCenterIds(user?.centerIds, user?.editorFor)
  );

  // Filter sessions by user access (same logic as GET /sessions)
  let sessions: any[] = [];
  if (!user) {
    sessions = allSessions.filter((s: any) => !s.centerIds || s.centerIds.length === 0);
  } else if (user.role === 'admin') {
    sessions = allSessions;
  } else if (user.role === 'editor') {
    const editorCenterIds = user.editorFor || [];
    sessions = allSessions.filter((s: any) => {
      const sessionCenterIds = s.centerIds || [];
      return sessionCenterIds.length === 0 || sessionCenterIds.some((cid: number) => editorCenterIds.includes(cid));
    });
  } else if (user.role === 'viewer') {
    const userCenterIds = user.centerIds || [];
    sessions = allSessions.filter((s: any) => {
      const sessionCenterIds = s.centerIds || [];
      return sessionCenterIds.length === 0 || sessionCenterIds.some((cid: number) => userCenterIds.includes(cid)) || s.createdBy === user.email;
    });
  }

  // Fetch full session with items for each filtered session
  const sessionsWithItems = await Promise.all(
    sessions.map(async (s: any) => {
      const full = await cacheService.getSession(s.id);
      return full || s;
    })
  );

  return { songs, singers, pitches, templates, sessions: sessionsWithItems, centers };
}

/** Normalize to numbers and merge centerIds + editorFor for access check */
function getAccessibleCenterIds(centerIds: number[] | undefined, editorFor: number[] | undefined): number[] {
  const a = (centerIds || []).map((id: number | string) => Number(id)).filter((n) => !Number.isNaN(n));
  const b = (editorFor || []).map((id: number | string) => Number(id)).filter((n) => !Number.isNaN(n));
  return [...new Set([...a, ...b])];
}

/**
 * GET /api/offline/download
 * Returns all data needed for offline use in one batched response (gzip-compressed).
 * Requires editor or admin.
 */
router.get('/download', requireEditor, async (req, res) => {
  try {
    const payload = await buildOfflinePayload(req);
    res.json(payload);
  } catch (error) {
    console.error('Error preparing offline download:', error);
    res.status(500).json({
      error: 'Failed to prepare offline data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/proxy-media?url=<encoded-url>
 * Proxies media fetch server-side to avoid CORS. Used when Take Offline fails due to CORS.
 * Requires editor or admin.
 */
router.get('/proxy-media', requireEditor, async (req, res) => {
  try {
    const rawUrl = req.query.url as string;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    const targetUrl = decodeURIComponent(rawUrl);
    const requestHost = req.get('host') || '';
    if (!isUrlAllowed(targetUrl, requestHost)) {
      return res.status(400).json({ error: 'URL not allowed (blocked for security)' });
    }
    const proxyRes = await fetch(targetUrl, {
      headers: { 'User-Agent': 'SaiSongs-Offline/1.0' },
      redirect: 'follow',
    });
    if (!proxyRes.ok) {
      return res.status(proxyRes.status).json({ error: `Upstream returned ${proxyRes.status}` });
    }
    const contentType = proxyRes.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    if (proxyRes.body) {
      const stream = Readable.fromWeb(proxyRes.body);
      stream.on('error', (err) => {
        if (!res.headersSent) res.status(500).json({ error: 'Stream error', message: err.message });
        else console.warn('Proxy media stream error (client may have disconnected):', err.message);
      });
      stream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Proxy media error:', error);
    res.status(500).json({
      error: 'Failed to proxy media',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/offline/songs-batch
 * Fetches multiple songs with lyrics in one request (gzip-compressed).
 * Body: { ids: string[] }. Returns { songs: Song[] }.
 * Requires editor or admin. Efficient for caching lyrics when taking offline.
 */
router.post('/songs-batch', requireEditor, async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    const idList = Array.isArray(ids) ? ids : [];
    if (idList.length === 0) {
      return res.json({ songs: [] });
    }
    const songs = await Promise.all(idList.map((id: string) => cacheService.getSong(id)));
    const validSongs = songs.filter((s): s is NonNullable<typeof s> => s != null);
    res.json({ songs: validSongs });
  } catch (error) {
    console.error('Error fetching songs batch:', error);
    res.status(500).json({
      error: 'Failed to fetch songs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/deleted?since=<timestamp>
 * Returns IDs of entities deleted since the given timestamp (ms since epoch).
 * Used by clients to clean their offline cache. Requires editor or admin.
 * Requires deleted_entities table (run database/migration_deleted_entities.sql).
 */
router.get('/deleted', requireEditor, async (req, res) => {
  try {
    const sinceParam = req.query.since as string | undefined;
    const sinceMs = sinceParam ? parseInt(sinceParam, 10) : 0;
    if (isNaN(sinceMs) || sinceMs < 0) {
      return res.status(400).json({
        error: 'Invalid since parameter',
        message: 'Query param "since" must be a non-negative Unix timestamp in milliseconds',
      });
    }
    const since = new Date(sinceMs);
    const deleted = await databaseReadService.getDeletedEntitiesSince(since);
    res.json(deleted);
  } catch (error) {
    console.error('Error fetching deleted entities:', error);
    res.status(500).json({
      error: 'Failed to fetch deleted entities',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/songs-list.zip
 * Returns zip of all songs (metadata only, no CLOBs). For offline use.
 */
router.get('/songs-list.zip', requireEditor, async (req, res) => {
  try {
    const buffer = await zipCacheService.getSongsListZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="songs-list.zip"');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving songs-list.zip:', error);
    res.status(500).json({
      error: 'Failed to serve songs-list.zip',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/songs-clobs.zip
 * Returns zip of song CLOBs (lyrics, meaning, songTags) indexed by song id.
 */
router.get('/songs-clobs.zip', requireEditor, async (req, res) => {
  try {
    const buffer = await zipCacheService.getSongsClobsZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="songs-clobs.zip"');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving songs-clobs.zip:', error);
    res.status(500).json({
      error: 'Failed to serve songs-clobs.zip',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/singers.zip
 */
router.get('/singers.zip', requireEditor, async (req, res) => {
  try {
    const buffer = await zipCacheService.getSingersZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="singers.zip"');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving singers.zip:', error);
    res.status(500).json({
      error: 'Failed to serve singers.zip',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/pitches.zip
 */
router.get('/pitches.zip', requireEditor, async (req, res) => {
  try {
    const buffer = await zipCacheService.getPitchesZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="pitches.zip"');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving pitches.zip:', error);
    res.status(500).json({
      error: 'Failed to serve pitches.zip',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/templates.zip
 */
router.get('/templates.zip', requireEditor, async (req, res) => {
  try {
    const buffer = await zipCacheService.getTemplatesZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="templates.zip"');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving templates.zip:', error);
    res.status(500).json({
      error: 'Failed to serve templates.zip',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/sessions.zip
 */
router.get('/sessions.zip', requireEditor, async (req, res) => {
  try {
    const buffer = await zipCacheService.getSessionsZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="sessions.zip"');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving sessions.zip:', error);
    res.status(500).json({
      error: 'Failed to serve sessions.zip',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/centers.zip
 */
router.get('/centers.zip', requireEditor, async (req, res) => {
  try {
    const buffer = await zipCacheService.getCentersZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="centers.zip"');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving centers.zip:', error);
    res.status(500).json({
      error: 'Failed to serve centers.zip',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/offline/manifest
 * Returns a manifest of all elements in the offline download package.
 * Uses same data and filtering as /download. Requires editor or admin.
 */
router.get('/manifest', requireEditor, async (req, res) => {
  try {
    const payload = await buildOfflinePayload(req);
    const json = JSON.stringify(payload);
    const compressed = gzipSync(Buffer.from(json, 'utf8'), { level: 6 });

    const songsWithLyrics = payload.songs.filter(
      (s: { lyrics?: string | null }) => s?.lyrics != null && s.lyrics !== '' && String(s.lyrics).trim().length > 0
    ).length;
    const manifest = {
      sizeBytesCompressed: compressed.length,
      sizeBytesUncompressed: Buffer.byteLength(json, 'utf8'),
      songs: { count: payload.songs.length, withLyrics: songsWithLyrics },
      singers: { count: payload.singers.length },
      pitches: { count: payload.pitches.length },
      templates: { count: payload.templates.length },
      sessions: { count: payload.sessions.length },
      centers: { count: payload.centers.length },
    };

    res.json(manifest);
  } catch (error) {
    console.error('Error building offline manifest:', error);
    res.status(500).json({
      error: 'Failed to build offline manifest',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
