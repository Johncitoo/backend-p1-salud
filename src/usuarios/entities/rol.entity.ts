import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'roles' })
export class Rol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
