import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('audio/')) {
      return cb(new Error('Hanya fail audio dibenarkan'));
    }
    cb(null, true);
  },
});

export function compressAudio(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tmpDir = os.tmpdir();
    const id = crypto.randomUUID();
    const inputFile = path.join(tmpDir, `${id}-in`);
    const outputFile = path.join(tmpDir, `${id}-out.m4a`);

    fs.writeFileSync(inputFile, inputBuffer);

    ffmpeg(inputFile)
      .audioCodec('aac')
      .audioBitrate('128k')
      .audioChannels(2)
      .format('mp4')
      .on('end', () => {
        const output = fs.readFileSync(outputFile);
        fs.unlinkSync(inputFile);
        fs.unlinkSync(outputFile);
        resolve(output);
      })
      .on('error', (err) => {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        reject(err);
      })
      .save(outputFile);
  });
}
