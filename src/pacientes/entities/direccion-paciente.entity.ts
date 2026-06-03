import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'direcciones_paciente' })
export class DireccionPaciente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ length: 100, nullable: true })
  alias?: string | null;

  @Column({ length: 200 })
  calle: string;

  @Column({ length: 50, nullable: true })
  numero?: string | null;

  @Column({ length: 100, nullable: true })
  departamento?: string | null;

  @Column({ length: 100, nullable: true })
  comuna?: string | null;

  @Column({ length: 100, nullable: true })
  region?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud?: number | null;

  @Column({ default: false })
  esPrincipal: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
