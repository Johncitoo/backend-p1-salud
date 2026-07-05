import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'motivos_cancelacion' })
export class MotivoCancelacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  codigo: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'aplica_a', type: 'varchar', length: 30, default: 'VISITA' })
  aplicaA: string;

  @Column({ name: 'requiere_observacion', default: false })
  requiereObservacion: boolean;

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
