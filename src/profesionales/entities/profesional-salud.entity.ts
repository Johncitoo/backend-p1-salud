import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'profesionales_salud' })
export class ProfesionalSalud {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ length: 50 })
  profesion: string;

  @Column({ name: 'numero_registro', type: 'varchar', length: 50, nullable: true })
  numeroRegistro?: string | null;

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
