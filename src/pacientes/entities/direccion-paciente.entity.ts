import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'direcciones_paciente' })
export class DireccionPaciente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'zona_id', type: 'uuid', nullable: true })
  zonaId?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'DOMICILIO' })
  tipo: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  calle?: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  numero?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  departamento?: string | null;

  @Column({
    name: 'villa_poblacion',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  villaPoblacion?: string | null;

  @Column({ length: 100 })
  comuna: string;

  @Column({ length: 100 })
  region: string;

  @Column({ type: 'text', nullable: true })
  referencia?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud?: number | null;

  @Column({ name: 'es_principal', default: false })
  esPrincipal: boolean;

  @Column({ default: true })
  activa: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
