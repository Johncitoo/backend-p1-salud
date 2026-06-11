import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'profesional_zona' })
export class ProfesionalZona {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profesional_salud_id', type: 'uuid' })
  profesionalSaludId: string;

  @Column({ name: 'zona_id', type: 'uuid' })
  zonaId: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
