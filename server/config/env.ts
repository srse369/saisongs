import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find project root - works in both dev (server/config/) and production (dist/server/config/)
// In dev: server/config/env.ts -> go up 2 levels to project root
// In production: dist/server/config/env.js -> go up 3 levels to project root
let projectRoot = path.join(__dirname, '../..');
if (__dirname.includes('dist/server/config')) {
  projectRoot = path.join(__dirname, '../../..');
}

// Load environment variables from project root IMMEDIATELY
// This file should be imported FIRST before any other local modules
const envLocalPath = path.join(projectRoot, '.env.local');
const envPath = path.join(projectRoot, '.env');

console.log('🔍 Loading environment from:');
console.log('   Project root:', projectRoot);
console.log('   .env.local:', envLocalPath);
console.log('   .env:', envPath);

dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

console.log('🔐 Environment loaded:');
console.log('   BREVO_API_KEY:', process.env.BREVO_API_KEY ? 'SET' : 'NOT SET');
console.log('   BREVO_SENDER_EMAIL:', process.env.BREVO_SENDER_EMAIL ? 'SET' : 'NOT SET');
console.log('   BREVO_SENDER_NAME:', process.env.BREVO_SENDER_NAME ? 'SET' : 'NOT SET');
console.log('   SESSION_SECRET:', process.env.SESSION_SECRET ? 'SET' : 'NOT SET');
console.log('   PPTX_MEDIA_DIR:', process.env.PPTX_MEDIA_DIR || 'NOT SET (will use default)');

// Validate required environment variables
if (!process.env.BREVO_API_KEY) {
  console.warn('⚠️  WARNING: BREVO_API_KEY not configured!');
  console.warn('⚠️  Email OTP authentication will not work without Brevo API key');
}

if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  WARNING: SESSION_SECRET not set! Using default (INSECURE)');
  process.env.SESSION_SECRET = 'dev-session-secret-change-in-production';
}

// Set default PPTX media directory if not configured
if (!process.env.PPTX_MEDIA_DIR) {
  process.env.PPTX_MEDIA_DIR = path.join(projectRoot, 'public', 'pptx-media');
  console.log('ℹ️  Using default PPTX media directory:', process.env.PPTX_MEDIA_DIR);
}

export const PPTX_MEDIA_DIR = process.env.PPTX_MEDIA_DIR;

