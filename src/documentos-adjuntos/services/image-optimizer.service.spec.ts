import sharp from 'sharp';
import { ImageOptimizerService } from './image-optimizer.service';
import type { ValidatedClinicalFile } from '../types/uploaded-file.type';

const imageValidated = (extension: 'jpg' | 'png'): ValidatedClinicalFile => ({
  safeOriginalName: `foto.${extension}`,
  baseName: 'foto',
  extension,
  kind: 'IMAGE',
  mimeType: extension === 'png' ? 'image/png' : 'image/jpeg',
  maxBytes: 10 * 1024 * 1024,
});

describe('ImageOptimizerService', () => {
  let service: ImageOptimizerService;

  beforeEach(() => {
    service = new ImageOptimizerService();
  });

  it('converts a real PNG to WebP and preserves dimensions within limits', async () => {
    const input = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: '#2f80ed',
      },
    })
      .png()
      .toBuffer();

    const result = await service.process(input, imageValidated('png'));
    const metadata = await sharp(result.buffer).metadata();

    expect(result).toEqual(
      expect.objectContaining({
        extension: 'webp',
        mimeType: 'image/webp',
        wasOptimized: true,
        originalWidth: 2400,
        originalHeight: 1200,
      }),
    );
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(1600);
  });

  it('converts a real JPEG to WebP', async () => {
    const input = await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: '#16a34a',
      },
    })
      .jpeg()
      .toBuffer();

    const result = await service.process(input, imageValidated('jpg'));
    const metadata = await sharp(result.buffer).metadata();

    expect(result.extension).toBe('webp');
    expect(result.mimeType).toBe('image/webp');
    expect(metadata.format).toBe('webp');
  });

  it('does not transform PDFs', async () => {
    const input = Buffer.from('%PDF-1.4\ncontenido');

    const result = await service.process(input, {
      safeOriginalName: 'documento.pdf',
      baseName: 'documento',
      extension: 'pdf',
      kind: 'PDF',
      mimeType: 'application/pdf',
      maxBytes: 15 * 1024 * 1024,
    });

    expect(result).toEqual({
      buffer: input,
      mimeType: 'application/pdf',
      extension: 'pdf',
      wasOptimized: false,
    });
  });
});
