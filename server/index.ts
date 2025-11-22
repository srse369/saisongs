import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import songsRouter from './routes/songs.js';
import singersRouter from './routes/singers.js';
import pitchesRouter from './routes/pitches.js';
import sessionsRouter from './routes/sessions.js';
import importMappingsRouter from './routes/importMappings.js';
import { warmupCache } from './services/CacheService.js';

// Load environment variables
// In production, load from .env, in development from .env.local
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env' : '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/songs', songsRouter);
app.use('/api/singers', singersRouter);
app.use('/api/pitches', pitchesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/import-mappings', importMappingsRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
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
      const { databaseService } = await import('./services/DatabaseService.js');
      
      // Initialize pool and test connection
      await databaseService.initialize();
      const isConnected = await databaseService.testConnection();
      
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
      const { databaseService } = await import('./services/DatabaseService.js');
      await databaseService.disconnect();
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
