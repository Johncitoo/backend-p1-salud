import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ReprogramarVisitaDto {
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
