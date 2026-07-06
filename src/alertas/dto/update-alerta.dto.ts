import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAlertaDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensaje?: string;

  @IsOptional()
  @IsIn(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'])
  prioridad?: string;

  @IsOptional()
  @IsIn(['ABIERTA', 'EN_REVISION', 'RESUELTA', 'CERRADA', 'CANCELADA'])
  estado?: string;
}
