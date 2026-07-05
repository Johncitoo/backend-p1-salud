import { IsDateString, IsIn, IsInt, IsOptional, IsPositive, IsString, IsUUID, Matches } from 'class-validator';

const VISITA_ESTADOS = ['PROGRAMADA', 'EN_CAMINO', 'EN_ATENCION', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA', 'NO_REALIZADA'] as const;
const VISITA_PRIORIDADES = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] as const;

export class CreateVisitaDto {
  @IsUUID()
  pacienteId: string;

  @IsUUID()
  profesionalSaludId: string;

  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @IsOptional()
  @IsUUID()
  planCuidadoId?: string;

  @IsOptional()
  @IsUUID()
  direccionPacienteId?: string;

  @IsDateString()
  fechaProgramada: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  horaProgramada: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  duracionEstimadaMin?: number;

  @IsOptional()
  @IsIn(VISITA_PRIORIDADES)
  prioridad?: string;

  @IsOptional()
  @IsIn(VISITA_ESTADOS)
  estado?: string;
}
