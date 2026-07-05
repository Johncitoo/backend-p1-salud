import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import type { ProcessedClinicalFile, ValidatedClinicalFile } from '../types/uploaded-file.type';

const MAX_IMAGE_DIMENSION = 1600;
const WEBP_QUALITY = 82;

@Injectable()
export class ImageOptimizerService {
  async process(buffer: Buffer, validated: ValidatedClinicalFile): Promise<ProcessedClinicalFile> {
    if (validated.kind === 'PDF') {
      return {
        buffer,
        mimeType: 'application/pdf',
        extension: 'pdf',
        wasOptimized: false,
      };
    }

    try {
      const source = sharp(buffer, { failOn: 'error' }).rotate();
      const originalMetadata = await source.metadata();
      const optimizedBuffer = await source
        .resize({
          width: MAX_IMAGE_DIMENSION,
          height: MAX_IMAGE_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      const storedMetadata = await sharp(optimizedBuffer).metadata();

      return {
        buffer: optimizedBuffer,
        mimeType: 'image/webp',
        extension: 'webp',
        wasOptimized: true,
        originalWidth: originalMetadata.width ?? null,
        originalHeight: originalMetadata.height ?? null,
        storedWidth: storedMetadata.width ?? null,
        storedHeight: storedMetadata.height ?? null,
      };
    } catch {
      throw new BadRequestException('No fue posible procesar la imagen subida.');
    }
  }
}
