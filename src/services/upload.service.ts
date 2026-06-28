import sharp from 'sharp';
import { singleFileUpload } from './multipart.util';

export const uploadImage = {
  single: (fieldName: string) =>
    singleFileUpload(fieldName, {
      maxFileSize: 5 * 1024 * 1024,
      fileFilter: (mimetype) => mimetype.startsWith('image/'),
    }),
};

// Compress + resize any uploaded image to a web-friendly JPEG before it ever reaches Storage
export async function compressImage(inputBuffer: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  const buffer = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  return { buffer, contentType: 'image/jpeg' };
}
