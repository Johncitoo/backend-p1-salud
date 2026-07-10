import { BadRequestException } from '@nestjs/common';
import { FileValidationService } from './file-validation.service';
import type { UploadedClinicalFile } from '../types/uploaded-file.type';

const makeFile = (
  overrides: Partial<UploadedClinicalFile>,
): UploadedClinicalFile => {
  const buffer = overrides.buffer ?? Buffer.from('%PDF-1.4\n');
  return {
    buffer,
    originalname: overrides.originalname ?? 'documento.pdf',
    mimetype: overrides.mimetype ?? 'application/pdf',
    size: overrides.size ?? buffer.length,
  };
};

describe('FileValidationService', () => {
  let service: FileValidationService;

  beforeEach(() => {
    service = new FileValidationService();
  });

  it('accepts a valid PDF by extension, MIME and magic bytes', () => {
    const result = service.validate(makeFile({}));

    expect(result).toEqual(
      expect.objectContaining({
        extension: 'pdf',
        kind: 'PDF',
        mimeType: 'application/pdf',
      }),
    );
  });

  it('accepts a valid JPEG by extension, MIME and magic bytes', () => {
    const result = service.validate(
      makeFile({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
        originalname: 'foto.jpg',
        mimetype: 'image/jpeg',
      }),
    );

    expect(result.kind).toBe('IMAGE');
    expect(result.extension).toBe('jpg');
  });

  it('rejects executables renamed as PDF', () => {
    expect(() =>
      service.validate(
        makeFile({
          buffer: Buffer.from('MZ executable'),
          originalname: 'malware.pdf',
          mimetype: 'application/pdf',
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects executable extensions even when the MIME is common', () => {
    expect(() =>
      service.validate(
        makeFile({
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
          originalname: 'foto.exe',
          mimetype: 'image/jpeg',
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects path traversal names', () => {
    expect(() =>
      service.validate(
        makeFile({
          originalname: '../receta.pdf',
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects Windows path traversal names', () => {
    expect(() =>
      service.validate(
        makeFile({
          originalname: '..\\receta.pdf',
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects unsupported extensions', () => {
    expect(() =>
      service.validate(
        makeFile({
          originalname: 'planilla.xlsx',
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      ),
    ).toThrow(BadRequestException);
  });
});
