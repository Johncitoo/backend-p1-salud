import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'plantillas_ficha' })
export class PlantillaFicha {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  codigo: string;

  @Column({ length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'tipo_atencion', type: 'varchar', length: 80, nullable: true })
  tipoAtencion?: string | null;

  @Column({ default: true })
  activa: boolean;

  @Column({ name: 'creada_por_usuario_id', type: 'uuid', nullable: true })
  creadaPorUsuarioId?: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
