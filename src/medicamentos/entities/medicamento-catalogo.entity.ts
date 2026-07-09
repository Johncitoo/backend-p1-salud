import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

// Único por (nombre, presentacion) y no solo por nombre: un mismo medicamento
// existe en distintas dosis/presentaciones (ej. "Escitalopram 10 mg" y
// "Escitalopram 20 mg" son dos ítems de catálogo distintos, no un duplicado).
@Entity({ name: 'medicamentos_catalogo' })
@Unique(['nombre', 'presentacion'])
export class MedicamentoCatalogo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
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
