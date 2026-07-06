import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVisitaCheckpointDto {
  @IsUUID()
  visitaId: string;

  @IsIn(['CHECK_IN', 'CHECK_OUT'])
  tipo: string;

  @IsOptional()
  @IsDateString()
  fechaHora?: string;

  @IsOptional()
  @IsNumber()
  latitud?: number;

  @IsOptional()
  @IsNumber()
  longitud?: number;

  @IsOptional()
  @IsNumber()
  precisionMetros?: number;

  @IsOptional()
  @IsIn(['APP', 'WEB', 'OFFLINE_SYNC', 'ADMIN'])
  origen?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
