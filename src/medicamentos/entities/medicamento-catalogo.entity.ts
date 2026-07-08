import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'medicamentos_catalogo' })
export class MedicamentoCatalogo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  presentacion?: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;
}
