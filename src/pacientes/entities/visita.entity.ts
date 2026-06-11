import { Column, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

@Entity({ name: 'visitas' })
export class Visita {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'plan_cuidado_id', type: 'uuid', nullable: true })
  planCuidadoId?: string | null;

  @Column({ name: 'fecha_programada', type: 'timestamp', nullable: true })
  fechaProgramada?: Date | null;

  @Column({ name: 'fecha_realizada', type: 'timestamp', nullable: true })
  fechaRealizada?: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  estado?: string | null;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;

  @VersionColumn()
  version: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
