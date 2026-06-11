import { Column, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

@Entity({ name: 'fichas_clinicas' })
export class FichaClinica {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'visita_id', type: 'uuid' })
  visitaId: string;

  @Column({ name: 'plantilla_ficha_id', type: 'uuid', nullable: true })
  plantillaFichaId?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'BORRADOR' })
  estado: string;

  @Column({ type: 'jsonb', default: {} })
  contenido: Record<string, unknown>;

  @Column({ name: 'creada_por_usuario_id', type: 'uuid', nullable: true })
  creadaPorUsuarioId?: string | null;

  @Column({ name: 'actualizada_por_usuario_id', type: 'uuid', nullable: true })
  actualizadaPorUsuarioId?: string | null;

  @VersionColumn()
  version: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
