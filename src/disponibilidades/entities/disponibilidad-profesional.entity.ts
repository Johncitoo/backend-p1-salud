import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'disponibilidades_profesionales' })
export class DisponibilidadProfesional {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profesional_salud_id', type: 'uuid' })
  profesionalSaludId: string;

  @Column({ name: 'zona_id', type: 'uuid', nullable: true })
  zonaId?: string | null;

  @Column({ name: 'dia_semana', type: 'integer' })
  diaSemana: number;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin: string;

  @Column({ name: 'capacidad_max_visitas', type: 'integer', nullable: true })
  capacidadMaxVisitas?: number | null;

  @Column({ name: 'vigente_desde', type: 'date', nullable: true })
  vigenteDesde?: Date | null;

  @Column({ name: 'vigente_hasta', type: 'date', nullable: true })
  vigenteHasta?: Date | null;

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
