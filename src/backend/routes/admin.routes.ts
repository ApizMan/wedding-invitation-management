import path from 'path';
import { Router, Request, Response } from 'express';
import { auth, db } from '../../database/firebase';

const FRONTEND_ADMIN_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'admin');

export const adminRouter = Router();

// Page routes are served unauthenticated — there is no server-side session to check on a plain
// browser navigation. Each page's client-side JS checks the stored Firebase token and fetches
// data via the (token-protected) API; an unauthenticated visitor sees an empty/loading shell
// before being redirected by JS.
adminRouter.get('/admin', (req: Request, res: Response) => res.redirect('/admin/dashboard'));
adminRouter.get('/admin/login', (req: Request, res: Response) => res.sendFile(path.join(FRONTEND_ADMIN_DIR, 'login.html')));
adminRouter.get('/admin/dashboard', (req: Request, res: Response) => res.sendFile(path.join(FRONTEND_ADMIN_DIR, 'dashboard.html')));
adminRouter.get('/admin/template/:id/edit', (req: Request, res: Response) => res.sendFile(path.join(FRONTEND_ADMIN_DIR, 'editor.html')));
adminRouter.get('/admin/template/:id/guests', (req: Request, res: Response) => res.sendFile(path.join(FRONTEND_ADMIN_DIR, 'guests.html')));

// Client signs in with Firebase Auth (email/password) in browser, then posts the ID token here.
// We confirm the role and echo the token back so the client can persist it for subsequent
// Authorization: Bearer <token> API calls — there is no server-side session.
adminRouter.post('/admin/login', async (req: Request, res: Response) => {
  const { idToken } = req.body;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const role = userDoc.exists ? userDoc.data()?.role : 'admin'; // legacy admins predate the users collection
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Akaun ini bukan akaun admin.' });
    }
    res.json({
      success: true,
      idToken,
      user: { uid: decoded.uid, email: decoded.email || '', name: decoded.name || decoded.email || '', role: 'admin' },
    });
  } catch (err: any) {
    res.status(401).json({ error: 'Token tidak sah' });
  }
});
