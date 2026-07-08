import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'medicamentos' })
export class Medicamento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'visita_id', type: 'uuid' })
  visitaId: string;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ name: 'medicamento_catalogo_id', type: 'uuid', nullable: true })
  medicamentoCatalogoId?: string | null;

  @Column({ name: 'cantidad_cajas', type: 'int', default: 1 })
  cantidadCajas: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  indicaciones?: string | null;

  @Column({ name: 'creado_por_usuario_id', type: 'uuid', nullable: true })
  creadoPorUsuarioId?: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
