import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReprogramacionVisitaDto {
  @IsUUID()
  visitaId: string;

  @IsDateString()
  fechaProgramadaAnterior: string;

  @IsString()
  horaProgramadaAnterior: string;

  @IsDateString()
  fechaProgramadaNueva: string;

  @IsString()
  horaProgramadaNueva: string;

  @IsOptional()
  @IsUUID()
  motivoReprogramacionId?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
