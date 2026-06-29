import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'visita_estado_historial' })
export class VisitaEstadoHistorial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'visita_id', type: 'uuid' })
  visitaId: string;

  @Column({ name: 'estado_anterior', type: 'varchar', length: 30, nullable: true })
  estadoAnterior?: string | null;

  @Column({ name: 'estado_nuevo', type: 'varchar', length: 30 })
  estadoNuevo: string;

  @Column({ type: 'text', nullable: true })
  motivo?: string | null;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;

  @Column({ name: 'cambiado_por_usuario_id', type: 'uuid' })
  cambiadoPorUsuarioId: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;
}
