import { Router, Request, Response } from 'express';
import { db, bucket } from '../../database/firebase';
import { requireAuth } from '../middleware/auth.middleware';
import { getConfig, saveTemplate, createWedding } from '../../services/template.service';
import { isValidSlug, findTemplateBySlug } from '../../services/slug.service';
import { upload, compressAudio } from '../../services/audio.service';
import { uploadImage, compressImage } from '../../services/upload.service';
import { TEMPLATES_META, DEFAULT_DESIGN_ID } from '../../services/template.types';

export const apiRouter = Router();

apiRouter.get('/api/me', requireAuth, (req: Request, res: Response) => {
  res.json(req.session.user);
});

apiRouter.get('/api/templates', requireAuth, async (req: Request, res: Response) => {
  const config = await getConfig();
  const list = Object.entries(config).map(([id, w]: [string, any]) => {
    const designId = w.DESIGN_ID && TEMPLATES_META[w.DESIGN_ID] ? w.DESIGN_ID : DEFAULT_DESIGN_ID;
    return {
      id,
      name: w.name || 'Tanpa Nama',
      theme: TEMPLATES_META[designId]?.theme || '',
      designId,
      designName: TEMPLATES_META[designId]?.name || 'Design Tidak Sah',
      groomName: w.GROOM_NAME || '',
      brideName: w.BRIDE_NAME || '',
      date: w.EVENT_DATE_SHORT || '',
      slug: w.SLUG || '',
      preview: w.SLUG ? `/${w.SLUG}` : `/w/${id}`,
    };
  });
  res.json(list);
});

apiRouter.get('/api/designs', requireAuth, (req: Request, res: Response) => {
  res.json(Object.values(TEMPLATES_META));
});

apiRouter.post('/api/templates', requireAuth, async (req: Request, res: Response) => {
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

apiRouter.post('/api/template/:id/design', requireAuth, async (req: Request, res: Response) => {
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

apiRouter.post('/api/template/:id/rename', requireAuth, async (req: Request, res: Response) => {
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

apiRouter.post('/api/template/:id/slug', requireAuth, async (req: Request, res: Response) => {
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

apiRouter.post('/api/template/:id/music', requireAuth, upload.single('music'), async (req: Request, res: Response) => {
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

apiRouter.post('/api/template/:id/gift-qr', requireAuth, uploadImage.single('qr'), async (req: Request, res: Response) => {
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

apiRouter.post('/api/template/:id/gift-item-image', requireAuth, uploadImage.single('image'), async (req: Request, res: Response) => {
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

apiRouter.post('/api/template/:id/prewedding', requireAuth, uploadImage.single('photo'), async (req: Request, res: Response) => {
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

apiRouter.post('/api/template/:id/gift-item/:itemId/release', requireAuth, async (req: Request, res: Response) => {
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

apiRouter.get('/api/template/:id', requireAuth, async (req: Request, res: Response) => {
  const config = await getConfig();
  const id     = req.params.id as string;
  const data   = config[id];
  if (!data) return res.status(404).json({ error: 'Template tidak dijumpai' });
  res.json(data);
});

apiRouter.post('/api/template/:id/save', requireAuth, async (req: Request, res: Response) => {
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
apiRouter.get('/api/rsvps', requireAuth, async (req: Request, res: Response) => {
  const snapshot = await db.collection('rsvps').orderBy('submittedAt', 'desc').get();
  res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
});

// RSVP list for a single template (guest list page)
apiRouter.get('/api/template/:id/rsvps', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const snapshot = await db.collection('rsvps').where('templateId', '==', id).get();
  const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a: any, b: any) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  res.json(entries);
});
