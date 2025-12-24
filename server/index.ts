// MUST BE FIRST: Load environment variables before any other local imports
import './config/env.js';

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import songsRouter from './routes/songs.js';
import singersRouter from './routes/singers.js';
import pitchesRouter from './routes/pitches.js';
import sessionsRouter from './routes/sessions.js';
import importMappingsRouter from './routes/importMappings.js';
import authRouter from './routes/auth.js';
import centersRouter from './routes/centers.js';
import analyticsRouter from './routes/analytics.js';
import feedbackRouter from './routes/feedback.js';
import templatesRouter from './routes/templates.js';
import mediaRouter from './routes/media.js';
import { requireAuth, requireEditor, requireAdmin } from './middleware/simpleAuth.js';
import { warmupCache, cacheService } from './services/CacheService.js';
import { OracleSessionStore } from './middleware/OracleSessionStore.js';
import { emailService } from './services/EmailService.js';
import { PPTX_MEDIA_DIR } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3111;

// Determine CORS origin based on environment
const getFrontendOrigin = () => {
  // If explicitly set, use that
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  
  // In production with nginx reverse proxy, frontend and backend are on same origin
  // Allow same-origin requests
  if (process.env.NODE_ENV === 'production') {
    return true; // Allow same-origin
  }
  
  // Development default
  return 'http://localhost:5111';
};

// Middleware
app.use(cors({
  origin: getFrontendOrigin(),
  credentials: true, // Allow cookies/session
}));

// Session middleware with Oracle persistent store
app.use(session({
  store: new OracleSessionStore(),
  secret: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: false, // Don't reset expiry on every request
  cookie: {
    // Only set secure:true if explicitly configured (for HTTPS)
    // Don't auto-enable in production if using HTTP
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true, // Prevent XSS
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax', // More permissive for production without HTTPS
    domain: process.env.COOKIE_DOMAIN || undefined, // Allow setting cookie domain for production
  },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Note: Analytics tracking is done client-side via /api/analytics/track endpoint

// Serve PowerPoint media files statically with CORS headers
console.log(`📁 Serving PowerPoint media from: ${PPTX_MEDIA_DIR}`);
app.use('/pptx-media', cors(), express.static(PPTX_MEDIA_DIR, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
  }
}));

// Health check endpoint with optional database stats
app.get('/api/health', async (req, res) => {
  try {
    const response: any = { 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    };

    // If query param requests stats, fetch them
    if (req.query.stats === 'true') {
      try {
        // Fetch counts for each entity
        const [centers, songs, users, pitches, templates, sessions] = await Promise.all([
          cacheService.getAllCenters(),
          cacheService.getAllSongs(),
          cacheService.getAllSingers(), // Users
          cacheService.getAllPitches(),
          cacheService.getAllTemplates(),
          cacheService.getAllSessions(),
        ]);

        response.stats = {
          centers: centers.length,
          songs: songs.length,
          users: users.length,
          pitches: pitches.length,
          templates: templates.length,
          sessions: sessions.length,
        };
      } catch (error) {
        console.error('Error fetching database stats:', error);
        // Include error details in response for debugging
        response.stats = null;
        response.statsError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Health check failed' 
    });
  }
});

// Cache reload endpoint (admin only)
app.post('/api/cache/reload', requireAdmin, async (req, res) => {
  try {
    console.log('[CACHE] Manual cache reload requested by:', req.user?.email);
    await warmupCache();
    res.json({ 
      success: true,
      message: 'Cache reloaded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CACHE] Error reloading cache:', error);
    res.status(500).json({ 
      success: false,
      message: error instanceof Error ? error.message : 'Failed to reload cache'
    });
  }
});

// Brevo API health check endpoint
app.get('/api/health/brevo', async (req, res) => {
  try {
    const healthStatus = await emailService.checkHealth();
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to check Brevo status',
      configured: false
    });
  }
});

// API Routes
// Public routes
app.use('/api/auth', authRouter);
app.use('/api/songs', songsRouter);  // Songs remain public
app.use('/api/sessions', sessionsRouter);  // Sessions public for presentation mode
app.use('/api/analytics', analyticsRouter);  // Analytics (routes handle their own auth)
app.use('/api/feedback', feedbackRouter);  // Feedback is public
app.use('/api/templates', templatesRouter);  // Templates public for presentation mode
app.use('/api/centers', centersRouter);  // Centers GET is public for UI, but POST/PUT/DELETE require admin (enforced in routes)
app.use('/api', mediaRouter);  // Media upload routes (handles own auth)

// Protected routes - requireEditor enforced at route level for granular control
app.use('/api/singers', singersRouter);  // Singer routes require editor/admin (enforced in route handlers)
app.use('/api/pitches', requireAuth, pitchesRouter);  // Pitch data is private
app.use('/api/import-mappings', requireAdmin, importMappingsRouter);  // Admin only

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  // Check if headers were already sent to avoid "Cannot set headers after they are sent" error
  if (res.headersSent) {
    console.error('[ERROR HANDLER] Headers already sent, cannot send error response');
    return next(err);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Oracle Instant Client: ${process.env.LD_LIBRARY_PATH || 'not configured'}`);
  
  // Initialize database and cache in background to avoid blocking server startup
  setTimeout(async () => {
    try {
      console.log('🔌 Initializing database connection pool...');
      const { databaseReadService } = await import('./services/DatabaseReadService.js');
      
      // Initialize pool and test connection
      await databaseReadService.initialize();
      const isConnected = await databaseReadService.testConnection();
      
      if (!isConnected) {
        console.log('⚠️  Database connection test failed - skipping cache warmup');
        return;
      }
      
      console.log('✅ Database connection pool ready');
      
      // Selective cache warmup - songs WITHOUT CLOBs + all singers/pitches/sessions
      // CLOBs fetched on-demand when viewing song details
      console.log('🔥 Starting selective cache warmup...');
      await warmupCache();
      console.log('✅ Selective cache warmup completed');
    } catch (error) {
      console.error('⚠️  Database initialization failed:', error instanceof Error ? error.message : error);
      console.log('⚠️  Application will continue, cache will be populated on first request');
    }
  }, 1000); // Start after 1 second delay
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  // Close HTTP server
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    // Close database connection pool
    try {
      const { databaseReadService } = await import('./services/DatabaseReadService.js');
      await databaseReadService.disconnect();
      console.log('✅ Database connection pool closed');
    } catch (error) {
      console.error('Error closing database pool:', error);
    }
    
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
