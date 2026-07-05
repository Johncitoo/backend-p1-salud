import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'visita_checkpoints' })
@Unique(['visitaId', 'tipo'])
export class VisitaCheckpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'visita_id', type: 'uuid' })
  visitaId: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: string;

  @Column({ name: 'fecha_hora', type: 'timestamp', default: () => 'NOW()' })
  fechaHora: Date;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitud?: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitud?: number | null;

  @Column({ name: 'precision_metros', type: 'numeric', precision: 10, scale: 2, nullable: true })
  precisionMetros?: number | null;

  @Column({ type: 'varchar', length: 30, default: 'APP' })
  origen: string;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;

  @Column({ name: 'registrado_por_usuario_id', type: 'uuid' })
  registradoPorUsuarioId: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;
}
