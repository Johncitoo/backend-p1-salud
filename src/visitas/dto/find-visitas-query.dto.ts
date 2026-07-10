import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

const VISITA_ESTADOS = [
  'PROGRAMADA',
  'EN_CAMINO',
  'EN_ATENCION',
  'REALIZADA',
  'CANCELADA',
  'REPROGRAMADA',
  'NO_REALIZADA',
] as const;

export class FindVisitasQueryDto {
  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @IsOptional()
  @IsUUID()
  profesionalSaludId?: string;

  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @IsOptional()
  @IsIn(VISITA_ESTADOS)
  estado?: string;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;
}
