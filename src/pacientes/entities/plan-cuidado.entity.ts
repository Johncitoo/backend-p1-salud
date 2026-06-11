import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'planes_cuidado' })
export class PlanCuidado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  objetivo?: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio?: Date | null;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin?: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  estado?: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
