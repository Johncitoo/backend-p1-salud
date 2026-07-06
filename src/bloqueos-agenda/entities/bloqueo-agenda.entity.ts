import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bloqueos_agenda' })
export class BloqueoAgenda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: string;

  @Column({ name: 'profesional_salud_id', type: 'uuid', nullable: true })
  profesionalSaludId?: string | null;

  @Column({ name: 'zona_id', type: 'uuid', nullable: true })
  zonaId?: string | null;

  @Column({ name: 'fecha_hora_inicio', type: 'timestamp' })
  fechaHoraInicio: Date;

  @Column({ name: 'fecha_hora_fin', type: 'timestamp' })
  fechaHoraFin: Date;

  @Column({ type: 'varchar', length: 150 })
  motivo: string;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVO' })
  estado: string;

  @Column({ name: 'creado_por_usuario_id', type: 'uuid' })
  creadoPorUsuarioId: string;

  @Column({ name: 'cancelado_por_usuario_id', type: 'uuid', nullable: true })
  canceladoPorUsuarioId?: string | null;

  @Column({ name: 'cancelado_at', type: 'timestamp', nullable: true })
  canceladoAt?: Date | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
