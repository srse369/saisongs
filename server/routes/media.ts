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
    
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(fullPath, { recursive: true });
      cb(null, fullPath);
    } catch (error) {
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
    
    // Generate URL for accessing the file
    // Files should be served from /pptx-media/ route
    const relativePath = destinationPath 
      ? `${destinationPath}/${req.file.filename}`
      : req.file.filename;
    
    // Construct full URL based on request
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const url = `${baseUrl}/pptx-media/${relativePath.replace(/\\/g, '/')}`;

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

export default router;
