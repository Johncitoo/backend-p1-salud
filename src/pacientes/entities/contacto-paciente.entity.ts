import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'contactos_paciente' })
export class ContactoPaciente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 30, nullable: true })
  telefono?: string | null;

  @Column({ length: 150, nullable: true })
  email?: string | null;

  @Column({ length: 50, nullable: true })
  relacion?: string | null;

  @Column({ default: false })
  esEmergencia: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
