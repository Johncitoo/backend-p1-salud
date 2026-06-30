import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'reglas_asignacion' })
export class ReglaAsignacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ type: 'integer', default: 100 })
  prioridad: number;

  @Column({ type: 'jsonb', default: '{}' })
  condiciones: Record<string, any>;

  @Column({ type: 'jsonb', default: '{}' })
  acciones: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
