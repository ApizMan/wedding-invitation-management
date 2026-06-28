import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';

// Local dev: load service account key from a file path (no Application Default
// Credentials on a dev machine). Cloud Functions/Cloud Run: K_SERVICE is injected by
// the platform, which provides ADC automatically — no key file needed or available there.
const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
const app = process.env.K_SERVICE
  ? initializeApp({ storageBucket: process.env.STORAGE_BUCKET_NAME })
  : (() => {
      if (!serviceAccountPath) {
        throw new Error('SERVICE_ACCOUNT_PATH tidak ditetapkan dalam .env');
      }
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      return initializeApp({
        credential: cert(serviceAccount),
        storageBucket: process.env.STORAGE_BUCKET_NAME,
      });
    })();

export const db = getFirestore(app);
export const auth = getAuth(app);
export const bucket = getStorage(app).bucket();
