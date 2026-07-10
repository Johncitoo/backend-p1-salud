import { randomUUID } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { DocumentosAdjuntosService } from './documentos-adjuntos.service';
import { DocumentoAdjunto } from './entities/documento-adjunto.entity';
import { FileEncryptionService } from './services/file-encryption.service';
import { FileValidationService } from './services/file-validation.service';
import { ImageOptimizerService } from './services/image-optimizer.service';
import { R2StorageService } from './services/r2-storage.service';

const makeRepo = <T extends object>() => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((value: Partial<T>) => value),
  save: jest.fn(async (value: Partial<T>) => ({
    id: randomUUID(),
    version: 1,
    ...value,
  })),
});

describe('DocumentosAdjuntosService', () => {
  const fichaId = randomUUID();
  const visitaId = randomUUID();
  const pacienteId = randomUUID();
  const userId = randomUUID();

  let documentosRepo: ReturnType<typeof makeRepo<DocumentoAdjunto>>;
  let fichasRepo: ReturnType<typeof makeRepo<any>>;
  let visitasRepo: ReturnType<typeof makeRepo<any>>;
  let storage: jest.Mocked<
    Pick<
      R2StorageService,
      'putEncryptedObject' | 'getBucket' | 'getEncryptedObject' | 'deleteObject'
    >
  > & { providerName: string };
  let auditorias: { registrar: jest.Mock };
  let service: DocumentosAdjuntosService;

  beforeEach(() => {
    documentosRepo = makeRepo<DocumentoAdjunto>();
    fichasRepo = makeRepo();
    visitasRepo = makeRepo();
    storage = {
      providerName: 'R2',
      putEncryptedObject: jest.fn(async () => undefined),
      getBucket: jest.fn(() => 'bucket-test'),
      getEncryptedObject: jest.fn(),
      deleteObject: jest.fn(async () => undefined),
    };
    auditorias = { registrar: jest.fn() };

    fichasRepo.findOne.mockResolvedValue({
      id: fichaId,
      visitaId,
      deletedAt: null,
    });
    visitasRepo.findOne.mockResolvedValue({
      id: visitaId,
      pacienteId,
      deletedAt: null,
    });

    const encryption = new FileEncryptionService({
      get: jest.fn((name: string) =>
        name === 'FILES_ENCRYPTION_KEY'
          ? Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')
          : 'test-key',
      ),
    } as any);

    const pacienteAccess = {
      assertAccesoPaciente: jest.fn(),
      assertAccesoVisita: jest.fn(),
    };

    service = new DocumentosAdjuntosService(
      documentosRepo as any,
      fichasRepo as any,
      visitasRepo as any,
      new FileValidationService(),
      new ImageOptimizerService(),
      encryption,
      storage,
      auditorias as any,
      pacienteAccess as any,
    );
  });

  it('uploads a valid PDF encrypted to storage and stores metadata', async () => {
    const fileBuffer = Buffer.from('%PDF-1.4\ncontenido');
    const result = await service.upload(
      {
        fichaClinicaId: fichaId,
        categoria: 'GENERAL',
        descripcion: 'Consentimiento',
      },
      {
        buffer: fileBuffer,
        originalname: 'consentimiento.pdf',
        mimetype: 'application/pdf',
        size: fileBuffer.length,
      },
      userId,
    );

    expect(storage.putEncryptedObject).toHaveBeenCalledWith(
      expect.stringContaining(`documentos-adjuntos/${fichaId}/`),
      expect.any(Buffer),
    );
    expect(documentosRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fichaClinicaId: fichaId,
        nombreArchivo: 'consentimiento.pdf',
        bucket: 'bucket-test',
        encryptionAlg: 'AES-256-GCM',
        mimeTypeAlmacenado: 'application/pdf',
        subidoPorUsuarioId: userId,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ nombreArchivo: 'consentimiento.pdf' }),
    );
    expect(auditorias.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: userId,
        entidad: 'documentos_adjuntos',
        accion: 'SUBIR',
        newValues: expect.objectContaining({
          fichaClinicaId: fichaId,
          visitaId,
          pacienteId,
          categoria: 'GENERAL',
          mimeTypeOriginal: 'application/pdf',
          mimeTypeAlmacenado: 'application/pdf',
          tamanoOriginalBytes: String(fileBuffer.length),
          sha256Original: expect.any(String),
          sha256Almacenado: expect.any(String),
          encryptionAlg: 'AES-256-GCM',
          encryptionKeyId: 'test-key',
          fueOptimizado: false,
        }),
      }),
    );
  });

  it('uploads and optimizes a valid PNG as encrypted WebP', async () => {
    const fileBuffer = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: '#ef4444',
      },
    })
      .png()
      .toBuffer();

    await service.upload(
      { fichaClinicaId: fichaId, categoria: 'FOTO_CLINICA' },
      {
        buffer: fileBuffer,
        originalname: 'herida.png',
        mimetype: 'image/png',
        size: fileBuffer.length,
      },
      userId,
    );

    expect(documentosRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        nombreArchivo: 'herida.png',
        tipoArchivo: 'webp',
        mimeType: 'image/webp',
        mimeTypeOriginal: 'image/png',
        mimeTypeAlmacenado: 'image/webp',
        extensionOriginal: 'png',
        extensionAlmacenada: 'webp',
        fueOptimizado: true,
        anchoOriginal: 200,
        altoOriginal: 100,
        anchoAlmacenado: 200,
        altoAlmacenado: 100,
      }),
    );
  });

  it('deletes the uploaded R2 object when database persistence fails', async () => {
    const dbError = new Error('db down');
    documentosRepo.save.mockRejectedValueOnce(dbError);
    const fileBuffer = Buffer.from('%PDF-1.4\ncontenido');

    await expect(
      service.upload(
        { fichaClinicaId: fichaId },
        {
          buffer: fileBuffer,
          originalname: 'documento.pdf',
          mimetype: 'application/pdf',
          size: fileBuffer.length,
        },
        userId,
      ),
    ).rejects.toThrow(dbError);

    expect(storage.putEncryptedObject).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
    );
    expect(storage.deleteObject).toHaveBeenCalledWith(
      expect.stringContaining(`documentos-adjuntos/${fichaId}/`),
    );
  });

  it('throws when ficha does not exist', async () => {
    fichasRepo.findOne.mockResolvedValue(null);
    const fileBuffer = Buffer.from('%PDF-1.4\ncontenido');

    await expect(
      service.upload(
        { fichaClinicaId: fichaId },
        {
          buffer: fileBuffer,
          originalname: 'documento.pdf',
          mimetype: 'application/pdf',
          size: fileBuffer.length,
        },
        userId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('audits downloads and deletes with clinical linkage metadata', async () => {
    const encryptedBuffer = Buffer.from('encrypted-pdf');
    const encrypted = new FileEncryptionService({
      get: jest.fn((name: string) =>
        name === 'FILES_ENCRYPTION_KEY'
          ? Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')
          : 'test-key',
      ),
    } as any).encrypt(Buffer.from('%PDF-1.4\ncontenido'));

    const documento = {
      id: randomUUID(),
      fichaClinicaId: fichaId,
      nombreArchivo: 'control.pdf',
      tipoArchivo: 'pdf',
      mimeType: 'application/pdf',
      tamanoBytes: String(encrypted.encryptedBuffer.length),
      hashArchivo: 'hash-almacenado',
      estado: 'ACTIVO',
      categoria: 'GENERAL',
      metadata: { visitaId, pacienteId },
      storageProvider: 'R2',
      bucket: 'bucket-test',
      objectKey: `documentos-adjuntos/${fichaId}/control.pdf.enc`,
      mimeTypeOriginal: 'application/pdf',
      mimeTypeAlmacenado: 'application/pdf',
      extensionOriginal: 'pdf',
      extensionAlmacenada: 'pdf',
      tamanoOriginalBytes: '18',
      tamanoAlmacenadoBytes: String(encrypted.encryptedBuffer.length),
      sha256Original: 'hash-original',
      sha256Almacenado: 'hash-almacenado',
      encryptionAlg: encrypted.alg,
      encryptionIv: encrypted.iv,
      encryptionTag: encrypted.tag,
      encryptionKeyId: encrypted.keyId,
      fueOptimizado: false,
      deletedAt: null,
    };

    documentosRepo.findOne.mockResolvedValue(documento);
    storage.getEncryptedObject.mockResolvedValue(encrypted.encryptedBuffer);

    await service.download(documento.id, userId);

    expect(storage.getEncryptedObject).toHaveBeenCalledWith(
      documento.objectKey,
    );
    expect(auditorias.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: userId,
        accion: 'DESCARGAR',
        newValues: expect.objectContaining({
          fichaClinicaId: fichaId,
          visitaId,
          pacienteId,
          sha256Original: 'hash-original',
          sha256Almacenado: 'hash-almacenado',
        }),
      }),
    );

    documentosRepo.save.mockImplementationOnce(async (value) => ({ ...value }));
    await service.remove(documento.id, userId);

    expect(auditorias.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: userId,
        accion: 'ELIMINAR',
        oldValues: expect.objectContaining({
          estado: 'ACTIVO',
          deletedAt: null,
        }),
        newValues: expect.objectContaining({
          estado: 'ELIMINADO',
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });
});
