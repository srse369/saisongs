/**
 * Media Upload Routes
 * Handles uploading media files to local server storage
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { PPTX_MEDIA_DIR } from '../config/env.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req: any, file: any, cb: any) => {
    const destinationPath = req.body.destinationPath || '';
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
    // Use original filename
    cb(null, file.originalname);
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
 * Upload a media file to local server storage
 */
router.post('/upload-media', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const destinationPath = req.body.destinationPath || '';
    
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
 * Get information about local storage
 */
router.get('/upload-media/storage-info', async (req: Request, res: Response) => {
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

/**
 * GET /api/proxy-media
 * Proxy external media files to bypass CORS restrictions
 * Usage: /api/proxy-media?url=https://example.com/image.jpg
 */
router.get('/proxy-media', async (req: Request, res: Response) => {
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
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    console.log('Proxying media:', url);
    
    // Fetch the external resource
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SongStudio/1.0)',
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
