import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { PacienteAccessService } from '../auth/services/paciente-access.service';
import { FichaClinica } from '../fichas-clinicas/entities/ficha-clinica.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { UploadDocumentoAdjuntoDto } from './dto/upload-documento-adjunto.dto';
import { DocumentoAdjunto } from './entities/documento-adjunto.entity';
import { FileEncryptionService } from './services/file-encryption.service';
import { FileValidationService } from './services/file-validation.service';
import { ImageOptimizerService } from './services/image-optimizer.service';
import { STORAGE_SERVICE } from './services/storage.interface';
import type { StorageService } from './services/storage.interface';
import type { UploadedClinicalFile } from './types/uploaded-file.type';

export type DownloadDocumentoAdjunto = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

@Injectable()
export class DocumentosAdjuntosService {
  constructor(
    @InjectRepository(DocumentoAdjunto)
    private readonly documentosRepo: Repository<DocumentoAdjunto>,
    @InjectRepository(FichaClinica)
    private readonly fichasRepo: Repository<FichaClinica>,
    @InjectRepository(Visita)
    private readonly visitasRepo: Repository<Visita>,
    private readonly fileValidation: FileValidationService,
    private readonly imageOptimizer: ImageOptimizerService,
    private readonly encryption: FileEncryptionService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly auditoriasService: AuditoriasService,
    private readonly pacienteAccessService: PacienteAccessService,
  ) {}

  /** Resuelve el pacienteId de un documento: viene denormalizado en metadata
   * (ver upload()), con fallback vía ficha→visita para filas viejas que no
   * lo tengan. */
  private async pacienteIdDeDocumento(documento: DocumentoAdjunto): Promise<string> {
    const metadataPacienteId = (documento.metadata as Record<string, unknown> | null)?.pacienteId;
    if (typeof metadataPacienteId === 'string') return metadataPacienteId;

    const ficha = await this.findFicha(documento.fichaClinicaId);
    const visita = await this.visitasRepo.findOne({ where: { id: ficha.visitaId, deletedAt: IsNull() } });
    if (!visita) throw new NotFoundException('Visita asociada al documento no encontrada');
    return visita.pacienteId;
  }

  async upload(dto: UploadDocumentoAdjuntoDto, file: UploadedClinicalFile, usuarioId?: string) {
    const ficha = await this.findFicha(dto.fichaClinicaId);
    const visita = await this.visitasRepo.findOne({ where: { id: ficha.visitaId, deletedAt: IsNull() } });
    if (!visita) throw new NotFoundException('Visita asociada a la ficha no encontrada');

    const validated = this.fileValidation.validate(file);
    const processed = await this.imageOptimizer.process(file.buffer, validated);
    const originalSha256 = this.sha256(file.buffer);
    const encrypted = this.encryption.encrypt(processed.buffer);
    const encryptedSha256 = this.sha256(encrypted.encryptedBuffer);
    const objectKey = this.buildObjectKey(ficha.id, processed.extension);

    await this.storage.putEncryptedObject(objectKey, encrypted.encryptedBuffer);

    const documento = this.documentosRepo.create({
      fichaClinicaId: ficha.id,
      nombreArchivo: validated.safeOriginalName,
      tipoArchivo: processed.extension,
      mimeType: processed.mimeType,
      tamanoBytes: String(encrypted.encryptedBuffer.length),
      hashArchivo: encryptedSha256,
      url: null,
      descripcion: dto.descripcion ?? null,
      estado: 'ACTIVO',
      categoria: dto.categoria ?? (validated.kind === 'IMAGE' ? 'FOTO_CLINICA' : 'GENERAL'),
      metadata: {
        visitaId: visita.id,
        pacienteId: visita.pacienteId,
        originalMimeType: validated.mimeType,
        storedMimeType: processed.mimeType,
        originalExtension: validated.extension,
        storedExtension: processed.extension,
      },
      subidoPorUsuarioId: usuarioId ?? null,
      storageProvider: this.storage.providerName,
      bucket: this.storage.getBucket(),
      objectKey,
      mimeTypeOriginal: validated.mimeType,
      mimeTypeAlmacenado: processed.mimeType,
      extensionOriginal: validated.extension,
      extensionAlmacenada: processed.extension,
      tamanoOriginalBytes: String(file.size),
      tamanoAlmacenadoBytes: String(encrypted.encryptedBuffer.length),
      sha256Original: originalSha256,
      sha256Almacenado: encryptedSha256,
      encryptionAlg: encrypted.alg,
      encryptionIv: encrypted.iv,
      encryptionTag: encrypted.tag,
      encryptionKeyId: encrypted.keyId,
      fueOptimizado: processed.wasOptimized,
      anchoOriginal: processed.originalWidth ?? null,
      altoOriginal: processed.originalHeight ?? null,
      anchoAlmacenado: processed.storedWidth ?? null,
      altoAlmacenado: processed.storedHeight ?? null,
    });

    let saved: DocumentoAdjunto;
    try {
      saved = await this.documentosRepo.save(documento);
    } catch (error) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'documentos_adjuntos',
      entidadId: saved.id,
      accion: 'SUBIR',
      detalle: `Documento adjunto ${saved.nombreArchivo} subido y cifrado`,
      newValues: {
        fichaClinicaId: saved.fichaClinicaId,
        visitaId: visita.id,
        pacienteId: visita.pacienteId,
        categoria: saved.categoria,
        objectKey: saved.objectKey,
        mimeTypeOriginal: saved.mimeTypeOriginal,
        mimeTypeAlmacenado: saved.mimeTypeAlmacenado,
        extensionOriginal: saved.extensionOriginal,
        extensionAlmacenada: saved.extensionAlmacenada,
        tamanoOriginalBytes: saved.tamanoOriginalBytes,
        tamanoAlmacenadoBytes: saved.tamanoAlmacenadoBytes,
        sha256Original: saved.sha256Original,
        sha256Almacenado: saved.sha256Almacenado,
        encryptionAlg: saved.encryptionAlg,
        encryptionKeyId: saved.encryptionKeyId,
        fueOptimizado: saved.fueOptimizado,
      },
    });

    return this.toResponse(saved);
  }

  async findAll(filtros: { fichaClinicaId?: string }, user?: UsuarioPerfil) {
    if (user?.rol === 'PROFESIONAL') {
      if (!filtros.fichaClinicaId) {
        throw new ForbiddenException('Debes especificar una ficha clínica para consultar sus adjuntos.');
      }
      const ficha = await this.findFicha(filtros.fichaClinicaId);
      await this.pacienteAccessService.assertAccesoVisita(user, ficha.visitaId);
    }

    const where: FindOptionsWhere<DocumentoAdjunto> = { deletedAt: IsNull() };
    if (filtros.fichaClinicaId) where.fichaClinicaId = filtros.fichaClinicaId;

    const rows = await this.documentosRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return rows.map(row => this.toResponse(row));
  }

  async download(id: string, usuarioId?: string, user?: UsuarioPerfil): Promise<DownloadDocumentoAdjunto> {
    const documento = await this.findOneActive(id);
    await this.pacienteAccessService.assertAccesoPaciente(user, await this.pacienteIdDeDocumento(documento));
    if (!documento.objectKey || !documento.encryptionIv || !documento.encryptionTag) {
      throw new BadRequestException('Documento sin informacion de almacenamiento cifrado.');
    }

    const encryptedBuffer = await this.storage.getEncryptedObject(documento.objectKey);
    const buffer = this.encryption.decrypt(encryptedBuffer, documento.encryptionIv, documento.encryptionTag);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'documentos_adjuntos',
      entidadId: documento.id,
      accion: 'DESCARGAR',
      detalle: `Documento adjunto ${documento.nombreArchivo} descargado`,
      newValues: this.auditDocumentoValues(documento),
    });

    return {
      buffer,
      fileName: this.downloadFileName(documento),
      mimeType: documento.mimeTypeAlmacenado ?? documento.mimeType ?? 'application/octet-stream',
    };
  }

  async remove(id: string, usuarioId?: string) {
    const documento = await this.findOneActive(id);
    const oldValues = this.auditDocumentoValues(documento);
    documento.estado = 'ELIMINADO';
    documento.deletedAt = new Date();
    const saved = await this.documentosRepo.save(documento);

    if (documento.objectKey) {
      await this.storage.deleteObject(documento.objectKey).catch(() => undefined);
    }

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'documentos_adjuntos',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Documento adjunto ${saved.nombreArchivo} eliminado`,
      oldValues,
      newValues: this.auditDocumentoValues(saved),
    });

    return this.toResponse(saved);
  }

  private async findFicha(id: string) {
    const ficha = await this.fichasRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!ficha) throw new NotFoundException('Ficha clinica no encontrada');
    return ficha;
  }

  private async findOneActive(id: string) {
    const documento = await this.documentosRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!documento) throw new NotFoundException('Documento adjunto no encontrado');
    return documento;
  }

  private buildObjectKey(fichaClinicaId: string, extension: string) {
    return `documentos-adjuntos/${fichaClinicaId}/${randomUUID()}.${extension}.enc`;
  }

  private sha256(buffer: Buffer) {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private downloadFileName(documento: DocumentoAdjunto) {
    const extension = documento.extensionAlmacenada ?? documento.tipoArchivo ?? 'bin';
    const baseName = documento.nombreArchivo.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '_') || 'documento';
    return `${baseName}.${extension}`;
  }

  private toResponse(documento: DocumentoAdjunto) {
    const { encryptionIv, encryptionTag, objectKey, ...safeDocumento } = documento;
    return {
      ...safeDocumento,
      objectKey: objectKey ? `${documento.storageProvider.toLowerCase()}://encrypted-object` : null,
      encryptionIv: encryptionIv ? '***' : null,
      encryptionTag: encryptionTag ? '***' : null,
    };
  }

  private auditDocumentoValues(documento: DocumentoAdjunto) {
    const metadata = documento.metadata ?? {};

    return {
      fichaClinicaId: documento.fichaClinicaId,
      visitaId: metadata.visitaId ?? null,
      pacienteId: metadata.pacienteId ?? null,
      nombreArchivo: documento.nombreArchivo,
      categoria: documento.categoria,
      estado: documento.estado,
      storageProvider: documento.storageProvider,
      bucket: documento.bucket ?? null,
      objectKey: documento.objectKey ?? null,
      mimeTypeOriginal: documento.mimeTypeOriginal ?? null,
      mimeTypeAlmacenado: documento.mimeTypeAlmacenado ?? documento.mimeType ?? null,
      extensionOriginal: documento.extensionOriginal ?? null,
      extensionAlmacenada: documento.extensionAlmacenada ?? documento.tipoArchivo ?? null,
      tamanoOriginalBytes: documento.tamanoOriginalBytes ?? null,
      tamanoAlmacenadoBytes: documento.tamanoAlmacenadoBytes ?? documento.tamanoBytes ?? null,
      sha256Original: documento.sha256Original ?? null,
      sha256Almacenado: documento.sha256Almacenado ?? documento.hashArchivo ?? null,
      encryptionAlg: documento.encryptionAlg ?? null,
      encryptionKeyId: documento.encryptionKeyId ?? null,
      fueOptimizado: documento.fueOptimizado,
      deletedAt: documento.deletedAt ?? null,
    };
  }
}
