import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'reprogramaciones_visita' })
export class ReprogramacionVisita {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'visita_id', type: 'uuid' })
  visitaId: string;

  @Column({ name: 'fecha_programada_anterior', type: 'date' })
  fechaProgramadaAnterior: string;

  @Column({ name: 'hora_programada_anterior', type: 'time' })
  horaProgramadaAnterior: string;

  @Column({ name: 'fecha_programada_nueva', type: 'date' })
  fechaProgramadaNueva: string;

  @Column({ name: 'hora_programada_nueva', type: 'time' })
  horaProgramadaNueva: string;

  @Column({ name: 'motivo_reprogramacion_id', type: 'uuid', nullable: true })
  motivoReprogramacionId?: string | null;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;

  @Column({ name: 'reprogramada_por_usuario_id', type: 'uuid' })
  reprogramadaPorUsuarioId: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;
}
