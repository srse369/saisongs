import fs from 'fs';
import path from 'path';
import { extractFromHtml } from '../server/services/SongExtractor.js';

async function run() {
  const samplePath = path.resolve(process.cwd(), 'scripts', 'sample_page.html');
  if (!fs.existsSync(samplePath)) {
    console.error('Place your sample HTML at scripts/sample_page.html');
    process.exit(1);
  }
  const html = fs.readFileSync(samplePath, 'utf8');
  const origin = 'https://sairhythms.sathyasai.org';
  const extracted = extractFromHtml(html, origin);
  console.log(JSON.stringify(extracted, null, 2));
}

run().catch(err => { console.error(err); process.exit(1); });
