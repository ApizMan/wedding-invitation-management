import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import path from 'path';
import { TEMPLATES_META } from '../services/template.types';
import { publicRouter } from './routes/public.routes';
import { adminRouter } from './routes/admin.routes';
import { apiRouter } from './routes/api.routes';

declare module 'express-session' {
  interface SessionData {
    user?: { uid: string; email: string; name: string };
  }
}

const app  = express();
const PORT = 3000;

const FRONTEND_TEMPLATES_DIR = path.join(__dirname, '..', '..', 'frontend', 'templates');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'rsvp-nafiz-atiqah-2026-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
}));

// Serve shared static assets (music, images, etc.)
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets')));

// Serve static assets per template (audio, images, etc.) — but NOT index.html
Object.keys(TEMPLATES_META).forEach(tid => {
  app.use(`/${tid}`, (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/' || req.path === '') return next(); // let our route handle it
    express.static(path.join(FRONTEND_TEMPLATES_DIR, tid))(req, res, next);
  });
});

// ── Routes ────────────────────────────────────────────────
app.use(adminRouter);
app.use(apiRouter);
app.use(publicRouter); // includes catch-all /:slug — must be mounted last

// ── Start ──
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   RSVP Wedding System — Server Berjalan  ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Jemputan : http://localhost:${PORT}/template_1 ║`);
  console.log(`║  Admin    : http://localhost:${PORT}/admin      ║`);
  console.log('╚══════════════════════════════════════════╝\n');
});
