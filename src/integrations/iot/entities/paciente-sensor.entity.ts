import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Paciente } from '../../../pacientes/entities/paciente.entity';

@Entity('paciente_sensores')
@Unique(['assetId', 'sensorId'])
export class PacienteSensor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id' })
  pacienteId: string;

  @ManyToOne(() => Paciente)
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column({ name: 'asset_id', length: 150 })
  assetId: string;

  @Column({ name: 'sensor_id', length: 150 })
  sensorId: string;

  @Column({ name: 'sensor_type', length: 50 })
  sensorType: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
