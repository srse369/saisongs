/**
 * Media Upload Routes
 * Handles uploading media files to local server storage
 * Requires editor or admin (templates/media management)
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { PPTX_MEDIA_DIR } from '../config/env.js';
import { requireEditor } from '../middleware/simpleAuth.js';

const router = express.Router();

/** Sanitize destination path to prevent path traversal (block .., absolute paths, path separators) */
function sanitizeDestinationPath(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const normalized = path.normalize(raw).replace(/\\/g, '/');
  if (normalized.includes('..') || path.isAbsolute(normalized)) return '';
  return normalized.split('/').filter(Boolean).join('/');
}

/** Sanitize filename to prevent path traversal and invalid chars */
function sanitizeFilename(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'unnamed';
  const basename = path.basename(raw);
  if (!basename || basename.includes('..') || basename.includes('/') || basename.includes('\\')) {
    return 'unnamed';
  }
  return basename.replace(/[<>:"|?*]/g, '_') || 'unnamed';
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req: any, file: any, cb: any) => {
    const rawPath = req.body?.destinationPath || '';
    const destinationPath = sanitizeDestinationPath(rawPath);
    const fullPath = path.join(PPTX_MEDIA_DIR, destinationPath);
    
    console.log('Multer destination:', {
      destinationPath,
      PPTX_MEDIA_DIR,
      fullPath
    });
    
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(fullPath, { recursive: true });
      cb(null, fullPath);
    } catch (error) {
      console.error('Error creating destination directory:', error);
      cb(error as Error, fullPath);
    }
  },
  filename: (req: any, file: any, cb: any) => {
    cb(null, sanitizeFilename(file.originalname || ''));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * POST /api/upload-media
 * Upload a media file to local server storage. Requires editor or admin.
 */
router.post('/upload-media', requireEditor, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const destinationPath = sanitizeDestinationPath((req.body?.destinationPath as string) || '');
    
    console.log('Upload complete:', {
      filename: req.file.filename,
      destinationPath,
      filePath: req.file.path,
      size: req.file.size
    });
    
    // Generate URL for accessing the file
    // Files should be served from /pptx-media/ route
    const relativePath = destinationPath 
      ? `${destinationPath}/${req.file.filename}`
      : req.file.filename;
    
    // Use relative URL so it works on any domain (localhost, production, etc.)
    const url = `/pptx-media/${relativePath.replace(/\\/g, '/')}`;

    console.log('Generated URL:', url);

    res.json({
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error uploading media file:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/upload-media/storage-info
 * Get information about local storage. Requires editor or admin.
 */
router.get('/upload-media/storage-info', requireEditor, async (req: Request, res: Response) => {
  try {
    const stats = await fs.stat(PPTX_MEDIA_DIR).catch(() => null);
    
    res.json({
      mediaDir: PPTX_MEDIA_DIR,
      exists: stats !== null,
      isDirectory: stats?.isDirectory() || false,
    });
  } catch (error) {
    console.error('Error getting storage info:', error);
    res.status(500).json({ 
      error: 'Failed to get storage info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/** Block internal/private IPs and hosts to prevent SSRF */
function isBlockedUrl(parsedUrl: URL): boolean {
  const hostname = parsedUrl.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) return true;
  if (hostname.endsWith('.local')) return true;
  if (hostname === 'metadata.google.internal' || hostname === '169.254.169.254') return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4) {
    const [, a, b, c] = ipv4.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

/**
 * GET /api/proxy-media
 * Proxy external media files to bypass CORS restrictions. Requires editor or admin.
 * Blocks internal/private URLs to prevent SSRF.
 * Usage: /api/proxy-media?url=https://example.com/image.jpg
 */
router.get('/proxy-media', requireEditor, async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are supported' });
      }
      if (isBlockedUrl(parsedUrl)) {
        return res.status(400).json({ error: 'Internal and private URLs are not allowed' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    console.log('Proxying media:', url);
    
    // Fetch the external resource
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaiSongs/1.0)',
        'Accept': '*/*',
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch external media:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: 'Failed to fetch external media',
        status: response.status,
        statusText: response.statusText
      });
    }
    
    // Get content type and set appropriate headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    // Stream the response
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
    
  } catch (error) {
    console.error('Error proxying media:', error);
    res.status(500).json({ 
      error: 'Failed to proxy media',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
