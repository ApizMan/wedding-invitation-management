import { Request, Response, NextFunction } from 'express';
import Busboy from 'busboy';

// Cloud Functions/Cloud Run fully drains the request socket and buffers it into `req.rawBody`
// before Express ever sees it, so by the time multer/busboy try to stream `req` directly the
// underlying socket has already ended — multer then fails with "Unexpected end of form".
// This wraps busboy directly and, when `req.rawBody` is present (Cloud Functions), feeds the
// buffered body straight into busboy via `.end()` instead of piping the (already-ended) `req`
// stream. Local dev (plain `node`/`ts-node`) never sets `rawBody`, so it pipes `req` as usual.
export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  fieldname: string;
}

type FileFilter = (mimetype: string) => boolean;

export function singleFileUpload(fieldName: string, opts: { maxFileSize: number; fileFilter: FileFilter }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: opts.maxFileSize },
    });

    let fileError: Error | null = null;
    let fileSizeExceeded = false;

    busboy.on('field', (name, value) => {
      req.body = req.body || {};
      req.body[name] = value;
    });

    busboy.on('file', (name, stream, info) => {
      if (name !== fieldName) {
        stream.resume();
        return;
      }
      if (!opts.fileFilter(info.mimeType)) {
        fileError = new Error('Jenis fail tidak dibenarkan');
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => { fileSizeExceeded = true; });
      stream.on('end', () => {
        if (fileSizeExceeded) return;
        req.file = {
          buffer: Buffer.concat(chunks),
          mimetype: info.mimeType,
          originalname: info.filename,
          fieldname: name,
        };
      });
    });

    busboy.on('error', (err: Error) => next(err));

    busboy.on('finish', () => {
      if (fileError) return next(fileError);
      if (fileSizeExceeded) return next(new Error('Fail terlalu besar'));
      next();
    });

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (rawBody) {
      busboy.end(rawBody);
    } else {
      req.pipe(busboy);
    }
  };
}
