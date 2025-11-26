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
console.log('   ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? 'SET' : 'NOT SET');
console.log('   EDITOR_PASSWORD:', process.env.EDITOR_PASSWORD ? 'SET' : 'NOT SET');
console.log('   VIEWER_PASSWORD:', process.env.VIEWER_PASSWORD ? 'SET' : 'NOT SET');

// Validate that at least one password is set
if (!process.env.ADMIN_PASSWORD && !process.env.EDITOR_PASSWORD && !process.env.VIEWER_PASSWORD) {
  console.warn('⚠️  WARNING: No authentication passwords configured!');
  console.warn('⚠️  Set ADMIN_PASSWORD, EDITOR_PASSWORD, or VIEWER_PASSWORD in your .env file');
}

