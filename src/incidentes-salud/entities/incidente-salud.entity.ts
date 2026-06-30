import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'incidentes_salud' })
export class IncidenteSalud {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  tipo: string;

  @Column({ type: 'varchar', length: 30, default: 'MEDIA' })
  severidad: string;

  @Column({ type: 'varchar', length: 30, default: 'ABIERTO' })
  estado: string;

  @Column({ type: 'varchar', length: 180 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'paciente_id', type: 'uuid', nullable: true })
  pacienteId?: string | null;

  @Column({ name: 'visita_id', type: 'uuid', nullable: true })
  visitaId?: string | null;

  @Column({ name: 'alerta_id', type: 'uuid', nullable: true })
  alertaId?: string | null;

  @Column({ name: 'profesional_salud_id', type: 'uuid', nullable: true })
  profesionalSaludId?: string | null;

  @Column({ name: 'responsable_usuario_id', type: 'uuid', nullable: true })
  responsableUsuarioId?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'SISTEMA' })
  origen: string;

  @Column({ name: 'external_incident_id', type: 'varchar', length: 150, nullable: true })
  externalIncidentId?: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @Column({ name: 'creado_por_usuario_id', type: 'uuid', nullable: true })
  creadoPorUsuarioId?: string | null;

  @Column({ name: 'resuelto_por_usuario_id', type: 'uuid', nullable: true })
  resueltoPorUsuarioId?: string | null;

  @Column({ name: 'resuelto_at', type: 'timestamp', nullable: true })
  resueltoAt?: Date | null;

  @Column({ name: 'cerrado_at', type: 'timestamp', nullable: true })
  cerradoAt?: Date | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
