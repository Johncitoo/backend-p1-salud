import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'alertas' })
export class Alerta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'visita_id', type: 'uuid', nullable: true })
  visitaId?: string;

  @Column({ type: 'varchar', length: 50 })
  tipo: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ type: 'varchar', length: 20, default: 'MEDIA' })
  prioridad: string;

  @Column({ type: 'varchar', length: 20, default: 'ABIERTA' })
  estado: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
