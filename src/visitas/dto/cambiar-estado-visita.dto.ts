import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const VISITA_ESTADOS = [
  'PROGRAMADA',
  'EN_CAMINO',
  'EN_ATENCION',
  'REALIZADA',
  'CANCELADA',
  'REPROGRAMADA',
  'NO_REALIZADA',
] as const;

export class CambiarEstadoVisitaDto {
  @IsIn(VISITA_ESTADOS)
  estado: string;

  @IsOptional()
  @IsBoolean()
  puntual?: boolean;

  // Solo se usan cuando estado === 'REPROGRAMADA', para incluir el motivo en el
  // correo de notificación al paciente/profesional.
  @IsOptional()
  @IsUUID()
  motivoReprogramacionId?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
