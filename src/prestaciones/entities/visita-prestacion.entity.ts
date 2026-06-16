import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'visita_prestaciones' })
export class VisitaPrestacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'visita_id', type: 'uuid' })
  visitaId: string;

  @Column({ name: 'prestacion_id', type: 'uuid' })
  prestacionId: string;

  @Column({ type: 'integer', default: 1 })
  cantidad: number;

  @Column({ type: 'varchar', length: 30, default: 'PROGRAMADA' })
  estado: string;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
