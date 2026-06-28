import nodemailer from 'nodemailer';

interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

interface PurchaseNotice {
  customerName: string;
  customerEmail: string;
  weddingName: string;
  designName: string;
  pkg: string;
  receiptUrl: string;
}

const EMAIL_FOOTER = `
---
KadJemputan — Sistem Kad Jemputan Digital
Email ini dihantar secara automatik, sila jangan balas terus.
Hubungi kami: nafizmansor@gmail.com | +6014-8206770 (WhatsApp)`;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendTelegramMessage(text: string, threadId?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // Plain text (no parse_mode) — URLs in the message can contain `_`/`.` which the legacy
  // Markdown parser misreads as unterminated formatting and silently rejects the request.
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (threadId) body.message_thread_id = Number(threadId);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${errBody}`);
  }
}

export async function sendContactEmail(payload: ContactMessage): Promise<void> {
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  if (!to || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  await transporter.sendMail({
    from: `KadJemputan <${process.env.GMAIL_USER}>`,
    to,
    replyTo: payload.email,
    subject: `[Hubungi Kami] Mesej baru daripada ${payload.name}`,
    text: `Nama: ${payload.name}\nEmail: ${payload.email}\n\nMesej:\n${payload.message}${EMAIL_FOOTER}`,
  });
}

export async function sendContactTelegram(payload: ContactMessage): Promise<void> {
  const text = `📩 Mesej Baru — Hubungi Kami\n\nNama: ${payload.name}\nEmail: ${payload.email}\n\n${payload.message}`;
  await sendTelegramMessage(text, process.env.TELEGRAM_TOPIC_CONTACT);
}

export async function sendPurchaseTelegram(payload: PurchaseNotice): Promise<void> {
  const text = `🛒 Tempahan Baru\n\nPelanggan: ${payload.customerName} (${payload.customerEmail})\nKad: ${payload.weddingName}\nDesign: ${payload.designName}\nPakej: ${payload.pkg.toUpperCase()}\nResit: ${payload.receiptUrl}`;
  await sendTelegramMessage(text, process.env.TELEGRAM_TOPIC_PURCHASE);
}

export async function sendPurchaseEmail(payload: PurchaseNotice): Promise<void> {
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  if (!to || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  await transporter.sendMail({
    from: `KadJemputan <${process.env.GMAIL_USER}>`,
    to,
    subject: `[Tempahan Baru] ${payload.customerName} — ${payload.pkg.toUpperCase()}`,
    text: `Tempahan baru diterima:\n\nPelanggan: ${payload.customerName} (${payload.customerEmail})\nKad: ${payload.weddingName}\nDesign: ${payload.designName}\nPakej: ${payload.pkg.toUpperCase()}\nResit: ${payload.receiptUrl}\n\nSila semak & sahkan pembayaran di admin dashboard.${EMAIL_FOOTER}`,
  });
}

interface ReceiptReuploadNotice {
  customerName: string;
  customerEmail: string;
  weddingName: string;
  pkg: string;
  receiptUrl: string;
}

export async function sendReceiptReuploadTelegram(payload: ReceiptReuploadNotice): Promise<void> {
  const text = `🔁 Resit Dimuat Naik Semula\n\nPelanggan: ${payload.customerName} (${payload.customerEmail})\nKad: ${payload.weddingName}\nPakej: ${payload.pkg.toUpperCase()}\nResit Baharu: ${payload.receiptUrl}\n\nKad ini sebelum ini DITOLAK — sila semak semula.`;
  await sendTelegramMessage(text, process.env.TELEGRAM_TOPIC_PURCHASE);
}

export async function sendReceiptReuploadEmail(payload: ReceiptReuploadNotice): Promise<void> {
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  if (!to || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  await transporter.sendMail({
    from: `KadJemputan <${process.env.GMAIL_USER}>`,
    to,
    subject: `[Resit Dimuat Naik Semula] ${payload.customerName} — ${payload.pkg.toUpperCase()}`,
    text: `Pelanggan telah muat naik semula resit pembayaran selepas tempahan mereka DITOLAK sebelum ini:\n\nPelanggan: ${payload.customerName} (${payload.customerEmail})\nKad: ${payload.weddingName}\nPakej: ${payload.pkg.toUpperCase()}\nResit Baharu: ${payload.receiptUrl}\n\nSila semak & sahkan pembayaran di admin dashboard.${EMAIL_FOOTER}`,
  });
}

interface PurchaseStatusNotice {
  customerEmail: string;
  weddingName: string;
  pkg: string;
  status: 'active' | 'rejected';
}

export async function sendPurchaseStatusEmail(payload: PurchaseStatusNotice): Promise<void> {
  if (!payload.customerEmail || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  const approved = payload.status === 'active';
  const subject = approved
    ? `Pembayaran Disahkan — ${payload.weddingName}`
    : `Pembayaran Dibatalkan — ${payload.weddingName}`;
  const body = approved
    ? `Tahniah! Pembayaran anda untuk kad jemputan "${payload.weddingName}" (Pakej ${payload.pkg.toUpperCase()}) telah disahkan oleh admin.\n\nAnda kini boleh log masuk dan mula mengedit kad jemputan anda.`
    : `Maaf, pembayaran anda untuk kad jemputan "${payload.weddingName}" (Pakej ${payload.pkg.toUpperCase()}) telah dibatalkan oleh admin.\n\nSila log masuk dan muat naik semula resit pembayaran yang sah, atau hubungi kami jika ada sebarang pertanyaan.`;

  await transporter.sendMail({
    from: `KadJemputan <${process.env.GMAIL_USER}>`,
    to: payload.customerEmail,
    subject,
    text: `${body}${EMAIL_FOOTER}`,
  });
}
