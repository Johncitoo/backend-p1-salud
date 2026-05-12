import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'identity_user_id', length: 100 })
  identityUserId: string;

  @Column({ name: 'rol_id', type: 'uuid' })
  rolId: string;

  @Column({ length: 20 })
  rut: string;

  @Column({ length: 100 })
  nombres: string;

  @Column({ length: 100 })
  apellidos: string;

  @Column({ length: 150 })
  email: string;

  @Column({ length: 30, nullable: true })
  telefono?: string | null;

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'ultimo_acceso_at', type: 'timestamp', nullable: true })
  ultimoAccesoAt?: Date | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
