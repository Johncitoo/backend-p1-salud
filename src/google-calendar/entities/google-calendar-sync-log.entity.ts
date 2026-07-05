import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'google_calendar_sync_logs' })
export class GoogleCalendarSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'visita_id', type: 'uuid', nullable: true })
  visitaId?: string | null;

  @Column({ name: 'connection_id', type: 'uuid', nullable: true })
  connectionId?: string | null;

  @Column({ type: 'varchar', length: 30 })
  action: string;

  @Column({ type: 'varchar', length: 30 })
  status: string;

  @Column({ name: 'request_payload', type: 'jsonb', nullable: true })
  requestPayload?: Record<string, unknown> | null;

  @Column({ name: 'response_payload', type: 'jsonb', nullable: true })
  responsePayload?: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;
}
