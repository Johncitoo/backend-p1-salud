import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auditorias' })
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ length: 100 })
  entidad: string;

  @Column({ name: 'entidad_id', type: 'uuid' })
  entidadId: string;

  @Column({ length: 100 })
  accion: string;

  @Column({ type: 'text', nullable: true })
  detalle?: string | null;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: Record<string, unknown> | null;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 50, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  requestId?: string | null;

  @Column({ type: 'text', nullable: true })
  endpoint?: string | null;

  @Column({ name: 'metodo_http', type: 'varchar', length: 10, nullable: true })
  metodoHttp?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'WEB' })
  origen: string;

  @Column({ name: 'fecha_hora', type: 'timestamp', default: () => 'NOW()' })
  fechaHora: Date;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;
}
