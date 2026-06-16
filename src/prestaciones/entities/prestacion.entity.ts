import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'prestaciones' })
export class Prestacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  codigo: string;

  @Column({ length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'duracion_estimada_min', type: 'integer', nullable: true })
  duracionEstimadaMin?: number | null;

  @Column({ default: true })
  activa: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
