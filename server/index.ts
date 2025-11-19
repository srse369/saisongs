import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import songsRouter from './routes/songs.js';
import singersRouter from './routes/singers.js';
import pitchesRouter from './routes/pitches.js';
import sessionsRouter from './routes/sessions.js';

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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Oracle Instant Client: ${process.env.LD_LIBRARY_PATH || 'not configured'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
