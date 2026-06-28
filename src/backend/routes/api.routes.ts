import { Router, Request, Response } from 'express';
import { db, bucket } from '../../database/firebase';
import { requireAdmin, requireCustomer, requireOwnership } from '../middleware/auth.middleware';
import { getConfig, saveTemplate, createWedding, deleteTemplate } from '../../services/template.service';
import { isValidSlug, findTemplateBySlug } from '../../services/slug.service';
import { upload, compressAudio } from '../../services/audio.service';
import { uploadImage, compressImage } from '../../services/upload.service';
import { TEMPLATES_META, DEFAULT_DESIGN_ID } from '../../services/template.types';
import { hasFeature, resolvePackage, sanitizeSaveByPackage, isWeddingComplete, PACKAGE_PRICES } from '../../services/package.service';
import { sendPurchaseStatusEmail } from '../../services/notify.service';

export const apiRouter = Router();

apiRouter.get('/api/me', requireAdmin, (req: Request, res: Response) => {
  res.json(req.authUser);
});

apiRouter.get('/api/templates', requireAdmin, async (req: Request, res: Response) => {
  const config = await getConfig();
  const list = Object.entries(config).map(([id, w]: [string, any]) => {
    const designId = w.DESIGN_ID && TEMPLATES_META[w.DESIGN_ID] ? w.DESIGN_ID : DEFAULT_DESIGN_ID;
    return {
      id,
      name: w.name || 'Tanpa Nama',
      theme: TEMPLATES_META[designId]?.theme || '',
      designId,
      designName: TEMPLATES_META[designId]?.name || 'Design Tidak Sah',
      designCode: TEMPLATES_META[designId]?.code || '',
      groomName: w.GROOM_NAME || '',
      brideName: w.BRIDE_NAME || '',
      date: w.EVENT_DATE_SHORT || '',
      slug: w.SLUG || '',
      preview: w.SLUG ? `/${w.SLUG}` : `/w/${id}`,
    };
  });
  res.json(list);
});

apiRouter.get('/api/designs', requireAdmin, (req: Request, res: Response) => {
  res.json(Object.values(TEMPLATES_META));
});

apiRouter.post('/api/templates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, designId } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Sila isi nama wedding' });
    }
    const finalDesignId = designId && TEMPLATES_META[designId] ? designId : DEFAULT_DESIGN_ID;
    const id = await createWedding({ name: String(name).trim(), DESIGN_ID: finalDesignId });
    res.json({ success: true, id, message: 'Wedding baru berjaya dicipta!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/design', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { designId } = req.body;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Wedding tidak dijumpai' });
    if (!designId || !TEMPLATES_META[designId]) return res.status(400).json({ error: 'Design tidak sah' });
    await saveTemplate(id, { DESIGN_ID: designId });
    res.json({ success: true, message: 'Design dikemas kini!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/rename', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Nama template tidak boleh kosong' });
    }
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    await saveTemplate(id, { name: String(name).trim() });
    res.json({ success: true, message: 'Nama template dikemas kini!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/slug', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const slug = String(req.body.slug ?? '').trim().toLowerCase();
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });

    if (!slug) {
      await saveTemplate(id, { SLUG: '' });
      return res.json({ success: true, message: 'URL custom dibuang. Menggunakan URL lalai.' });
    }

    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'URL tidak sah. Gunakan huruf kecil, nombor, dan tanda sengkang (-) sahaja.' });
    }

    const existing = await findTemplateBySlug(slug);
    if (existing && existing.id !== id) {
      return res.status(409).json({ error: 'URL ini sudah digunakan oleh template lain.' });
    }

    await saveTemplate(id, { SLUG: slug });
    res.json({ success: true, message: 'URL custom dikemas kini!', slug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/music', requireAdmin, upload.single('music'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    if (!req.file) return res.status(400).json({ error: 'Tiada fail muzik dihantar' });

    const compressed = await compressAudio(req.file.buffer);

    const storagePath = `music/${id}/${Date.now()}.m4a`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(compressed, { contentType: 'audio/mp4' });
    await fileRef.makePublic();
    const musicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    await saveTemplate(id, { MUSIC_URL: musicUrl });
    res.json({
      success: true,
      message: 'Muzik berjaya dimampatkan & dimuat naik!',
      musicUrl,
      originalSize: req.file.buffer.length,
      compressedSize: compressed.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/gift-qr', requireAdmin, uploadImage.single('qr'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    if (!req.file) return res.status(400).json({ error: 'Tiada fail imej dihantar' });

    const { buffer, contentType } = await compressImage(req.file.buffer);

    const storagePath = `gift-qr/${id}/${Date.now()}.jpg`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, { contentType });
    await fileRef.makePublic();
    const qrUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    await saveTemplate(id, { GIFT_QR_URL: qrUrl });
    res.json({ success: true, message: 'QR code berjaya dimuat naik!', qrUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/gift-item-image', requireAdmin, uploadImage.single('image'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    if (!req.file) return res.status(400).json({ error: 'Tiada fail imej dihantar' });

    const { buffer, contentType } = await compressImage(req.file.buffer);

    const storagePath = `gift-items/${id}/${Date.now()}.jpg`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, { contentType });
    await fileRef.makePublic();
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    res.json({ success: true, message: 'Gambar barang berjaya dimuat naik!', imageUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/prewedding', requireAdmin, uploadImage.single('photo'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    if (!req.file) return res.status(400).json({ error: 'Tiada fail imej dihantar' });

    const existing = Array.isArray(config[id].PREWEDDING_PHOTOS) ? config[id].PREWEDDING_PHOTOS : [];
    if (existing.length >= 10) {
      return res.status(400).json({ error: 'Maksimum 10 gambar Pre-Wedding dibenarkan.' });
    }

    const { buffer, contentType } = await compressImage(req.file.buffer);

    const storagePath = `prewedding/${id}/${Date.now()}.jpg`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, { contentType });
    await fileRef.makePublic();
    const photoUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const updated = [...existing, photoUrl];
    await saveTemplate(id, { PREWEDDING_PHOTOS: updated });
    res.json({ success: true, message: 'Gambar Pre-Wedding berjaya dimuat naik!', photoUrl, photos: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/gift-item/:itemId/release', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const itemId = req.params.itemId as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });

    const items: any[] = Array.isArray(config[id].GIFT_ITEMS) ? config[id].GIFT_ITEMS : [];
    const idx = items.findIndex((it) => it.ID === itemId);
    if (idx === -1) return res.status(404).json({ error: 'Barang tidak dijumpai' });

    items[idx] = { ...items[idx], RESERVED_BY: null };
    await saveTemplate(id, { GIFT_ITEMS: items });
    res.json({ success: true, message: 'Tempahan dibuang.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/api/template/:id', requireAdmin, async (req: Request, res: Response) => {
  const config = await getConfig();
  const id     = req.params.id as string;
  const data   = config[id];
  if (!data) return res.status(404).json({ error: 'Template tidak dijumpai' });
  res.json(data);
});

apiRouter.post('/api/template/:id/save', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    await saveTemplate(id, req.body);
    res.json({ success: true, message: 'Perubahan telah disimpan!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// RSVP list for admin
apiRouter.get('/api/rsvps', requireAdmin, async (req: Request, res: Response) => {
  const snapshot = await db.collection('rsvps').orderBy('submittedAt', 'desc').get();
  res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
});

// RSVP list for a single template (guest list page)
apiRouter.get('/api/template/:id/rsvps', requireAdmin, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const snapshot = await db.collection('rsvps').where('templateId', '==', id).get();
  const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a: any, b: any) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  res.json(entries);
});

// ── Admin: sales stats (revenue from active/approved purchases, by package) ──
apiRouter.get('/api/admin/sales-stats', requireAdmin, async (req: Request, res: Response) => {
  const config = await getConfig();
  const purchases = Object.values(config).filter((w: any) => !!w.OWNER_UID && w.PURCHASE_STATUS !== 'rejected');

  const byPackage: Record<string, { count: number; revenue: number }> = {
    bronze: { count: 0, revenue: 0 },
    platinum: { count: 0, revenue: 0 },
    gold: { count: 0, revenue: 0 },
  };
  let totalActive = 0;
  let totalPending = 0;
  let totalRevenue = 0;

  purchases.forEach((w: any) => {
    const pkg = resolvePackage(w.PACKAGE);
    const status = w.PURCHASE_STATUS || 'pending';
    if (status === 'active') {
      totalActive += 1;
      totalRevenue += PACKAGE_PRICES[pkg];
      byPackage[pkg].count += 1;
      byPackage[pkg].revenue += PACKAGE_PRICES[pkg];
    } else if (status === 'pending') {
      totalPending += 1;
    }
  });

  res.json({
    totalPurchases: purchases.length,
    totalActive,
    totalPending,
    totalRevenue,
    byPackage,
    prices: PACKAGE_PRICES,
  });
});

// ── Admin: pending purchases (manual payment approval) ──
apiRouter.get('/api/admin/pending-purchases', requireAdmin, async (req: Request, res: Response) => {
  const config = await getConfig();
  const list = Object.entries(config)
    .filter(([, w]: [string, any]) => w.PURCHASE_STATUS === 'pending')
    .map(([id, w]: [string, any]) => ({
      id,
      name: w.name || 'Tanpa Nama',
      ownerUid: w.OWNER_UID || '',
      package: resolvePackage(w.PACKAGE),
      groomName: w.GROOM_NAME || '',
      brideName: w.BRIDE_NAME || '',
      receiptUrl: w.RECEIPT_URL || '',
    }));
  res.json(list);
});

// ── Admin: customer overview (who bought what, with package & status) ──
apiRouter.get('/api/admin/customers', requireAdmin, async (req: Request, res: Response) => {
  try {
    const usersSnapshot = await db.collection('users').where('role', '==', 'customer').get();
    const config = await getConfig();

    const weddingsByOwner = new Map<string, any[]>();
    Object.entries(config).forEach(([id, w]: [string, any]) => {
      if (!w.OWNER_UID) return;
      const list = weddingsByOwner.get(w.OWNER_UID) || [];
      const designId = w.DESIGN_ID && TEMPLATES_META[w.DESIGN_ID] ? w.DESIGN_ID : DEFAULT_DESIGN_ID;
      const pkg = resolvePackage(w.PACKAGE);
      list.push({
        id,
        name: w.name || 'Tanpa Nama',
        package: pkg,
        purchaseStatus: w.PURCHASE_STATUS || 'pending',
        groomName: w.GROOM_NAME || '',
        brideName: w.BRIDE_NAME || '',
        designId,
        designName: TEMPLATES_META[designId]?.name || 'Design Tidak Sah',
        designCode: TEMPLATES_META[designId]?.code || '',
        slug: w.SLUG || '',
        preview: w.SLUG ? `/${w.SLUG}` : `/w/${id}`,
        receiptUrl: w.RECEIPT_URL || '',
        complete: isWeddingComplete(pkg, w),
      });
      weddingsByOwner.set(w.OWNER_UID, list);
    });

    const customers = usersSnapshot.docs.map(doc => {
      const u = doc.data();
      return {
        uid: u.uid,
        name: u.name || '',
        email: u.email || '',
        createdAt: u.createdAt || '',
        weddings: weddingsByOwner.get(u.uid) || [],
      };
    });
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function notifyPurchaseStatus(wedding: any, status: 'active' | 'rejected') {
  if (!wedding.OWNER_UID) return;
  const userDoc = await db.collection('users').doc(wedding.OWNER_UID).get();
  const customerEmail = userDoc.exists ? userDoc.data()?.email : '';
  if (!customerEmail) return;
  await sendPurchaseStatusEmail({
    customerEmail,
    weddingName: wedding.name || 'Kad Jemputan Saya',
    pkg: resolvePackage(wedding.PACKAGE),
    status,
  });
}

apiRouter.post('/api/template/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    await saveTemplate(id, { PURCHASE_STATUS: 'active' });
    notifyPurchaseStatus(config[id], 'active').catch(err => console.error('Gagal hantar email status pembelian:', err));
    res.json({ success: true, message: 'Pembelian disahkan. Pelanggan kini boleh mengedit kad mereka.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/reject', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    await saveTemplate(id, { PURCHASE_STATUS: 'rejected' });
    notifyPurchaseStatus(config[id], 'rejected').catch(err => console.error('Gagal hantar email status pembelian:', err));
    res.json({ success: true, message: 'Pembelian telah dibatalkan.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/template/:id/delete', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    await deleteTemplate(id);
    res.json({ success: true, message: 'Kad pelanggan telah dibuang.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Customer-scoped endpoints (own template only, package-gated) ──

apiRouter.get('/api/my/template/:id', requireCustomer, requireOwnership, async (req: Request, res: Response) => {
  const config = await getConfig();
  const id = req.params.id as string;
  const data = config[id];
  if (!data) return res.status(404).json({ error: 'Template tidak dijumpai' });
  res.json(data);
});

apiRouter.post('/api/my/template/:id/save', requireCustomer, requireOwnership, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    const pkg = resolvePackage(config[id].PACKAGE);
    const sanitized = sanitizeSaveByPackage(pkg, req.body);
    await saveTemplate(id, sanitized);
    res.json({ success: true, message: 'Perubahan telah disimpan!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/my/template/:id/slug', requireCustomer, requireOwnership, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    const pkg = resolvePackage(config[id].PACKAGE);
    if (!hasFeature(pkg, 'CUSTOM_SLUG')) {
      return res.status(403).json({ error: 'Pakej anda tidak termasuk Pautan Tersendiri.' });
    }

    const slug = String(req.body.slug ?? '').trim().toLowerCase();
    if (!slug) {
      await saveTemplate(id, { SLUG: '' });
      return res.json({ success: true, message: 'URL custom dibuang. Menggunakan URL lalai.' });
    }
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'URL tidak sah. Gunakan huruf kecil, nombor, dan tanda sengkang (-) sahaja.' });
    }
    const existing = await findTemplateBySlug(slug);
    if (existing && existing.id !== id) {
      return res.status(409).json({ error: 'URL ini sudah digunakan oleh template lain.' });
    }
    await saveTemplate(id, { SLUG: slug });
    res.json({ success: true, message: 'URL custom dikemas kini!', slug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/my/template/:id/music', requireCustomer, requireOwnership, upload.single('music'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    const pkg = resolvePackage(config[id].PACKAGE);
    if (!hasFeature(pkg, 'MUSIC')) return res.status(403).json({ error: 'Pakej anda tidak termasuk Muzik Latar.' });
    if (!req.file) return res.status(400).json({ error: 'Tiada fail muzik dihantar' });

    const compressed = await compressAudio(req.file.buffer);
    const storagePath = `music/${id}/${Date.now()}.m4a`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(compressed, { contentType: 'audio/mp4' });
    await fileRef.makePublic();
    const musicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    await saveTemplate(id, { MUSIC_URL: musicUrl });
    res.json({ success: true, message: 'Muzik berjaya dimampatkan & dimuat naik!', musicUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/my/template/:id/gift-qr', requireCustomer, requireOwnership, uploadImage.single('qr'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    const pkg = resolvePackage(config[id].PACKAGE);
    if (!hasFeature(pkg, 'GIFT')) return res.status(403).json({ error: 'Pakej anda tidak termasuk Hadiah.' });
    if (!req.file) return res.status(400).json({ error: 'Tiada fail imej dihantar' });

    const { buffer, contentType } = await compressImage(req.file.buffer);
    const storagePath = `gift-qr/${id}/${Date.now()}.jpg`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, { contentType });
    await fileRef.makePublic();
    const qrUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    await saveTemplate(id, { GIFT_QR_URL: qrUrl });
    res.json({ success: true, message: 'QR code berjaya dimuat naik!', qrUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/my/template/:id/gift-item-image', requireCustomer, requireOwnership, uploadImage.single('image'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    const pkg = resolvePackage(config[id].PACKAGE);
    if (!hasFeature(pkg, 'GIFT')) return res.status(403).json({ error: 'Pakej anda tidak termasuk Hadiah.' });
    if (!req.file) return res.status(400).json({ error: 'Tiada fail imej dihantar' });

    const { buffer, contentType } = await compressImage(req.file.buffer);
    const storagePath = `gift-items/${id}/${Date.now()}.jpg`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, { contentType });
    await fileRef.makePublic();
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    res.json({ success: true, message: 'Gambar barang berjaya dimuat naik!', imageUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/api/my/template/:id/prewedding', requireCustomer, requireOwnership, uploadImage.single('photo'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = await getConfig();
    if (!config[id]) return res.status(404).json({ error: 'Template tidak dijumpai' });
    const pkg = resolvePackage(config[id].PACKAGE);
    if (!hasFeature(pkg, 'PREWEDDING')) return res.status(403).json({ error: 'Pakej anda tidak termasuk Gambar Pre-Wedding.' });
    if (!req.file) return res.status(400).json({ error: 'Tiada fail imej dihantar' });

    const existing = Array.isArray(config[id].PREWEDDING_PHOTOS) ? config[id].PREWEDDING_PHOTOS : [];
    if (existing.length >= 10) {
      return res.status(400).json({ error: 'Maksimum 10 gambar Pre-Wedding dibenarkan.' });
    }

    const { buffer, contentType } = await compressImage(req.file.buffer);
    const storagePath = `prewedding/${id}/${Date.now()}.jpg`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, { contentType });
    await fileRef.makePublic();
    const photoUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const updated = [...existing, photoUrl];
    await saveTemplate(id, { PREWEDDING_PHOTOS: updated });
    res.json({ success: true, message: 'Gambar Pre-Wedding berjaya dimuat naik!', photoUrl, photos: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
