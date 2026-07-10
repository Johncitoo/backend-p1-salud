import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VariableClinica } from '../../variables-clinicas/entities/variable-clinica.entity';

@Entity({ name: 'mediciones_clinicas' })
export class MedicionClinica {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ficha_clinica_id', type: 'uuid', nullable: true })
  fichaClinicaId?: string | null;

  @Column({ name: 'visita_id', type: 'uuid', nullable: true })
  visitaId?: string | null;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'variable_clinica_id', type: 'uuid' })
  variableClinicaId: string;

  @ManyToOne(() => VariableClinica)
  @JoinColumn({ name: 'variable_clinica_id' })
  variableClinica?: VariableClinica;

  @Column({
    name: 'valor_numero',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  valorNumero?: number | null;

  @Column({ name: 'valor_texto', type: 'text', nullable: true })
  valorTexto?: string | null;

  @Column({ name: 'valor_boolean', type: 'boolean', nullable: true })
  valorBoolean?: boolean | null;

  @Column({ name: 'valor_fecha', type: 'date', nullable: true })
  valorFecha?: Date | null;

  @Column({ name: 'valor_json', type: 'jsonb', nullable: true })
  valorJson?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unidad?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'FICHA' })
  origen: string;

  @Column({ name: 'registrado_por_usuario_id', type: 'uuid', nullable: true })
  registradoPorUsuarioId?: string | null;

  @Column({ name: 'fecha_medicion', type: 'timestamp', default: () => 'NOW()' })
  fechaMedicion: Date;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
