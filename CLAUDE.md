# CLAUDE.md

Panduan ini WAJIB dirujuk semula sebelum menamatkan sebarang tugasan dalam projek ini.

## Checklist sebelum tamat setiap tugasan

1. **Matikan semua local dev server yang dimulakan semasa sesi ini.**
   - Semak port 3000: `netstat -ano | grep ':3000' | grep LISTENING`
   - Jika ada proses, `taskkill //F //PID <pid>` untuk matikannya.
   - Jangan tinggalkan `npm run dev` / `nodemon` berjalan di background selepas kerja selesai, melainkan user secara eksplisit minta server kekal hidup untuk mereka uji.

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
| `/api/wish` | POST | tiada | Submit ucapan |
| `/api/wishes/:templateId` | GET | tiada | Senarai ucapan (live refresh) |
| `/api/template/:id/gift-items` | GET | tiada | Senarai barang hadiah |
| `/api/template/:id/gift-item/:itemId/reserve` | POST | tiada | Tempah barang hadiah (tetamu) |

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

## Bahasa & Gaya

- UI dan mesej ralat dalam Bahasa Melayu (ikut konvensyen sedia ada di seluruh codebase).
- Tiada komen kod melainkan menjelaskan KENAPA (constraint tersembunyi, workaround, invariant) — bukan APA.

## Log Perubahan

Selepas setiap tugasan selesai, tambah SATU baris ringkas di bawah (format: `- YYYY-MM-DD: <ringkasan 1 ayat>`). Jangan tulis ringkasan panjang/perenggan di sini — tujuannya supaya sesi akan datang nampak sejarah perubahan besar dengan pantas. Letak entri terbaru di ATAS.

- 2026-06-28: Tambah harga pakej (Bronze RM30/Platinum RM35/Gold RM50), susun semula gating ciri (RSVP & Ucapan kini gated mulai Platinum), tambah statistik jualan & hasil di admin dashboard.
- 2026-06-28: Tukar auth daripada cookie session kepada Firebase ID Token (Bearer) penuh — buang `express-session`, tambah `KJAuth` client helper, semua page jadi unauthenticated shell dengan proteksi di layer API.
- 2026-06-28: Cipta CLAUDE.md; buang butang "Cipta Wedding Baru" dari admin dashboard.
- 2026-06-28: Tambah upload resit pembayaran (compressed) semasa checkout customer; admin boleh lihat resit di dashboard.
- 2026-06-28: Tukar akaun admin lama kepada customer, cipta akaun admin baru `admin@kadjemputan.com`; tambah seksyen "Pelanggan & Pembelian" monitoring di admin dashboard.
- 2026-06-28: Pisahkan cookie session admin/customer (`admin.sid`/`customer.sid`) supaya boleh log masuk serentak dalam browser yang sama (kemudian digantikan token-based, lihat entri di atas).
- 2026-06-28: Bina sistem akaun pelanggan & package gating penuh (Fasa 2) — signup/login customer, role admin/customer, OWNER_UID pada wedding doc, package tier Bronze/Platinum/Gold dengan feature gating, customer editor & dashboard berasingan.
- 2026-06-28: Bina landing page pemasaran (Fasa 1) — Hero, Features, Category, Package, Reviews, Footer, sidebar nav, dwibahasa BM/EN, placeholder Catalog/Package/FAQ/Contact/Profile.
