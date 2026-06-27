import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { db } from '../database/firebase';

async function run() {
  const jsonPath = path.join(__dirname, '..', '..', 'data', 'templates.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  for (const [tid, config] of Object.entries(data)) {
    await db.collection('templates').doc(tid).set(config as Record<string, unknown>);
    console.log(`Dimigrasi: ${tid}`);
  }

  process.exit(0);
}

run();
