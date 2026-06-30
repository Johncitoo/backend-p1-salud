import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateIncidenteEstadoHistorialDto {
  @IsUUID()
  incidenteSaludId: string;

  @IsOptional()
  @IsString()
  estadoAnterior?: string;

  @IsIn(['ABIERTO', 'EN_REVISION', 'RESUELTO', 'CERRADO', 'CANCELADO'])
  estadoNuevo: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
