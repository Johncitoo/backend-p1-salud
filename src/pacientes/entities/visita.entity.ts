import { Column, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

@Entity({ name: 'visitas' })
export class Visita {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'profesional_salud_id', type: 'uuid' })
  profesionalSaludId: string;

  @Column({ name: 'zona_id', type: 'uuid', nullable: true })
  zonaId?: string | null;

  @Column({ name: 'plan_cuidado_id', type: 'uuid', nullable: true })
  planCuidadoId?: string | null;

  @Column({ name: 'direccion_paciente_id', type: 'uuid', nullable: true })
  direccionPacienteId?: string | null;

  @Column({ name: 'fecha_programada', type: 'date' })
  fechaProgramada: string;

  @Column({ name: 'hora_programada', type: 'time' })
  horaProgramada: string;

  @Column({ name: 'duracion_estimada_min', type: 'integer', nullable: true })
  duracionEstimadaMin?: number | null;

  @Column({ name: 'fecha_hora_inicio_real', type: 'timestamp', nullable: true })
  fechaHoraInicioReal?: Date | null;

  @Column({ name: 'fecha_hora_fin_real', type: 'timestamp', nullable: true })
  fechaHoraFinReal?: Date | null;

  @Column({ name: 'check_in_at', type: 'timestamp', nullable: true })
  checkInAt?: Date | null;

  @Column({ name: 'check_out_at', type: 'timestamp', nullable: true })
  checkOutAt?: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'PROGRAMADA' })
  estado: string;

  @Column({ type: 'varchar', length: 20, default: 'NORMAL' })
  prioridad: string;

  @Column({ name: 'creada_por_usuario_id', type: 'uuid' })
  creadaPorUsuarioId: string;

  @Column({ name: 'motivo_cancelacion_id', type: 'uuid', nullable: true })
  motivoCancelacionId?: string | null;

  @Column({ name: 'cancelada_at', type: 'timestamp', nullable: true })
  canceladaAt?: Date | null;

  @Column({ name: 'cancelada_por_usuario_id', type: 'uuid', nullable: true })
  canceladaPorUsuarioId?: string | null;

  @Column({ name: 'observacion_cancelacion', type: 'text', nullable: true })
  observacionCancelacion?: string | null;

  @VersionColumn()
  version: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
