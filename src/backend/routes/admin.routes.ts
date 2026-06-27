import path from 'path';
import { Router, Request, Response } from 'express';
import { auth } from '../../database/firebase';
import { requireAuth } from '../middleware/auth.middleware';

const FRONTEND_ADMIN_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'admin');

export const adminRouter = Router();

// Redirect /admin → /admin/dashboard if logged in, else /admin/login
adminRouter.get('/admin', requireAuth, (req: Request, res: Response) => res.redirect('/admin/dashboard'));

// ── Login ──
adminRouter.get('/admin/login', (req: Request, res: Response) => {
  if (req.session.user) return res.redirect('/admin/dashboard');
  res.sendFile(path.join(FRONTEND_ADMIN_DIR, 'login.html'));
});

// Client signs in with Firebase Auth (email/password) in browser, then posts the ID token here.
adminRouter.post('/admin/login', async (req: Request, res: Response) => {
  const { idToken } = req.body;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.session.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || decoded.email || '',
    };
    res.json({ success: true });
  } catch (err: any) {
    res.status(401).json({ error: 'Token tidak sah' });
  }
});

adminRouter.get('/admin/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ── Dashboard ──
adminRouter.get('/admin/dashboard', requireAuth, (req: Request, res: Response) => {
  res.sendFile(path.join(FRONTEND_ADMIN_DIR, 'dashboard.html'));
});

// ── Editor ──
adminRouter.get('/admin/template/:id/edit', requireAuth, (req: Request, res: Response) => {
  res.sendFile(path.join(FRONTEND_ADMIN_DIR, 'editor.html'));
});

// ── Guest List ──
adminRouter.get('/admin/template/:id/guests', requireAuth, (req: Request, res: Response) => {
  res.sendFile(path.join(FRONTEND_ADMIN_DIR, 'guests.html'));
});
