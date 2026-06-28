import { BadRequestException, Injectable } from '@nestjs/common';
import { basename, extname, parse, win32 } from 'path';
import type { UploadedClinicalFile, ValidatedClinicalFile } from '../types/uploaded-file.type';

const MB = 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * MB;
const MAX_PDF_BYTES = 15 * MB;

const EXTENSION_MIME: Record<string, ValidatedClinicalFile['mimeType']> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

@Injectable()
export class FileValidationService {
  validate(file?: UploadedClinicalFile): ValidatedClinicalFile {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException('El archivo esta vacio o no fue recibido.');
    }

    const safeOriginalName = this.sanitizeOriginalName(file.originalname);
    const extension = this.getExtension(safeOriginalName);
    const expectedMime = EXTENSION_MIME[extension];

    if (!expectedMime) {
      throw new BadRequestException('Tipo de archivo no permitido. Solo JPG, PNG, WebP o PDF.');
    }

    if (file.mimetype !== expectedMime) {
      throw new BadRequestException('El MIME declarado no coincide con la extension permitida.');
    }

    if (!this.matchesMagicBytes(file.buffer, extension)) {
      throw new BadRequestException('El contenido del archivo no coincide con su extension.');
    }

    const kind = expectedMime === 'application/pdf' ? 'PDF' : 'IMAGE';
    const maxBytes = kind === 'IMAGE' ? MAX_IMAGE_BYTES : MAX_PDF_BYTES;

    if (file.size > maxBytes) {
      throw new BadRequestException(
        kind === 'IMAGE'
          ? 'La imagen excede el tamano maximo permitido de 10 MB.'
          : 'El PDF excede el tamano maximo permitido de 15 MB.',
      );
    }

    return {
      safeOriginalName,
      baseName: this.safeBaseName(safeOriginalName),
      extension: extension as ValidatedClinicalFile['extension'],
      kind,
      mimeType: expectedMime,
      maxBytes,
    };
  }

  private sanitizeOriginalName(originalName?: string): string {
    const value = originalName?.trim();
    if (!value) throw new BadRequestException('Nombre de archivo invalido.');

    if (value !== basename(value) || value !== win32.basename(value)) {
      throw new BadRequestException('Nombre de archivo invalido.');
    }

    if (/[\0/\\:*?"<>|]/.test(value) || value.includes('..')) {
      throw new BadRequestException('Nombre de archivo invalido.');
    }

    return value.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 150);
  }

  private safeBaseName(fileName: string): string {
    return parse(fileName)
      .name
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 100) || 'archivo';
  }

  private getExtension(fileName: string): string {
    return extname(fileName).replace('.', '').toLowerCase();
  }

  private matchesMagicBytes(buffer: Buffer, extension: string): boolean {
    if (extension === 'jpg' || extension === 'jpeg') {
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    if (extension === 'png') {
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }

    if (extension === 'webp') {
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }

    if (extension === 'pdf') {
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }

    return false;
  }
}
