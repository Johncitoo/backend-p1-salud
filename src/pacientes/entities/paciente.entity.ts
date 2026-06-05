import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'pacientes' })
export class Paciente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  nombres: string;

  @Column({ length: 100 })
  apellidos: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento?: Date | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  sexo?: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  rut?: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
