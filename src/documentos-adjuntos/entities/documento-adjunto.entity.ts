import { Column, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

@Entity({ name: 'documentos_adjuntos' })
export class DocumentoAdjunto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ficha_clinica_id', type: 'uuid' })
  fichaClinicaId: string;

  @Column({ name: 'nombre_archivo', type: 'varchar', length: 150 })
  nombreArchivo: string;

  @Column({ name: 'tipo_archivo', type: 'varchar', length: 50, nullable: true })
  tipoArchivo?: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType?: string | null;

  @Column({ name: 'tamano_bytes', type: 'bigint', nullable: true })
  tamanoBytes?: string | null;

  @Column({ name: 'hash_archivo', type: 'varchar', length: 128, nullable: true })
  hashArchivo?: string | null;

  @Column({ type: 'text', nullable: true })
  url?: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @VersionColumn()
  version: number;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVO' })
  estado: string;

  @Column({ type: 'varchar', length: 50, default: 'GENERAL' })
  categoria: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @Column({ name: 'subido_por_usuario_id', type: 'uuid', nullable: true })
  subidoPorUsuarioId?: string | null;

  @Column({ name: 'documento_padre_id', type: 'uuid', nullable: true })
  documentoPadreId?: string | null;

  @Column({ name: 'storage_provider', type: 'varchar', length: 30, default: 'R2' })
  storageProvider: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bucket?: string | null;

  @Column({ name: 'object_key', type: 'text', nullable: true })
  objectKey?: string | null;

  @Column({ name: 'mime_type_original', type: 'varchar', length: 120, nullable: true })
  mimeTypeOriginal?: string | null;

  @Column({ name: 'mime_type_almacenado', type: 'varchar', length: 120, nullable: true })
  mimeTypeAlmacenado?: string | null;

  @Column({ name: 'extension_original', type: 'varchar', length: 20, nullable: true })
  extensionOriginal?: string | null;

  @Column({ name: 'extension_almacenada', type: 'varchar', length: 20, nullable: true })
  extensionAlmacenada?: string | null;

  @Column({ name: 'tamano_original_bytes', type: 'bigint', nullable: true })
  tamanoOriginalBytes?: string | null;

  @Column({ name: 'tamano_almacenado_bytes', type: 'bigint', nullable: true })
  tamanoAlmacenadoBytes?: string | null;

  @Column({ name: 'sha256_original', type: 'varchar', length: 64, nullable: true })
  sha256Original?: string | null;

  @Column({ name: 'sha256_almacenado', type: 'varchar', length: 64, nullable: true })
  sha256Almacenado?: string | null;

  @Column({ name: 'encryption_alg', type: 'varchar', length: 40, nullable: true })
  encryptionAlg?: string | null;

  @Column({ name: 'encryption_iv', type: 'varchar', length: 64, nullable: true })
  encryptionIv?: string | null;

  @Column({ name: 'encryption_tag', type: 'varchar', length: 64, nullable: true })
  encryptionTag?: string | null;

  @Column({ name: 'encryption_key_id', type: 'varchar', length: 120, nullable: true })
  encryptionKeyId?: string | null;

  @Column({ name: 'fue_optimizado', type: 'boolean', default: false })
  fueOptimizado: boolean;

  @Column({ name: 'ancho_original', type: 'integer', nullable: true })
  anchoOriginal?: number | null;

  @Column({ name: 'alto_original', type: 'integer', nullable: true })
  altoOriginal?: number | null;

  @Column({ name: 'ancho_almacenado', type: 'integer', nullable: true })
  anchoAlmacenado?: number | null;

  @Column({ name: 'alto_almacenado', type: 'integer', nullable: true })
  altoAlmacenado?: number | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
