import fs from 'fs';
import path from 'path';
import { db } from '../database/firebase';
import { escapeHtml, deceasedPrefixBlock, deceasedBadge } from '../utils/html.util';
import { renderThemeVars } from './theme.service';
import { TemplateConfig, TEMPLATES_META, DEFAULT_DESIGN_ID } from './template.types';
import { hasFeature, resolvePackage } from './package.service';

const FRONTEND_TEMPLATES_DIR = path.join(__dirname, '..', '..', 'frontend', 'templates');

export async function getConfig(): Promise<TemplateConfig> {
  const snapshot = await db.collection('templates').get();
  const config: TemplateConfig = {};
  snapshot.forEach(doc => { config[doc.id] = doc.data(); });
  return config;
}

export async function saveTemplate(tid: string, data: Record<string, unknown>): Promise<void> {
  await db.collection('templates').doc(tid).set(data, { merge: true });
}

export async function createWedding(data: Record<string, unknown>): Promise<string> {
  const docRef = await db.collection('templates').add({ DESIGN_ID: DEFAULT_DESIGN_ID, ...data });
  return docRef.id;
}

export async function deleteTemplate(tid: string): Promise<void> {
  await db.collection('templates').doc(tid).delete();
}

function renderScheduleHtml(schedule: any[]): string {
  if (!Array.isArray(schedule) || schedule.length === 0) return '';
  return schedule.map(item => `
            <div class="reveal flex gap-5 items-start">
              <div class="flex flex-col items-center gap-1 pt-1" style="min-width:48px;"><div class="tl-dot"></div></div>
              <div class="card-lift flex-1 border border-gold rounded-sm p-5" style="background:linear-gradient(145deg,#fdf8f0,#faf4e8);">
                <div class="flex flex-wrap items-center gap-3 mb-1"><span class="text-gold font-bold text-sm">${escapeHtml(item.TIME_START)}</span><span class="text-forest opacity-40 text-xs">—</span><span class="text-gold font-bold text-sm">${escapeHtml(item.TIME_END)}</span></div>
                <h4 class="font-playfair text-forest text-xl">${escapeHtml(item.TITLE)}</h4>
                <p class="text-forest text-sm opacity-70 mt-1 font-cormorant italic">${escapeHtml(item.LOC)}</p>
              </div>
            </div>`).join('\n');
}

function renderGiftItemsHtml(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items.map(item => {
    const reserved = !!item.RESERVED_BY;
    return `
          <div class="gift-item-card${reserved ? ' reserved' : ''}" data-gift-id="${escapeHtml(item.ID)}">
            <img src="${escapeHtml(item.IMAGE_URL)}" alt="${escapeHtml(item.NAME)}" class="gift-item-img" onerror="this.style.display='none'">
            <div class="gift-item-info">
              <p class="gift-item-name">${escapeHtml(item.NAME)}</p>
              ${reserved
                ? `<p class="gift-item-status reserved">✓ Sudah Ditempah</p>`
                : `<button type="button" class="gift-item-reserve-btn" onclick="openReserveForm('${escapeHtml(item.ID)}','${escapeHtml(item.NAME)}')">Tempah Barang Ini</button>`}
            </div>
          </div>`;
  }).join('\n');
}

function renderWishesHtml(wishes: any[]): string {
  if (!Array.isArray(wishes) || wishes.length === 0) {
    return '<p class="wish-empty">Belum ada ucapan. Jadilah yang pertama!</p>';
  }
  return wishes.map(w => `
          <div class="wish-card">
            <p class="wish-name">${escapeHtml(w.name)}</p>
            <p class="wish-message">${escapeHtml(w.message)}</p>
          </div>`).join('\n');
}

function renderPreweddingHtml(photos: any[], mode: string): string {
  if (!Array.isArray(photos) || photos.length === 0) return '';
  if (mode === 'slideshow') {
    const slides = photos.map((url, i) => `
            <div class="pw-slide${i === 0 ? ' active' : ''}" data-index="${i}"><img src="${escapeHtml(url)}" alt="Pre-Wedding ${i + 1}" loading="lazy"></div>`).join('\n');
    const dots = photos.map((_, i) => `<button class="pw-dot${i === 0 ? ' active' : ''}" onclick="pwGoTo(${i})"></button>`).join('');
    return `
      <div class="pw-slideshow" id="pw-slideshow">
        ${slides}
        <button class="pw-nav pw-prev" onclick="pwPrev()" aria-label="Sebelum">&#10094;</button>
        <button class="pw-nav pw-next" onclick="pwNext()" aria-label="Seterus">&#10095;</button>
      </div>
      <div class="pw-dots">${dots}</div>`;
  }
  return `
      <div class="pw-grid">
        ${photos.map((url, i) => `<div class="pw-grid-item"><img src="${escapeHtml(url)}" alt="Pre-Wedding ${i + 1}" loading="lazy" onclick="pwOpenLightbox(${i})"></div>`).join('\n')}
      </div>`;
}

function renderContactsHtml(contacts: any[]): string {
  if (!Array.isArray(contacts) || contacts.length === 0) return '';
  return contacts.map(c => `
          <a href="tel:${escapeHtml(c.TEL)}" class="contact-card reveal flex items-center gap-5 p-5 border border-gold rounded-sm cursor-pointer" style="background:linear-gradient(145deg,#fdf8f0,#f5edd6);text-decoration:none;">
            <div class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style="background:linear-gradient(135deg,#1a3d2b,#2d5a40);"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 3C3 3 5 1 7 3L9 7C9 7 7 9 8 10C9 11 11 13 12 13C13 13 14 11 14 11L17 13C17 13 19 15 17 17C15 19 6 17 3 12C0 7 3 3 3 3Z" fill="none" stroke="#c9a84c" stroke-width="1.4" stroke-linecap="round"/></svg></div>
            <div class="flex-1">
              <p class="text-gold text-xs tracking-widest uppercase mb-0.5">${escapeHtml(c.LABEL)}</p>
              <p class="font-playfair text-forest text-lg leading-tight">${escapeHtml(c.NAME)}</p>
              <p class="text-forest text-sm opacity-70 mt-0.5">${escapeHtml(c.PHONE)}</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" class="opacity-40 flex-shrink-0"><path d="M7 4l5 5-5 5" stroke="#1a3d2b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>`).join('\n');
}

export async function renderTemplate(wid: string, config: TemplateConfig): Promise<string> {
  const data = { ...config[wid] };

  // DESIGN_ID picks which visual layout (frontend/templates/{designId}/index.html) renders this wedding's data.
  let designId = data.DESIGN_ID && TEMPLATES_META[data.DESIGN_ID] ? data.DESIGN_ID : DEFAULT_DESIGN_ID;
  if (data.DESIGN_ID !== designId) {
    data.DESIGN_ID = designId;
    saveTemplate(wid, { DESIGN_ID: designId }).catch(() => {});
  }

  const html = fs.readFileSync(path.join(FRONTEND_TEMPLATES_DIR, designId, 'index.html'), 'utf8');

  // Package tier gates RSVP / Wishes / Custom Slug / Music / Pre-Wedding / Gift — docs created
  // before this system existed have no PACKAGE field and default to 'gold' so old demo weddings
  // don't regress.
  const pkg = resolvePackage(data.PACKAGE);

  data.TEMPLATE_ID = wid;
  data.MUSIC_URL = data.MUSIC_URL || '/assets/music/videoplayback.m4a';
  data.MUSIC_START_TIME = data.MUSIC_START_TIME ?? 89;
  data.MUSIC_ENABLED = hasFeature(pkg, 'MUSIC') && data.MUSIC_ENABLED !== 'false' ? 'true' : 'false';
  data.GIFT_ENABLED = hasFeature(pkg, 'GIFT') && data.GIFT_ENABLED !== 'false' ? 'true' : 'false';
  data.GIFT_NAV_DISPLAY = data.GIFT_ENABLED === 'false' ? 'none' : 'flex';
  data.RSVP_NAV_DISPLAY = hasFeature(pkg, 'RSVP') ? 'flex' : 'none';
  data.WISHES_NAV_DISPLAY = hasFeature(pkg, 'WISHES') ? 'flex' : 'none';

  // Handle Allahyarham prefix (groom side + bride side, each parent independently)
  data.GROOM_DAD_PREFIX_BLOCK   = deceasedPrefixBlock(data.GROOM_DAD_DECEASED === 'true');
  data.GROOM_DAD_DECEASED_BADGE = deceasedBadge(data.GROOM_DAD_DECEASED === 'true');
  data.GROOM_MOM_PREFIX_BLOCK   = deceasedPrefixBlock(data.GROOM_MOM_DECEASED === 'true');
  data.GROOM_MOM_DECEASED_BADGE = deceasedBadge(data.GROOM_MOM_DECEASED === 'true');
  data.BRIDE_DAD_PREFIX_BLOCK   = deceasedPrefixBlock(data.BRIDE_DAD_DECEASED === 'true');
  data.BRIDE_DAD_DECEASED_BADGE = deceasedBadge(data.BRIDE_DAD_DECEASED === 'true');
  data.BRIDE_MOM_PREFIX_BLOCK   = deceasedPrefixBlock(data.BRIDE_MOM_DECEASED === 'true');
  data.BRIDE_MOM_DECEASED_BADGE = deceasedBadge(data.BRIDE_MOM_DECEASED === 'true');

  // Al-Fatihah dua block: combine non-empty dua texts from any deceased parent
  const duaTexts = [data.GROOM_DAD_DUA, data.GROOM_MOM_DUA, data.BRIDE_DAD_DUA, data.BRIDE_MOM_DUA]
    .filter((t: any) => t && String(t).trim());
  data.ALFATIHAH_DUA = duaTexts.join(' ');
  data.ALFATIHAH_BLOCK_DISPLAY = duaTexts.length > 0 ? 'block' : 'none';

  // Wali (guardian) blocks — shown only if filled in
  data.GROOM_WALI_BLOCK = data.GROOM_WALI && String(data.GROOM_WALI).trim()
    ? `<div class="p-4 border border-gold border-opacity-40 rounded-sm" style="background:rgba(201,168,76,.04);"><p class="text-gold text-xs tracking-widest uppercase mb-1">Wali</p><p class="font-playfair text-forest text-lg">${escapeHtml(data.GROOM_WALI)}</p></div>`
    : '';
  data.BRIDE_WALI_BLOCK = data.BRIDE_WALI && String(data.BRIDE_WALI).trim()
    ? `<div class="p-4 border border-gold border-opacity-40 rounded-sm" style="background:rgba(201,168,76,.04);"><p class="text-gold text-xs tracking-widest uppercase mb-1">Wali</p><p class="font-playfair text-forest text-lg">${escapeHtml(data.BRIDE_WALI)}</p></div>`
    : '';

  data.SCHEDULE_HTML = renderScheduleHtml(data.SCHEDULE || []);
  data.CONTACTS_HTML = renderContactsHtml(data.CONTACTS || []);
  data.THEME_VARS = renderThemeVars(data);

  // Pre-Wedding gallery (grid or slideshow, admin-configurable display mode)
  const preweddingPhotos = hasFeature(pkg, 'PREWEDDING') && Array.isArray(data.PREWEDDING_PHOTOS) ? data.PREWEDDING_PHOTOS : [];
  data.PREWEDDING_ENABLED = hasFeature(pkg, 'PREWEDDING') && data.PREWEDDING_ENABLED === 'true' ? 'true' : 'false';
  data.PREWEDDING_DISPLAY_MODE = data.PREWEDDING_DISPLAY_MODE === 'slideshow' ? 'slideshow' : 'grid';
  data.PREWEDDING_HTML = renderPreweddingHtml(preweddingPhotos, data.PREWEDDING_DISPLAY_MODE);
  data.PREWEDDING_SECTION_DISPLAY = (data.PREWEDDING_ENABLED === 'true' && preweddingPhotos.length > 0) ? 'block' : 'none';
  data.PREWEDDING_PHOTOS_JSON = JSON.stringify(preweddingPhotos.map((u: any) => String(u))).replace(/</g, '\\u003c');

  // Physical gift delivery block (items + address) — only shown if at least 1 gift item is listed
  const giftItems = hasFeature(pkg, 'GIFT') && Array.isArray(data.GIFT_ITEMS) ? data.GIFT_ITEMS : [];
  // Backfill missing IDs (items saved before reservation feature existed) so reservation works immediately
  let giftItemsNeedBackfill = false;
  giftItems.forEach((item: any) => {
    if (!item.ID) {
      item.ID = 'gift_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      giftItemsNeedBackfill = true;
    }
  });
  if (giftItemsNeedBackfill) saveTemplate(wid, { GIFT_ITEMS: giftItems }).catch(() => {});
  data.GIFT_ITEMS_JSON = JSON.stringify(giftItems).replace(/</g, '\\u003c');
  data.GIFT_PHYSICAL_BLOCK = giftItems.length > 0
    ? `<p class="font-cormorant italic text-forest text-sm opacity-80 mb-3">Sekiranya ingin menghantar hadiah secara fizikal, berikut adalah antara pilihan barang yang kami idamkan. Tekan "Tempah Barang Ini" untuk menempah supaya tetamu lain tidak menghantar barang yang sama:</p>
      <div class="gift-items-grid" id="gift-items-grid">
        ${renderGiftItemsHtml(giftItems)}
      </div>
      <div class="reserve-form-box" id="reserve-form-box" style="display:none;">
        <p class="rf-title">Tempah: <span id="reserve-item-name"></span></p>
        <div class="bank-info-card" id="reserve-address-card" style="margin-bottom:14px;">
          <p class="bi-label">Alamat Penghantaran</p>
          <p class="bi-value" style="font-size:14px;line-height:1.5;">${data.GIFT_ADDRESS || ''}</p>
        </div>
        <p class="font-cormorant italic text-forest text-sm opacity-80 mb-3">Sila isi maklumat anda di bawah untuk mengesahkan tempahan.</p>
        <form onsubmit="submitReserve(event)">
          <div class="sheet-field"><label>Nama Penuh</label><input type="text" name="name" required></div>
          <div class="sheet-field"><label>No. Telefon</label><input type="tel" name="phone"></div>
          <button type="submit" class="sheet-submit-btn">Sahkan Tempahan</button>
          <button type="button" onclick="closeReserveForm()" style="width:100%;margin-top:8px;background:none;border:none;color:var(--color-forest);opacity:.6;font-size:13px;cursor:pointer;">Batal</button>
        </form>
        <div class="sheet-feedback" id="reserve-feedback"></div>
      </div>`
    : '';

  // Map links auto-generated from a single admin-entered address
  const mapAddress = String(data.MAP_ADDRESS || '').trim();
  const encodedAddress = encodeURIComponent(mapAddress);
  data.MAP_GOOGLE_URL = mapAddress ? `https://www.google.com/maps/search/?api=1&query=${encodedAddress}` : '';
  data.MAP_WAZE_URL = mapAddress ? `https://waze.com/ul?q=${encodedAddress}&navigate=yes` : '';

  if (hasFeature(pkg, 'WISHES')) {
    const wishesSnapshot = await db.collection('rsvps')
      .where('templateId', '==', wid)
      .where('type', '==', 'wish')
      .get();
    const wishes = wishesSnapshot.docs.map(doc => doc.data())
      .sort((a: any, b: any) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
    data.WISHES_HTML = renderWishesHtml(wishes);
  } else {
    data.WISHES_HTML = '';
  }

  return Object.entries(data).reduce((acc: string, [key, val]) => {
    if (typeof val === 'object') return acc; // skip arrays/objects (SCHEDULE, CONTACTS) — already rendered to HTML blocks above
    return acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val ?? ''));
  }, html);
}
