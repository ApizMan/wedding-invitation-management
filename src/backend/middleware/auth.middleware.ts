import { NextFunction, Request, Response } from 'express';
import { auth, db } from '../../database/firebase';

// Verifies the Firebase ID token sent as `Authorization: Bearer <token>` on every protected
// API request — there is no server-side session; the token itself is the source of truth.
export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) return res.status(401).json({ error: 'Token tidak sah atau tiada.' });

  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const data = userDoc.exists ? userDoc.data() || {} : {};
    req.authUser = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: data.name || decoded.name || decoded.email || '',
      role: data.role === 'admin' ? 'admin' : 'customer',
    };
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Token tidak sah atau tiada.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  verifyToken(req, res, () => {
    if (req.authUser?.role === 'admin') return next();
    res.status(403).json({ error: 'Akaun ini bukan akaun admin.' });
  });
}

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  verifyToken(req, res, () => {
    if (req.authUser?.role === 'customer' || req.authUser?.role === 'admin') return next();
    res.status(403).json({ error: 'Sila log masuk sebagai pelanggan.' });
  });
}

// Loads the wedding doc for :id and checks the authenticated customer owns it.
// Admins bypass the ownership check entirely. Must run after requireCustomer.
export async function requireOwnership(req: Request, res: Response, next: NextFunction) {
  const user = req.authUser;
  if (!user) return res.status(401).json({ error: 'Token tidak sah atau tiada.' });
  if (user.role === 'admin') return next();

  try {
    const id = req.params.id as string;
    const snap = await db.collection('templates').doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Template tidak dijumpai' });
    const data = snap.data() || {};
    if (data.OWNER_UID !== user.uid) {
      return res.status(403).json({ error: 'Anda tidak mempunyai akses kepada template ini.' });
    }
    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
