import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'variables_clinicas' })
export class VariableClinica {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  codigo: string;

  @Column({ length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  categoria?: string | null;

  @Column({ name: 'tipo_dato', length: 30 })
  tipoDato: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unidad?: string | null;

  @Column({
    name: 'valor_minimo',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  valorMinimo?: number | null;

  @Column({
    name: 'valor_maximo',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  valorMaximo?: number | null;

  @Column({ type: 'text', array: true, nullable: true })
  sinonimos?: string[] | null;

  @Column({ default: true })
  activa: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
