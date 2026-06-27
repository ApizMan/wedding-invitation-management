import multer from 'multer';
import sharp from 'sharp';

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Hanya fail imej dibenarkan'));
    }
    cb(null, true);
  },
});

// Compress + resize any uploaded image to a web-friendly JPEG before it ever reaches Storage
export async function compressImage(inputBuffer: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  const buffer = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  return { buffer, contentType: 'image/jpeg' };
}
