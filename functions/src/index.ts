import { onRequest } from 'firebase-functions/v2/https';
import app from '../../src/backend/server';

export const api = onRequest({ invoker: 'public' }, app);
