import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'plantilla_ficha_campos' })
export class PlantillaFichaCampo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plantilla_ficha_id', type: 'uuid' })
  plantillaFichaId: string;

  @Column({ name: 'variable_clinica_id', type: 'uuid', nullable: true })
  variableClinicaId?: string | null;

  @Column({ name: 'codigo_campo', length: 100 })
  codigoCampo: string;

  @Column({ length: 150 })
  etiqueta: string;

  @Column({ name: 'tipo_campo', length: 30 })
  tipoCampo: string;

  @Column({ default: false })
  obligatorio: boolean;

  @Column({ default: 0 })
  orden: number;

  @Column({ name: 'ayuda_texto', type: 'text', nullable: true })
  ayudaTexto?: string | null;

  @Column({ type: 'jsonb', default: {} })
  opciones: Record<string, unknown>;

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
