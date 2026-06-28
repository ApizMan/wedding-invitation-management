import path from 'path';
import { Router, Request, Response } from 'express';
import { auth, db, bucket } from '../../database/firebase';
import { requireCustomer } from '../middleware/auth.middleware';
import { createWedding, getConfig } from '../../services/template.service';
import { TEMPLATES_META, DEFAULT_DESIGN_ID } from '../../services/template.types';
import { resolvePackage } from '../../services/package.service';
import { uploadImage, compressImage } from '../../services/upload.service';

const FRONTEND_CUSTOMER_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'customer');

export const customerRouter = Router();

// ── Signup ──
// Client creates the Firebase Auth user in-browser, then posts the ID token here so we can
// create the corresponding `users` doc with a server-assigned role (never trust a client-sent role).
// The token is echoed back so the client can persist it for Authorization: Bearer <token> calls.
customerRouter.post('/signup', async (req: Request, res: Response) => {
  const { idToken } = req.body;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const existing = await db.collection('users').doc(decoded.uid).get();
    if (!existing.exists) {
      await db.collection('users').doc(decoded.uid).set({
        uid: decoded.uid,
        email: decoded.email || '',
        name: decoded.name || decoded.email || '',
        role: 'customer',
        createdAt: new Date().toISOString(),
      });
    }
    res.json({
      success: true,
      idToken,
      user: { uid: decoded.uid, email: decoded.email || '', name: decoded.name || decoded.email || '', role: 'customer' },
    });
  } catch (err: any) {
    res.status(401).json({ error: 'Token tidak sah' });
  }
});

// ── Login ──
customerRouter.post('/login', async (req: Request, res: Response) => {
  const { idToken } = req.body;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Akaun tidak dijumpai. Sila daftar dahulu.' });
    }
    const data = userDoc.data() || {};
    const role = data.role === 'admin' ? 'admin' : 'customer';
    res.json({
      success: true,
      idToken,
      user: { uid: decoded.uid, email: decoded.email || '', name: data.name || decoded.name || decoded.email || '', role },
    });
  } catch (err: any) {
    res.status(401).json({ error: 'Token tidak sah' });
  }
});

// ── My Dashboard / Editor (unauthenticated page shell — client JS handles the auth check) ──
customerRouter.get('/my/dashboard', (req: Request, res: Response) => res.sendFile(path.join(FRONTEND_CUSTOMER_DIR, 'dashboard.html')));
customerRouter.get('/my/template/:id/edit', (req: Request, res: Response) => res.sendFile(path.join(FRONTEND_CUSTOMER_DIR, 'editor.html')));

customerRouter.get('/api/my/templates', requireCustomer, async (req: Request, res: Response) => {
  try {
    const uid = req.authUser!.uid;
    const config = await getConfig();
    const list = Object.entries(config)
      .filter(([, w]: [string, any]) => w.OWNER_UID === uid)
      .map(([id, w]: [string, any]) => ({
        id,
        name: w.name || 'Kad Jemputan Saya',
        package: resolvePackage(w.PACKAGE),
        purchaseStatus: w.PURCHASE_STATUS || 'pending',
        groomName: w.GROOM_NAME || '',
        brideName: w.BRIDE_NAME || '',
        slug: w.SLUG || '',
        preview: w.SLUG ? `/${w.SLUG}` : `/w/${id}`,
      }));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Checkout (manual/admin-assisted — creates a pending purchase, no payment gateway yet) ──
// multipart/form-data: fields `designId`, `package`, and file field `receipt` (proof of bank transfer).
customerRouter.post('/api/my/checkout', requireCustomer, uploadImage.single('receipt'), async (req: Request, res: Response) => {
  try {
    const uid = req.authUser!.uid;
    const { designId, package: pkgInput } = req.body;
    const pkg = resolvePackage(pkgInput);
    const finalDesignId = designId && TEMPLATES_META[designId] ? designId : DEFAULT_DESIGN_ID;

    if (!req.file) {
      return res.status(400).json({ error: 'Sila muat naik gambar resit pembayaran.' });
    }

    const { buffer, contentType } = await compressImage(req.file.buffer);
    const tempId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const storagePath = `receipts/${uid}/${tempId}.jpg`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, { contentType });
    await fileRef.makePublic();
    const receiptUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const id = await createWedding({
      name: 'Kad Jemputan Saya',
      DESIGN_ID: finalDesignId,
      OWNER_UID: uid,
      PACKAGE: pkg,
      PURCHASE_STATUS: 'pending',
      RECEIPT_URL: receiptUrl,
    });
    res.json({ success: true, id, message: 'Tempahan diterima! Sila tunggu pengesahan admin selepas pembayaran.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
