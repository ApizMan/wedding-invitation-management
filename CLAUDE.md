# CLAUDE.md

Panduan ini WAJIB dirujuk semula sebelum menamatkan sebarang tugasan dalam projek ini.

## Checklist sebelum tamat setiap tugasan

WAJIB: sebelum lapor sebarang tugasan selesai, kembali rujuk & jalankan SEMUA langkah dalam checklist ini (bukan hanya langkah yang dirasakan relevan).

1. **Matikan HANYA local dev server yang dimulakan oleh Claude semasa sesi ini.**
   - Semak port 3000: `netstat -ano | grep ':3000' | grep LISTENING`
   - Jika proses itu dimulakan oleh Claude (background process/Bash tool semasa sesi ini), `taskkill //F //PID <pid>` untuk matikannya.
   - JANGAN matikan dev server yang user jalankan sendiri di terminal mereka (cth. `npm run dev` dengan nodemon) — biar ia restart secara automatik ikut file watcher, jangan sentuh proses tersebut.
   - Jangan tinggalkan dev server yang Claude mulakan berjalan di background selepas kerja selesai, melainkan user secara eksplisit minta server kekal hidup untuk mereka uji.

2. **Semua proses upload fail (gambar) MESTI dimampatkan (compress) sebelum disimpan ke Firebase Storage.**
   - Guna `compressImage()` dari [src/services/upload.service.ts](src/services/upload.service.ts) (resize max 1600px, JPEG quality 78) untuk SEMUA upload imej — resit pembayaran, gambar pre-wedding, QR code hadiah, gambar barang hadiah, dll.
   - Guna `compressAudio()` dari [src/services/audio.service.ts](src/services/audio.service.ts) untuk upload muzik (AAC 128kbps).
   - JANGAN simpan fail asal (uncompressed) terus ke Storage — sentiasa laluan melalui fungsi compress dahulu.
   - Jika menambah jenis upload baru, cipta endpoint yang ikut pattern sedia ada (multer memoryStorage → compress → upload ke bucket → simpan URL).

3. Jalankan `npx tsc --noEmit` untuk pastikan tiada ralat TypeScript sebelum lapor kerja selesai.

## Konteks Projek

Sistem SaaS kad jemputan digital (wedding/aqiqah/birthday/corporate) dengan:
- **Admin** (role `admin` dalam Firestore `users`): urus semua kad, sahkan pembayaran pelanggan.
- **Customer** (role `customer`): daftar akaun sendiri, beli pakej (Bronze/Platinum/Gold), edit kad sendiri sahaja.
- **Package gating**: ciri (Muzik, Ucapan, Pautan Tersendiri, Pre-Wedding, Hadiah) disekat ikut pakej — lihat [src/services/package.service.ts](src/services/package.service.ts) sebagai single source of truth.
- **Auth**: token-based penuh (Firebase ID Token via header `Authorization: Bearer <token>`) — TIADA server-side session/cookie. Client simpan token di `localStorage` selepas log masuk (`KJAuth.setStoredToken`, [frontend/shared/auth-client.js](frontend/shared/auth-client.js)), dan setiap panggilan API guna `KJAuth.authFetch()` yang auto-suntik header tersebut. Backend sahkan token setiap request via `verifyToken` ([src/backend/middleware/auth.middleware.ts](src/backend/middleware/auth.middleware.ts)). Page routes (HTML) diserve TANPA semakan auth di server — proteksi sepenuhnya di layer API; client JS check token tersimpan & redirect jika tiada/tidak sah.

## Struktur Fail Utama

- `frontend/marketing/` — landing page, catalog, package, faq, contact, profile (public-facing).
- `frontend/admin/` — dashboard & editor untuk admin (akses semua kad).
- `frontend/customer/` — dashboard & editor untuk customer (akses kad sendiri sahaja, package-gated).
- `frontend/templates/` — reka bentuk visual kad (template_1, dll) — dikongsi merentas wedding docs.
- `frontend/shared/auth-client.js` — helper client-side `KJAuth` (token storage, `authFetch`, `logout`) dikongsi semua page admin & customer.
- `src/backend/routes/` — `admin.routes.ts`, `customer.routes.ts`, `api.routes.ts`, `public.routes.ts`.
- `src/services/` — business logic (template, package, slug, upload, audio, theme).
- `functions/` — Cloud Functions wrapper untuk deploy ke Firebase Hosting (kod backend sebenar tetap di `src/`, TIADA duplication). `functions/src/index.ts` import `app` dari `src/backend/server.ts` dan bungkus dengan `onRequest()`. `functions/copy-assets.js` salin `frontend/` & `public/` ke `functions/lib/` semasa build supaya path `__dirname`-relatif dalam kod backend (cari fail HTML/assets) tetap resolve betul dalam Cloud Functions.

### Deploy ke Firebase Hosting + Cloud Functions

1. `src/backend/server.ts` export Express `app` (guna `if (require.main === module)` supaya `app.listen()` hanya jalan bila server.ts dijalankan terus — local dev via `npm run dev`/`npm start` — bukan bila di-import oleh Cloud Function).
2. **PENTING**: Env var custom (`SERVICE_ACCOUNT_PATH`, `STORAGE_BUCKET_NAME` dalam `.env`) TIDAK boleh guna prefix `FIREBASE_`/`X_GOOGLE_`/`EXT_` — prefix ini reserved oleh platform Firebase Functions dan akan buat function gagal load (`Failed to load environment variables from .env`).
3. `functions/.env` perlu disalin manual dari `.env` root (TIDAK auto-sync) — emulator/Cloud Functions baca env dari `functions/.env`, bukan root `.env`. Value dengan spasi (cth path Windows) perlu di-quote (`KEY="C:\path with space"`).
4. Sebelum deploy, jalankan `cd functions && npm run build` (compile TypeScript + copy assets) dan test dengan `firebase emulators:start --only functions,hosting`.
5. `firebase deploy --only hosting,functions` untuk deploy sebenar — perlukan Firebase plan **Blaze** (pay-as-you-go). **Status: project `wedd-inv-mangement` sudah di plan Blaze sejak 2026-06-28** — jangan tanya soalan ini lagi sebelum deploy, terus jalankan.
6. **PENTING (production)**: `functions/src/index.ts` `onRequest()` MESTI pass `{ invoker: 'public' }` — tanpa ni Cloud Run v2 return 403 Forbidden untuk semua request via Hosting rewrite (project policy tak auto-grant `allUsers` invoker lagi).
7. **PENTING (production)**: `src/database/firebase.ts` detect Cloud Functions runtime via env var `K_SERVICE` (auto-disuntik platform) — bila wujud, `initializeApp()` dipanggil TANPA `credential: cert(...)` supaya guna Application Default Credentials automatik. JANGAN cuba baca `SERVICE_ACCOUNT_PATH` dalam Cloud Functions — path fail lokal (laptop dev) tak wujud di server, akan crash function dengan `ENOENT`.
8. Domain custom (`kadjemputan.com`) disambung selepas deploy via Firebase Console → Hosting → Add custom domain (perlu DNS records di registrar domain — tindakan luar repo).

## Rujukan Route Penuh

### Customer (`src/backend/routes/customer.routes.ts`)
| Route | Method | Auth | Keterangan |
|---|---|---|---|
| `/signup` | POST | tiada (verify idToken) | Daftar akaun customer baru, pulangkan idToken+user |
| `/login` | POST | tiada (verify idToken) | Log masuk customer/admin, pulangkan idToken+user |
| `/my/dashboard` | GET | tiada (page shell) | Papar `frontend/customer/dashboard.html` |
| `/my/template/:id/edit` | GET | tiada (page shell) | Papar `frontend/customer/editor.html` |
| `/api/my/templates` | GET | `requireCustomer` | Senarai kad milik customer semasa |
| `/api/my/checkout` | POST | `requireCustomer` | Cipta wedding doc baru (pending) + upload resit (compressed) |
| `/api/my/template/:id` | GET | `requireCustomer, requireOwnership` | Data kad (api.routes.ts) |
| `/api/my/template/:id/save` | POST | `requireCustomer, requireOwnership` | Simpan perubahan kad (package-sanitized) |
| `/api/my/template/:id/slug` | POST | `requireCustomer, requireOwnership` | Tetapkan custom slug (perlu CUSTOM_SLUG feature) |
| `/api/my/template/:id/music` | POST | `requireCustomer, requireOwnership` | Upload muzik (compressed, perlu MUSIC feature) |
| `/api/my/template/:id/gift-qr` | POST | `requireCustomer, requireOwnership` | Upload QR hadiah (compressed, perlu GIFT feature) |
| `/api/my/template/:id/gift-item-image` | POST | `requireCustomer, requireOwnership` | Upload gambar barang hadiah (compressed) |
| `/api/my/template/:id/prewedding` | POST | `requireCustomer, requireOwnership` | Upload gambar pre-wedding (compressed, perlu PREWEDDING feature) |

### Template / Awam (`src/backend/routes/public.routes.ts`)
| Route | Method | Auth | Keterangan |
|---|---|---|---|
| `/` | GET | tiada | Landing page marketing |
| `/catalog`, `/package`, `/faq`, `/contact`, `/profile` | GET | tiada | Page marketing/profile |
| `/:designId` (cth `/template_1`) | GET | tiada | Render demo design |
| `/w/:weddingId` | GET | tiada | Render wedding by Firestore doc ID |
| `/:slug` | GET | tiada | Render wedding by custom slug (catch-all, mesti last) |
| `/api/rsvp` | POST | tiada | Submit kehadiran (RSVP) |
| `/api/contact` | POST | tiada | Submit borang Hubungi Kami (hantar email + Telegram via [src/services/notify.service.ts](src/services/notify.service.ts)) |
| `/api/wish` | POST | tiada | Submit ucapan |
| `/api/wishes/:templateId` | GET | tiada | Senarai ucapan (live refresh) |
| `/api/template/:id/gift-items` | GET | tiada | Senarai barang hadiah |
| `/api/template/:id/gift-item/:itemId/reserve` | POST | tiada | Tempah barang hadiah (tetamu) |
| `/api/template-previews` | GET | tiada | Senarai imej preview template (scan `public/assets/templates/`), untuk shuffle hero landing page |
| `/api/design-counts` | GET | tiada | Bilangan design siap setiap kategori (dari `TEMPLATES_META`), untuk seksyen Kategori landing page |

### Admin (`src/backend/routes/admin.routes.ts` + `api.routes.ts`)
| Route | Method | Auth | Keterangan |
|---|---|---|---|
| `/admin` | GET | tiada (redirect) | Redirect ke `/admin/dashboard` |
| `/admin/login` | GET | tiada (page shell) | Papar `frontend/admin/login.html` |
| `/admin/login` | POST | tiada (verify idToken) | Log masuk admin, pulangkan idToken+user |
| `/admin/dashboard` | GET | tiada (page shell) | Papar `frontend/admin/dashboard.html` |
| `/admin/template/:id/edit` | GET | tiada (page shell) | Papar `frontend/admin/editor.html` |
| `/admin/template/:id/guests` | GET | tiada (page shell) | Papar `frontend/admin/guests.html` |
| `/api/me` | GET | `requireAdmin` | Maklumat admin semasa |
| `/api/templates` | GET/POST | `requireAdmin` | Senarai/cipta wedding |
| `/api/designs` | GET | `requireAdmin` | Senarai design tersedia |
| `/api/template/:id/*` (design, rename, slug, music, gift-qr, gift-item-image, prewedding, save, rsvps) | GET/POST | `requireAdmin` | Edit penuh kad mana-mana customer (tanpa package gating) |
| `/api/admin/pending-purchases` | GET | `requireAdmin` | Senarai pembelian menunggu sah |
| `/api/admin/customers` | GET | `requireAdmin` | Senarai customer + kad mereka |
| `/api/template/:id/approve` | POST | `requireAdmin` | Sahkan pembayaran (PURCHASE_STATUS → active) |
| `/api/rsvps` | GET | `requireAdmin` | Semua RSVP merentas semua kad |

**Nota**: route GET halaman (page shells) sentiasa pulangkan 200 — auth check sebenar berlaku bila JS panggil `authFetch()` ke endpoint `/api/*`. Jika ubah/tambah route baru, kemaskini jadual ini.

## Cipta Design Kad Baharu (template_N)

Bila user beri spec design kad baharu dalam format: `Folder Name`, `Category`, `Code Template`, `Theme`, `Color`, `Entry Card/Landing Page` (gaya opening), dan `Details Card` (teks penuh jemputan — nama pengantin, tarikh, lokasi, aturcara, keluarga, kenalan, dll), ikut langkah ini:

1. **Cipta `frontend/templates/template_N/index.html`** — guna `template_2/index.html` sebagai rangka asas (satu fail HTML lengkap dengan CSS + JS terbenam, TIADA fail berasingan). WAJIB guna placeholder token sedia ada (`{{GROOM_NAME}}`, `{{BRIDE_NAME}}`, `{{AKAD_*}}`, `{{MAJLIS_*}}`, `{{SCHEDULE_HTML}}`, `{{CONTACTS_HTML}}`, `{{WISHES_HTML}}`, `{{PREWEDDING_HTML}}`, `{{GIFT_*}}`, `{{THEME_VARS}}`, `{{TEMPLATE_ID}}`, dll — lihat senarai penuh dalam `template_1`/`template_2`) supaya terus serasi dengan [src/services/template.service.ts](src/services/template.service.ts) tanpa ubah backend. Tukar hanya font, warna, animasi opening/ending, dan hiasan visual ikut tema yang diminta — jangan cipta placeholder baru melainkan benar-benar perlu.
2. **TIADA emoji** dalam design kad (🌸🦋🎉 dll) — semua hiasan visual (bunga, rama-rama, ornamen) WAJIB dilukis sebagai inline SVG mengikut palet warna tema (`var(--color-gold)`, warna custom tema), bukan character emoji. Emoji render tidak konsisten merentas platform/OS dan nampak tidak profesional untuk produk digital berbayar.
3. **Daftar dalam `TEMPLATES_META`** di [src/services/template.types.ts](src/services/template.types.ts) — `id`, `name` (nama design dalam BM), `theme`, `preview: '/template_N'`, `code` (ikut kategori: `WED0xx` wedding, `AQ0xx` aqiqah, `BYD0xx` birthday, `COR0xx` corporate — running number seterusnya dalam kategori sama), `category`.
4. **Tambah kad dalam katalog awam** `frontend/marketing/catalog.html` — copy struktur kad `template_2` (image preview, nama, kod, butang Demo `/template_N` + butang Pilih `openCheckout('template_N')`), letak `data-category` betul.
5. **Imej preview**: perlukan `public/assets/templates/preview_template_N.png` (screenshot design) — jika belum ada screenshot sebenar, maklumkan kepada user bahawa fail ini perlu diganti kemudian (jangan hasilkan imej palsu).
6. **Demo data ("Details Card")**: user's standing instruction — bila user beri spec "Details Card" (nama pengantin/tarikh/aturcara/keluarga/kenalan sebenar) semasa minta template baharu, WAJIB terus `set(..., { merge: true })` data tersebut ke dalam Firestore doc `templates/{template_N}` (guna `DESIGN_ID: 'template_N'` supaya `renderTemplate` papar design yang betul) supaya route demo `/template_N` terus papar kandungan sebenar — JANGAN tulis script "seeder" berasingan yang disimpan dalam repo; lakukan sebagai satu tindakan terus (one-off script buat & padam, atau terus guna Firestore Admin SDK dalam sesi) tanpa meninggalkan fail seeder kekal dalam codebase.
7. Jalankan checklist standard (langkah 1-3 di atas) sebelum lapor selesai.

## Bahasa & Gaya

- UI dan mesej ralat dalam Bahasa Melayu (ikut konvensyen sedia ada di seluruh codebase).
- Tiada komen kod melainkan menjelaskan KENAPA (constraint tersembunyi, workaround, invariant) — bukan APA.

## Log Perubahan

Selepas setiap tugasan selesai, tambah SATU baris ringkas di bawah (format: `- YYYY-MM-DD: <ringkasan 1 ayat>`). Jangan tulis ringkasan panjang/perenggan di sini — tujuannya supaya sesi akan datang nampak sejarah perubahan besar dengan pantas. Letak entri terbaru di ATAS.

- 2026-07-04: Betulkan opening screen `template_3` — tukar dari split-curtain minimalis kepada animasi buka sampul surat sebenar (flap 3D `rotateX`, kad jemputan meluncur keluar dari dalam sampul, seal wax coral yang pudar bila dibuka). Perkaya seksyen Hero yang sebelum ini terlalu kosong — tambah kad bertepi (framed card) dengan backdrop-blur, tekstur titik lembut, 4 hiasan sudut line-art (dulu 2), medallion ornament di atas, garis pemisah "&" antara nama, dan paparan lokasi majlis — supaya lebih graphic & intuitive berbanding whitespace kosong sebelum ini.

- 2026-07-04: Tambah auto-scroll perlahan (`startAutoScroll()`/`stopAutoScroll()`, ~36px/saat via `requestAnimationFrame`) selepas kad dibuka (`openInvitation()`) di ketiga-tiga template (`template_1`, `template_2`, `template_3`) — auto-scroll berhenti terus (`{ once: true }` pada `wheel`/`touchmove`/`keydown` arrow/PageUp/PageDown/Home/End/Space) sebaik sahaja user scroll secara manual, dan berhenti sendiri bila sampai hujung halaman.

- 2026-07-04: Redesign penuh tema `template_3` — buang tema "Taman Kanak-Kanak" (ungu/matcha/rama-rama) sepenuhnya, gantikan dengan tema minimalis putih + coral-red (`#e8574a`) merujuk reference design luaran (jemputan.me/preview/435/vin053, disahkan via screenshot user oleh kerana WebFetch tak boleh render SPA JS-heavy). Font baharu: Alex Brush (script nama pengantin), Jost (sans-serif label), Cormorant Garamond (serif italic). Opening screen kini split-curtain minimalis (dua panel kelabu terang + seal bulat putih di tengah, bukan sampul surat/gerbang). Hiasan burung walet & bunga peony line-art custom-drawn (inline SVG, bukan asset luar — tiada lesen untuk artwork reference) di empat penjuru hero & footer. Semua placeholder token & JS logic (RSVP, ucapan, hadiah, pre-wedding, muzik, countdown) dikekalkan tanpa ubah backend.

- 2026-07-04: Gantikan semua hiasan SVG rama-rama/bunga custom di `template_3` dengan asset sebenar user (`public/assets/images/template_3/butterfly_1.gif`, `many_butterfly.gif`, `garden_1.png`, `garden_2.png`) — `garden_2.png` (gerbang bunga) jadi latar belakang skrin pembukaan/gate di belakang sampul surat, `many_butterfly.gif` sebagai kelompok rama-rama berterbangan di atas gerbang, `garden_1.png` (pengantin berjalan melalui gerbang) jadi visual penutup di footer, `butterfly_1.gif` diguna berulang (dengan flip/saiz berbeza) merentas semua seksyen menggantikan SVG hiasan lama.

- 2026-07-04: Betulkan bug kritikal `renderTemplate()` (template.service.ts) yang sebabkan `/template_3` papar design template_1 — punca: wedding doc tanpa `DESIGN_ID` fallback ke `DEFAULT_DESIGN_ID` bukan ke id sendiri, jadi hit pertama pada `/template_3` tersimpan permanent `DESIGN_ID: 'template_1'` dalam Firestore; padam doc rosak & fallback kini utamakan `wid` sendiri jika ia design id yang sah. Gantikan SEMUA emoji dalam `template_3` dengan inline SVG (rama-rama/bunga custom ikut palet Ungu & Matcha) — emoji tidak konsisten merentas platform & tidak sesuai untuk produk berbayar. Seed Firestore doc `templates/template_3` terus dengan data "Details Card" sebenar (Muhammad Nafiz & Nur Atiqah) ikut arahan tetap user: data demo template mesti masuk terus ke Firestore doc design tersebut, bukan script seeder berasingan. Tambah rule "tiada emoji" & "demo data terus ke Firestore" dalam panduan "Cipta Design Kad Baharu" di CLAUDE.md.
- 2026-07-04: Tambah design kad ketiga `template_3` ("Taman Kanak-Kanak", tema Ungu & Matcha, kod WED003) di [frontend/templates/template_3/index.html](frontend/templates/template_3/index.html) — daftar dalam `TEMPLATES_META` & katalog awam; opening screen guna gaya "buka sampul surat" (envelope), hiasan rama-rama & bunga mekar merentas semua seksyen; belum ada `preview_template_3.png` sebenar (perlu screenshot). Tambah panduan "Cipta Design Kad Baharu" dalam CLAUDE.md supaya proses ini konsisten untuk template seterusnya.
- 2026-06-28: Deploy kemaskini ke production (`firebase deploy --only hosting,functions`) selepas tambah template_2 ke katalog dan opening screen/gate-transition — semua route utama (`/`, `/catalog`, `/template_1`, `/template_2`, `/admin/login`, `/api/template-previews`) disahkan 200 live di `https://kadjemputan.web.app`.
- 2026-06-28: Tambah template_2 ("Minimalis Sage", WED002) ke katalog awam (`frontend/marketing/catalog.html`) menggantikan placeholder "Bulan Sabit", guna preview `preview_template_2.png`; redesign opening screen template_2 jadi split-panel asimetri (berlainan konsep daripada template_1), tambah butang "Buka Jemputan" dengan animasi transisi gerbang terbuka (sliding split-panel); betulkan bug animation-shorthand collision yang sebabkan butang invisible; betulkan layout responsive (CSS Grid + width class idiomatic) untuk date/location text supaya tak terpotong di mobile.

- 2026-06-28: Tambah design kad kedua `template_2` ("Minimalis Sage", tema Sage & Terracotta, kod WED002) di [frontend/templates/template_2/index.html](frontend/templates/template_2/index.html) — daftar dalam `TEMPLATES_META`; guna placeholder/struktur JS sama macam template_1 supaya serasi terus dengan backend (RSVP, ucapan, hadiah, pre-wedding, music), tapi font (Marcellus/Jost) & animasi (line-draw reveal, drifting leaves, breathe pulse) berbeza.
- 2026-06-28: Deploy kemaskini ke production (`firebase deploy --only hosting,functions`) selepas user upgrade ke plan Blaze — termasuk fix semakan login sebelum buka modal checkout di catalog.html; semua route utama (`/`, `/catalog`, `/profile`, `/template_1`, `/admin/login`) disahkan 200 live.

- 2026-06-28: **Deploy pertama berjaya** ke `https://kadjemputan.web.app` (semua route /, /catalog, /api/*, /template_1, /admin/login disahkan 200 live). Dua isu production dibetulkan: (1) `src/database/firebase.ts` cuma load service account JSON dari fail path bila BUKAN Cloud Functions — dikesan via env var `K_SERVICE` (disuntik platform); dalam Cloud Functions guna `initializeApp()` tanpa credential supaya automatik pakai Application Default Credentials (fail path local tak wujud di server). (2) `functions/src/index.ts` `onRequest()` perlu `{ invoker: 'public' }` secara explicit — tanpa ni Cloud Run v2 function return 403 Forbidden bila diakses melalui Hosting rewrite (org policy terkini tak auto-grant `allUsers` invoker).

- 2026-06-28: Tambah Hosting site baharu `kadjemputan` (URL default `kadjemputan.web.app`) dalam project Firebase sedia ada (`wedd-inv-mangement` — Project ID tak ditukar, hanya Hosting site name); `firebase.json` `hosting.target` diset ke `kadjemputan`, `.firebaserc` ada mapping target. Site lama `wedd-inv-mangement.web.app` masih wujud tapi tak digunakan dalam deploy.

- 2026-06-28: Setup deploy Firebase Hosting + Cloud Functions (folder `functions/` baharu, wrap Express `app` dari `src/backend/server.ts` dengan `onRequest()`, `firebase.json` rewrite semua route ke function); rename env var `FIREBASE_SERVICE_ACCOUNT_PATH`/`FIREBASE_STORAGE_BUCKET` kepada `SERVICE_ACCOUNT_PATH`/`STORAGE_BUCKET_NAME` (prefix `FIREBASE_` reserved oleh platform Functions); buang placeholder `public/index.html`/`404.html` dari wizard `firebase init`. Disahkan berfungsi end-to-end via `firebase emulators:start` (semua route /, /catalog, /api/*, /admin/login, /template_1 return 200). Belum deploy sebenar — user belum upgrade Blaze plan & belum daftar domain kadjemputan.com.

- 2026-06-28: Tambah `/api/design-counts` (public.routes.ts) yang kira design siap mengikut kategori dari `TEMPLATES_META`; seksyen Kategori di landing page kini papar count sebenar (bukan hardcode 15/8/10/7).

- 2026-06-28: Kad hero shuffle di landing.html kini papar imej template sahaja (buang teks "Walimatul Urus"/"Ahmad & Aisyah"/dll); tukar label nav "Homepage" (BM) kepada "Halaman Utama" di semua page marketing (EN kekal "Homepage").

- 2026-06-28: Tambah endpoint `/api/template-previews` (public.routes.ts) yang scan `public/assets/templates/` secara dinamik; kad "WALIMATUL URUS" di hero landing page kini fade/shuffle automatik antara semua imej preview template setiap 4 saat.

- 2026-06-28: Tambah `/api/contact` (public.routes.ts) + [src/services/notify.service.ts](src/services/notify.service.ts) — borang Hubungi Kami kini hantar email (Gmail SMTP via nodemailer) & notifikasi Telegram bot. Tambah `<script auth-client.js>` yang hilang di package/faq/contact.html (punca butang Login/Register tak bertukar selepas log masuk); butang "Pilih Bronze/Platinum/Gold" di /package kini ke /catalog bila pengguna sudah log masuk. Kredensial GMAIL_USER/GMAIL_APP_PASSWORD/TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID disimpan di .env (gitignored).
- 2026-06-28: Tambah field `code`/`category` pada `TEMPLATES_META` (cth WED001 untuk Klasik Emerald); dedahkan sebagai `designCode` di `/api/templates`, `/api/admin/customers`, `/api/my/templates` dan papar di katalog/admin dashboard/customer dashboard; buang description ringkas ("Forest Green & Gold...") daripada kad katalog.
- 2026-06-28: Betulkan bug admin editor — pisahkan tab "Lokasi & Hadiah" jadi tab "Lokasi" (sentiasa ada, MAP_ADDRESS) & "Hadiah" (gated Gold); paksa `*_ENABLED=false` di saveTemplate() bila pakej tiada feature, supaya validasi/tab gated tak terbuka semula untuk Bronze/Platinum.
- 2026-06-28: Tambah package gating di admin editor (sama corak macam customer editor) — sembunyikan tab Pre-Wedding/Muzik/Hadiah dan field-group URL Custom ikut pakej wedding (`applyPackageGating()`).
- 2026-06-28: Buang bahagian "Design Kad Jemputan" (pertukaran design) dari admin editor; sembunyikan butang "Senarai Tetamu" di admin editor untuk pakej Bronze.
- 2026-06-28: Tambah `isWeddingComplete()` di package.service.ts dan field `complete` pada `/api/admin/customers`; sembunyikan butang Pratonton di admin dashboard untuk kad yang belum lengkap (padan dengan logik sekat Pratonton di editor).
- 2026-06-28: Sekat butang Pratonton (admin & customer editor) sehingga semua field text/textarea diisi, tukar label nav "Landing Page" kepada "Homepage", dan ubah suai katalog (search input penuh, filter di kiri, grid 5 lajur dengan search+filter berfungsi).
- 2026-06-28: Tambah harga pakej (Bronze RM30/Platinum RM35/Gold RM50), susun semula gating ciri (RSVP & Ucapan kini gated mulai Platinum), tambah statistik jualan & hasil di admin dashboard.
- 2026-06-28: Tukar auth daripada cookie session kepada Firebase ID Token (Bearer) penuh — buang `express-session`, tambah `KJAuth` client helper, semua page jadi unauthenticated shell dengan proteksi di layer API.
- 2026-06-28: Cipta CLAUDE.md; buang butang "Cipta Wedding Baru" dari admin dashboard.
- 2026-06-28: Tambah upload resit pembayaran (compressed) semasa checkout customer; admin boleh lihat resit di dashboard.
- 2026-06-28: Tukar akaun admin lama kepada customer, cipta akaun admin baru `admin@kadjemputan.com`; tambah seksyen "Pelanggan & Pembelian" monitoring di admin dashboard.
- 2026-06-28: Pisahkan cookie session admin/customer (`admin.sid`/`customer.sid`) supaya boleh log masuk serentak dalam browser yang sama (kemudian digantikan token-based, lihat entri di atas).
- 2026-06-28: Bina sistem akaun pelanggan & package gating penuh (Fasa 2) — signup/login customer, role admin/customer, OWNER_UID pada wedding doc, package tier Bronze/Platinum/Gold dengan feature gating, customer editor & dashboard berasingan.
- 2026-06-28: Bina landing page pemasaran (Fasa 1) — Hero, Features, Category, Package, Reviews, Footer, sidebar nav, dwibahasa BM/EN, placeholder Catalog/Package/FAQ/Contact/Profile.
