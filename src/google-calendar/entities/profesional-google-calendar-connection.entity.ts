import { Column, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

@Entity({ name: 'profesional_google_calendar_connections' })
export class ProfesionalGoogleCalendarConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profesional_salud_id', type: 'uuid' })
  profesionalSaludId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'google_account_id', type: 'varchar', length: 255, nullable: true })
  googleAccountId?: string | null;

  @Column({ name: 'google_account_email', type: 'varchar', length: 255, nullable: true })
  googleAccountEmail?: string | null;

  @Column({ name: 'calendar_id', type: 'varchar', length: 255, default: 'primary' })
  calendarId: string;

  @Column({ name: 'access_token_ciphertext', type: 'text' })
  accessTokenCiphertext: string;

  @Column({ name: 'refresh_token_ciphertext', type: 'text', nullable: true })
  refreshTokenCiphertext?: string | null;

  @Column({ name: 'token_encryption_alg', type: 'varchar', length: 30, default: 'AES-256-GCM' })
  tokenEncryptionAlg: string;

  @Column({ name: 'token_encryption_iv', type: 'varchar', length: 100 })
  tokenEncryptionIv: string;

  @Column({ name: 'token_encryption_tag', type: 'varchar', length: 100 })
  tokenEncryptionTag: string;

  @Column({ name: 'token_encryption_key_id', type: 'varchar', length: 100, default: 'default' })
  tokenEncryptionKeyId: string;

  @Column({ type: 'text', nullable: true })
  scopes?: string | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'sync_enabled', type: 'boolean', default: true })
  syncEnabled: boolean;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt?: Date | null;

  @Column({ name: 'last_sync_error', type: 'text', nullable: true })
  lastSyncError?: string | null;

  @VersionColumn()
  version: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
