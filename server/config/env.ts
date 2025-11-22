import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

// Load environment variables from project root IMMEDIATELY
// This file should be imported FIRST before any other local modules
dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, '.env') });

console.log('🔐 Environment loaded:');
console.log('   ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? `SET (${process.env.ADMIN_PASSWORD.length} chars)` : 'NOT SET');
console.log('   EDITOR_PASSWORD:', process.env.EDITOR_PASSWORD ? `SET (${process.env.EDITOR_PASSWORD.length} chars)` : 'NOT SET');

