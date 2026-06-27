import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../database/firebase';
import { getConfig, renderTemplate } from '../../services/template.service';
import { RESERVED_SLUGS, findTemplateBySlug } from '../../services/slug.service';
import { TEMPLATES_META } from '../../services/template.types';

export const publicRouter = Router();

publicRouter.get('/', (req: Request, res: Response) => {
  res.redirect('/template_1');
});

// Render each fixed template dynamically
Object.keys(TEMPLATES_META).forEach(tid => {
  publicRouter.get(`/${tid}`, async (req: Request, res: Response) => {
    try {
      const config = await getConfig();
      res.send(await renderTemplate(tid, config));
    } catch (err: any) {
      res.status(500).send('Ralat memuatkan template: ' + err.message);
    }
  });
});

// Render template by custom slug (e.g. /nafiz-atiqah)
publicRouter.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  const slug = req.params.slug as string;
  if (RESERVED_SLUGS.has(slug)) return next();
  try {
    const found = await findTemplateBySlug(slug);
    if (!found) return next();
    const config = await getConfig();
    res.send(await renderTemplate(found.id, config));
  } catch (err: any) {
    res.status(500).send('Ralat memuatkan template: ' + err.message);
  }
});

// RSVP submission (public) — Kehadiran
publicRouter.post('/api/rsvp', async (req: Request, res: Response) => {
  try {
    const { templateId, name, phone, attendance, pax } = req.body;
    if (!templateId || !name || !attendance) {
      return res.status(400).json({ error: 'Maklumat tidak lengkap' });
    }
    await db.collection('rsvps').add({
      type: 'attendance',
      templateId,
      name,
      phone: phone || '',
      attendance,
      pax: pax || 1,
      submittedAt: new Date().toISOString(),
    });
    res.json({ success: true, message: 'Terima kasih! Kehadiran anda telah direkodkan.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Wishes list (public, for live refresh)
publicRouter.get('/api/wishes/:templateId', async (req: Request, res: Response) => {
  try {
    const templateId = req.params.templateId as string;
    const snapshot = await db.collection('rsvps')
      .where('templateId', '==', templateId)
      .where('type', '==', 'wish')
      .get();
    const wishes = snapshot.docs.map(doc => doc.data())
      .sort((a: any, b: any) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
    res.json(wishes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Gift items list (public, for live refresh of reserved state)
publicRouter.get('/api/template/:id/gift-items', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const snap = await db.collection('templates').doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Template tidak dijumpai' });
    const data = snap.data() || {};
    res.json(Array.isArray(data.GIFT_ITEMS) ? data.GIFT_ITEMS : []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reserve a physical gift item (public) — atomic check-and-set to prevent double-booking
publicRouter.post('/api/template/:id/gift-item/:itemId/reserve', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const itemId = req.params.itemId as string;
    const { name, phone } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Sila isi nama penuh' });
    }

    const docRef = db.collection('templates').doc(id);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return { error: 'Template tidak dijumpai', status: 404 };
      const data = snap.data() || {};
      const items: any[] = Array.isArray(data.GIFT_ITEMS) ? data.GIFT_ITEMS : [];
      const idx = items.findIndex((it) => it.ID === itemId);
      if (idx === -1) return { error: 'Barang tidak dijumpai', status: 404 };
      if (items[idx].RESERVED_BY) return { error: 'Maaf, barang ini sudah ditempah oleh tetamu lain.', status: 409 };

      const reservedBy = { name: String(name).trim(), phone: String(phone || '').trim(), reservedAt: new Date().toISOString() };
      items[idx] = { ...items[idx], RESERVED_BY: reservedBy };
      tx.update(docRef, { GIFT_ITEMS: items });
      return { items };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ success: true, message: 'Tempahan berjaya! Terima kasih.', items: result.items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Wishes submission (public) — Ucapan
publicRouter.post('/api/wish', async (req: Request, res: Response) => {
  try {
    const { templateId, name, message } = req.body;
    if (!templateId || !name || !message) {
      return res.status(400).json({ error: 'Maklumat tidak lengkap' });
    }
    await db.collection('rsvps').add({
      type: 'wish',
      templateId,
      name,
      message,
      submittedAt: new Date().toISOString(),
    });
    res.json({ success: true, message: 'Terima kasih! Ucapan anda telah dihantar.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
