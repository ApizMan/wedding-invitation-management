import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { TEMPLATES_META } from '../services/template.types';
import { publicRouter } from './routes/public.routes';
import { adminRouter } from './routes/admin.routes';
import { apiRouter } from './routes/api.routes';
import { customerRouter } from './routes/customer.routes';
import { UploadedFile } from '../services/multipart.util';

type AuthUser = { uid: string; email: string; name: string; role: 'admin' | 'customer' };

// Auth is token-based (Firebase ID token via `Authorization: Bearer <token>`) — there is no
// server-side session. `req.authUser` is populated per-request by the auth middleware.
// `req.file` is populated by the busboy-based upload middleware (`singleFileUpload`, see
// services/multipart.util.ts) — not multer, which doesn't survive Cloud Functions' buffered
// `rawBody` request stream.
declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      file?: UploadedFile;
    }
  }
}

const app  = express();
const PORT = 3000;

const FRONTEND_TEMPLATES_DIR = path.join(__dirname, '..', '..', 'frontend', 'templates');
const FRONTEND_MARKETING_DIR = path.join(__dirname, '..', '..', 'frontend', 'marketing');
const FRONTEND_SHARED_DIR = path.join(__dirname, '..', '..', 'frontend', 'shared');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve shared static assets (music, images, etc.)
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets')));

// Serve shared marketing assets (CSS, JS) used by landing/catalog/package/faq/contact/profile pages
app.use('/marketing-assets', express.static(FRONTEND_MARKETING_DIR));

// Serve shared client-side auth helper (auth-client.js) used by admin/customer pages
app.use('/shared-assets', express.static(FRONTEND_SHARED_DIR));

// Serve static assets per DESIGN (visual layout), not per wedding — multiple weddings
// can share the same design folder's assets (audio, images, etc.), but NOT index.html.
Object.keys(TEMPLATES_META).forEach(tid => {
  app.use(`/${tid}`, (req: Request, res: Response, next) => {
    if (req.path === '/' || req.path === '') return next(); // let our route handle it
    express.static(path.join(FRONTEND_TEMPLATES_DIR, tid))(req, res, next);
  });
});

// ── Routes ────────────────────────────────────────────────
app.use(adminRouter);
app.use(customerRouter);
app.use(apiRouter);
app.use(publicRouter); // includes catch-all /:slug — must be mounted last

// ── Start (local dev only — Cloud Functions imports `app` directly without listening) ──
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║     RSVP Wedding System — Server Berjalan       ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  Landing  : http://localhost:${PORT}/              ║`);
    console.log(`║  Template : http://localhost:${PORT}/template_1    ║`);
    console.log(`║  Customer : http://localhost:${PORT}/profile        ║`);
    console.log(`║  Admin    : http://localhost:${PORT}/admin/login    ║`);
    console.log('╚════════════════════════════════════════════════╝\n');
  });
}

export default app;
