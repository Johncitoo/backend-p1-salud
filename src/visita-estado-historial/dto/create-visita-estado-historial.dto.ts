import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVisitaEstadoHistorialDto {
  @IsUUID()
  visitaId: string;

  @IsOptional()
  @IsString()
  estadoAnterior?: string;

  @IsIn([
    'PROGRAMADA',
    'EN_CAMINO',
    'EN_ATENCION',
    'REALIZADA',
    'CANCELADA',
    'REPROGRAMADA',
    'NO_REALIZADA',
  ])
  estadoNuevo: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
