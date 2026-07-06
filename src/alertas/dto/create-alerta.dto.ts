import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAlertaDto {
  @IsUUID()
  pacienteId: string;

  @IsOptional()
  @IsUUID()
  visitaId?: string;

  @IsString()
  @MaxLength(50)
  tipo: string;

  @IsString()
  @MaxLength(500)
  mensaje: string;

  @IsOptional()
  @IsIn(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'])
  prioridad?: string;

  @IsOptional()
  @IsIn(['ABIERTA', 'EN_REVISION', 'RESUELTA', 'CERRADA', 'CANCELADA'])
  estado?: string;
}
